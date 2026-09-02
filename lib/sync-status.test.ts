import { describe, it, expect } from "vitest";
import { summarizeRun } from "./sync-status";

describe("summarizeRun", () => {
  it("maps a successful run with stats and one-decimal seconds", () => {
    const s = summarizeRun({
      started_at: "2026-09-02T00:30:00.000Z",
      finished_at: "2026-09-02T00:30:08.640Z",
      status: "success", trigger: "cron",
      stats: { changes: 5, lead_rows: 470, quarantined: 0 },
      error: null,
    });
    expect(s).toMatchObject({ status: "success", trigger: "cron", seconds: 8.6, changes: 5, lead_rows: 470, quarantined: 0, error: null });
  });

  it("an errored run without stats keeps nulls and the message", () => {
    const s = summarizeRun({
      started_at: "2026-09-02T00:30:00.000Z", finished_at: "2026-09-02T00:30:02.000Z",
      status: "error", trigger: "manual", stats: null, error: "boom",
    });
    expect(s).toMatchObject({ status: "error", seconds: 2, changes: null, lead_rows: null, error: "boom" });
  });

  it("a still-running (or killed) run has no duration", () => {
    const s = summarizeRun({
      started_at: "2026-09-02T00:30:00.000Z", finished_at: null,
      status: "running", trigger: "stale", stats: null, error: null,
    });
    expect(s.seconds).toBeNull();
    expect(s.finished_at).toBeNull();
  });
});
