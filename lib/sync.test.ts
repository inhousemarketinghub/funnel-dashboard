import { describe, it, expect, vi } from "vitest";
import { diffDailyMetrics, fanOutSync, markStaleRuns } from "./sync";
import { extractLeadRows, parseCSVLine } from "./sheets";

const M = (over: Partial<Record<string, number>> = {}) => ({
  ad_spend: 100, lead_funnel_spend: 90, branding_spend: 10, inquiry: 5,
  contact: 3, appointment: 1, est_showup: 1, showup: 1, orders: 0, sales: 0,
  ...over,
}) as never;

describe("diffDailyMetrics", () => {
  it("first sighting = upsert, no audit noise", () => {
    const d = diffDailyMetrics(new Map(), new Map([["|2026-08-01", M()]]));
    expect(d.upserts).toHaveLength(1);
    expect(d.changes).toHaveLength(0);
    expect(d.deletes).toHaveLength(0);
  });

  it("unchanged rows produce zero writes", () => {
    const same = new Map([["|2026-08-01", M()]]);
    const d = diffDailyMetrics(same, new Map([["|2026-08-01", M()]]));
    expect(d.upserts).toHaveLength(0);
    expect(d.changes).toHaveLength(0);
  });

  it("a changed value is upserted AND logged old→new", () => {
    const d = diffDailyMetrics(
      new Map([["|2026-08-01", M({ sales: 1000 })]]),
      new Map([["|2026-08-01", M({ sales: 1500 })]]),
    );
    expect(d.upserts).toHaveLength(1);
    expect(d.changes).toEqual([
      { brand: "", metric_date: "2026-08-01", metric: "sales", old_value: 1000, new_value: 1500 },
    ]);
  });

  it("a vanished sheet row is deleted and non-zero values logged →null", () => {
    const d = diffDailyMetrics(new Map([["Rygis|2026-08-02", M({ inquiry: 7, orders: 0 })]]), new Map());
    expect(d.deletes).toEqual([{ brand: "Rygis", date: "2026-08-02" }]);
    const metrics = d.changes.map((c) => c.metric);
    expect(metrics).toContain("inquiry");
    expect(metrics).not.toContain("orders"); // zero → null is not information
  });

  it("brand keys with | in dates split correctly", () => {
    const d = diffDailyMetrics(new Map(), new Map([["The Couch Factory|2026-08-03", M()]]));
    expect(d.upserts[0]).toMatchObject({ brand: "The Couch Factory", date: "2026-08-03" });
  });
});

describe("extractLeadRows", () => {
  const csv = `Date,Source,Name,Phone,Appointment Person,Sales Person,Appointment Date,Showed Up,Purchase Date,Sales,Brand
01/08/2026,Facebook,张三,0123,Amy,Ali,02/08/2026,Yes,03/08/2026,RM100,Carress
oops,Instagram,李四,0456,Amy,Ben,,No,,0,Carress
,,,,,,,,,,`;
  const rows = csv.trim().split("\n").map(parseCSVLine);

  it("extracts aggregation fields only — never lead name or phone", () => {
    const { rows: out } = extractLeadRows(rows);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ source: "Facebook", sales_person: "Ali", showed_up: true, sales: 100, brand: "Carress" });
    expect(JSON.stringify(out)).not.toContain("张三");
    expect(JSON.stringify(out)).not.toContain("0123");
  });

  it("quarantines content rows with unparseable dates, skips blank filler", () => {
    const { quarantined } = extractLeadRows(rows);
    expect(quarantined).toHaveLength(1);
    expect(quarantined[0]).toMatchObject({ rowIndex: 3, reason: "unparseable_lead_date", sample: { date: "oops" } });
  });
});

describe("fanOutSync", () => {
  const clients = [
    { id: "aaa", name: "Rygis", sheet_id: "s1" },
    { id: "bbb", name: "2990's", sheet_id: "s2" },
  ];

  it("hits one worker URL per client, carrying the cron bearer", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
    const out = await fanOutSync("https://x.app", clients, "sec", fetchImpl as never);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://x.app/api/sync?clientId=aaa",
      { headers: { authorization: "Bearer sec" } },
    );
    expect(out).toEqual([
      { client: "Rygis", ok: true, error: undefined },
      { client: "2990's", ok: true, error: undefined },
    ]);
  });

  it("a worker's HTTP 500 becomes ok:false with its error message", async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true }) })
      .mockResolvedValueOnce({ ok: false, json: async () => ({ error: "boom" }) });
    const out = await fanOutSync("https://x.app", clients, "sec", fetchImpl as never);
    expect(out[1]).toEqual({ client: "2990's", ok: false, error: "boom" });
  });

  it("a network throw fails that client only, not the whole batch", async () => {
    const fetchImpl = vi.fn()
      .mockRejectedValueOnce(new Error("ECONNRESET"))
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true }) });
    const out = await fanOutSync("https://x.app", clients, "sec", fetchImpl as never);
    expect(out[0]).toEqual({ client: "Rygis", ok: false, error: "ECONNRESET" });
    expect(out[1].ok).toBe(true);
  });
});

describe("markStaleRuns", () => {
  it("only touches running rows older than the cutoff", async () => {
    const lt = vi.fn().mockResolvedValue({});
    const eq = vi.fn().mockReturnValue({ lt });
    const update = vi.fn().mockReturnValue({ eq });
    const from = vi.fn().mockReturnValue({ update });
    const before = Date.now();
    await markStaleRuns({ from } as never, 10);
    expect(from).toHaveBeenCalledWith("sync_runs");
    expect(update).toHaveBeenCalledWith({
      status: "error",
      error: expect.stringContaining("janitor"),
    });
    expect(eq).toHaveBeenCalledWith("status", "running");
    const [col, cutoffIso] = lt.mock.calls[0] as [string, string];
    expect(col).toBe("started_at");
    // cutoff ≈ now - 10min (allow the test's own runtime as slack)
    expect(Date.parse(cutoffIso)).toBeGreaterThanOrEqual(before - 10 * 60_000 - 1000);
    expect(Date.parse(cutoffIso)).toBeLessThanOrEqual(Date.now() - 10 * 60_000 + 1000);
  });
});
