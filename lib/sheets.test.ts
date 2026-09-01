import { describe, it, expect } from "vitest";
import {
  TAB_RULES, buildPersonData, buildPersonDataFromRows, countEstShowUp, deriveTracked, diagnosePerfColumns, extractLeadRows, mergeTracked, parseCSVLine, parseLeadSalesCSV, parsePerformanceCSV, pickPerformanceTab, pickTab,
} from "./sheets";

const csvToRows = (csv: string) => csv.trim().split("\n").map((line) => parseCSVLine(line));

const perfCSV = `Date,Taxed Ad Spend,Lead Funnel,Branding,SST,PM,CPL,Contact Given,Appointment,Showed Up,x,Appt Rate,SU Rate,Conv Rate,Order Counts,x,ROAS Date,ROAS Spend,Total Sales
01/03/2026,RM250.00,200,50,20,10,25,5,1,0,,,,,0,,,,0
02/03/2026,RM260.00,210,50,20,12,22,4,2,1,,,,,1,,,,RM40000`;

describe("parsePerformanceCSV", () => {
  it("parses CSV into DailyMetric array", () => {
    const rows = parsePerformanceCSV(perfCSV);
    expect(rows).toHaveLength(2);
    expect(rows[0].ad_spend).toBe(250);
    expect(rows[0].lead_funnel_spend).toBe(200);
    expect(rows[0].branding_spend).toBe(50);
    expect(rows[0].inquiry).toBe(10);
    expect(rows[0].contact).toBe(5);
    expect(rows[1].sales).toBe(40000);
    expect(rows[1].showup).toBe(1);
  });

  it("defaults split spend to 0 when Lead Funnel / Branding columns absent", () => {
    const csv = `Date,Taxed Ad Spend,PM,Contact Given,Appointment,Showed Up,Order Counts,Total Sales
01/03/2026,RM250.00,10,5,1,0,0,0`;
    const rows = parsePerformanceCSV(csv);
    expect(rows[0].lead_funnel_spend).toBe(0);
    expect(rows[0].branding_spend).toBe(0);
  });

  it("returns empty for empty CSV", () => {
    expect(parsePerformanceCSV("")).toEqual([]);
    expect(parsePerformanceCSV("header only")).toEqual([]);
  });
});

const leadCSV = `Date,Source,Condition,Name,Phone,Property,Unit,Size,Req,Budget,Appt Person,Appt Location,Appointment Date,Appt Time,Notes,x,x,Showed Up,x,x,x,x,x,x,Purchase Date,x,x,Sales
01/01/2026,FB,New,John,012,Condo,A,1000,Reno,50k,Ali,Office,15/03/2026,10am,test,x,x,No,x,x,x,x,x,x,,x,x,0
02/01/2026,FB,New,Jane,013,Condo,B,800,Reno,30k,Ali,Office,05/04/2026,2pm,test,x,x,Yes,x,x,x,x,x,x,10/04/2026,x,x,RM50000`;

describe("parseLeadSalesCSV", () => {
  it("parses leads with appointment dates", () => {
    const leads = parseLeadSalesCSV(leadCSV);
    expect(leads).toHaveLength(2);
    expect(leads[0].appointment_date?.getMonth()).toBe(2); // March
    expect(leads[1].appointment_date?.getMonth()).toBe(3); // April
    expect(leads[1].showed_up).toBe(true);
    expect(leads[1].sales).toBe(50000);
  });
});

describe("parseCSVLine", () => {
  it("handles empty fields (consecutive commas)", () => {
    const cols = parseCSVLine("a,,b,,c");
    expect(cols).toEqual(["a", "", "b", "", "c"]);
  });

  it("handles quoted fields", () => {
    const cols = parseCSVLine('"hello, world",123,"test"');
    expect(cols).toEqual(["hello, world", "123", "test"]);
  });

  it("handles escaped quotes in quoted fields", () => {
    const cols = parseCSVLine('"say ""hi""",ok');
    expect(cols).toEqual(['say "hi"', "ok"]);
  });

  it("handles trailing comma (empty last field)", () => {
    const cols = parseCSVLine("a,b,");
    expect(cols).toEqual(["a", "b", ""]);
  });

  it("preserves column indices with real sheet data", () => {
    // Simulates a real Google Sheet row with many empty cells
    // Actual column layout: Date[0], Ad Spend[1], Lead Funnel[2], Branding[3], SST[4],
    // PM[5], CPL[6], Contact[7], Appointment[8], ShowUp[9], (sep)[10],
    // ApptRate[11], SURate[12], ConvRate[13], Orders[14], (sep)[15],
    // ROASDate[16], ROASSpend[17], Sales[18]
    const line = "03/04/2026,RM250.00,,,RM20,10,RM25,5,1,0,,,,,0,,,,RM40000";
    const cols = parseCSVLine(line);
    expect(cols).toHaveLength(19);
    expect(cols[0]).toBe("03/04/2026");
    expect(cols[1]).toBe("RM250.00");
    expect(cols[2]).toBe("");   // lead funnel empty
    expect(cols[3]).toBe("");   // branding empty
    expect(cols[4]).toBe("RM20"); // SST
    expect(cols[5]).toBe("10"); // PM (inquiry)
    expect(cols[6]).toBe("RM25"); // CPL
    expect(cols[7]).toBe("5");  // contact
    expect(cols[8]).toBe("1");  // appointment
    expect(cols[9]).toBe("0");  // showup
    expect(cols[14]).toBe("0"); // orders
    expect(cols[18]).toBe("RM40000"); // sales
  });
});

describe("parsePerformanceCSV with empty fields", () => {
  it("correctly maps columns even with empty cells", () => {
    const csv = `Date,Taxed Ad Spend,Lead Funnel,Branding,SST,PM,CPL,Contact Given,Appointment,Showed Up,x,Appt Rate,SU Rate,Conv Rate,Order Counts,x,ROAS Date,ROAS Spend,Total Sales
03/04/2026,RM250.00,,,RM20,10,RM25,5,1,0,,,,,0,,,,RM40000`;
    const rows = parsePerformanceCSV(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0].ad_spend).toBe(250);
    expect(rows[0].inquiry).toBe(10);
    expect(rows[0].contact).toBe(5);
    expect(rows[0].appointment).toBe(1);
    expect(rows[0].showup).toBe(0);
    expect(rows[0].orders).toBe(0);
    expect(rows[0].sales).toBe(40000);
  });
});

// Real Rygis Private Gym header shape: an "Est.Show Up" column sits immediately
// BEFORE the real "Showed Up" column. Substring matching on "show up" used to
// stop at Est.Show Up, so the dashboard reported estimates as actuals.
const perfCSVWithEstShowUp = `,Lead Tracker,,,,,,,,,,,Conversion Tracker,,,,,ROAS Tracker
Date,Taxed Ad Spend,Lead Funnel Ad Spend,Branding Ad Spend,8% SST,PM,Cost Per PM (Included 8% SST),Contect Given,Appointment,Est.Show Up,Showed Up,,Appointment Rate,Show Up Rate,Conversion Rate,Order Counts,,Date,Taxed Ad Spend,Total Sales,Total ROAS,AOV,,Month Filter,Week ending
04/08/2026,RM100.00,90,10,8,5,20,3,0,1,1,,,,,0,,04/08/2026,RM100.00,0,,,,Aug 2026,09/08/2026
05/08/2026,RM100.00,90,10,8,5,20,3,1,1,0,,,,,0,,05/08/2026,RM100.00,0,,,,Aug 2026,09/08/2026`;

describe("Est.Show Up vs Showed Up column detection", () => {
  it("reads Showed Up from the actuals column, not the adjacent Est.Show Up column", () => {
    const rows = parsePerformanceCSV(perfCSVWithEstShowUp);
    expect(rows).toHaveLength(2);
    expect(rows[0].showup).toBe(1);
    expect(rows[1].showup).toBe(0);
  });

  it("reads Est.Show Up from the Performance Tracker", () => {
    const rows = parsePerformanceCSV(perfCSVWithEstShowUp);
    expect(rows[0].est_showup).toBe(1);
    expect(rows[1].est_showup).toBe(1);
  });

  it("keeps Appointment separate from both show-up columns", () => {
    const rows = parsePerformanceCSV(perfCSVWithEstShowUp);
    expect(rows[0].appointment).toBe(0);
    expect(rows[1].appointment).toBe(1);
  });

  it("still finds Showed Up on sheets that have no Est.Show Up column", () => {
    // Good Brand / Carress@BD shape: Showed Up sits where Est.Show Up would be.
    const csv = `Date,Taxed Ad Spend,Lead Funnel,Branding,SST,PM,CPL,Contect Given,Appointment,Showed Up,,Appointment Rate,Show Up Rate,Conversion Rate,Order Counts
04/08/2026,RM100.00,90,10,8,5,20,3,2,1,,,,,0`;
    const rows = parsePerformanceCSV(csv);
    expect(rows[0].appointment).toBe(2);
    expect(rows[0].showup).toBe(1);
    expect(rows[0].est_showup).toBe(0);
  });
});

describe("diagnosePerfColumns", () => {
  it("resolves the Rygis shape unambiguously with real header text", () => {
    const d = diagnosePerfColumns(csvToRows(perfCSVWithEstShowUp));
    const by = (m: string) => d.columns.find((c) => c.metric === m)!;
    expect(by("showup")).toMatchObject({ index: 10, header: "Showed Up", ambiguous: false, usedFallback: false });
    expect(by("estShowup")).toMatchObject({ index: 9, header: "Est.Show Up", ambiguous: false });
    expect(by("appointment")).toMatchObject({ index: 8, ambiguous: false });
    expect(d.columns.every((c) => !c.ambiguous)).toBe(true);
  });

  it("does not flag identical-text duplicates (ROAS section repeats Date / Taxed Ad Spend)", () => {
    const d = diagnosePerfColumns(csvToRows(perfCSVWithEstShowUp));
    const by = (m: string) => d.columns.find((c) => c.metric === m)!;
    // The rule matches both the main and ROAS-section columns…
    expect(by("date").matches.length).toBeGreaterThanOrEqual(2);
    expect(by("adSpend").matches.length).toBeGreaterThanOrEqual(2);
    // …but identical header text = normal layout, not a warning; first wins.
    expect(by("date")).toMatchObject({ index: 0, ambiguous: false });
    expect(by("adSpend")).toMatchObject({ index: 1, ambiguous: false });
  });

  it("flags ambiguity when two columns match the same rule, first one winning", () => {
    const csv = `Date,Taxed Ad Spend,Lead Funnel,Branding,SST,PM,CPL,Contect Given,Appointment,Appointment Confirm,Showed Up,,Order Counts
04/08/2026,RM100.00,90,10,8,5,20,3,2,1,1,,0`;
    const d = diagnosePerfColumns(csvToRows(csv));
    const appt = d.columns.find((c) => c.metric === "appointment")!;
    expect(appt.ambiguous).toBe(true);
    expect(appt.matches).toHaveLength(2);
    expect(appt.matches.map((m) => m.header)).toEqual(["Appointment", "Appointment Confirm"]);
    expect(appt.index).toBe(8); // first match wins — same value the parser uses
  });

  it("reports untracked columns as null without fallback", () => {
    // walk-in shape: no Appointment / Est.Show Up / Showed Up columns at all
    const csv = `Date,Taxed Ad Spend,Lead Funnel,Branding,SST,PM,CPL,Visit,,Order Counts,Total Sales
04/08/2026,RM100.00,90,10,8,5,20,3,,1,RM500`;
    const d = diagnosePerfColumns(csvToRows(csv));
    const by = (m: string) => d.columns.find((c) => c.metric === m)!;
    expect(by("appointment").index).toBeNull();
    expect(by("estShowup").index).toBeNull();
    expect(by("showup").index).toBeNull();
    expect(deriveTracked(d.colMap)).toEqual({ appointment: false, est_showup: false, showup: false });
  });

  it("falls back to legacy column positions when no header matches", () => {
    const d = diagnosePerfColumns([["", "", ""], ["01/03/2026", "RM250.00", ""]]);
    const by = (m: string) => d.columns.find((c) => c.metric === m)!;
    for (const [metric, idx] of [["date", 0], ["adSpend", 1], ["orders", 14], ["sales", 18]] as const) {
      expect(by(metric)).toMatchObject({ index: idx, usedFallback: true, header: null });
    }
  });
});

describe("tracked metadata", () => {
  it("mergeTracked ORs per field (tracked in ANY brand = tracked overall)", () => {
    const a = { appointment: true, est_showup: false, showup: true };
    const b = { appointment: false, est_showup: false, showup: false };
    expect(mergeTracked(a, b)).toEqual({ appointment: true, est_showup: false, showup: true });
    expect(mergeTracked(b, b)).toEqual({ appointment: false, est_showup: false, showup: false });
  });

  it("parsePerformanceCSV-shaped sheets derive tracked from column presence", () => {
    const d = diagnosePerfColumns(csvToRows(perfCSVWithEstShowUp));
    expect(deriveTracked(d.colMap)).toEqual({ appointment: true, est_showup: true, showup: true });
  });
});

describe("pickTab", () => {
  const tabs = [
    { name: "Dashboard", hidden: false, gid: 1 },
    { name: "Lead & Sales Tracker", hidden: false, gid: 2 },
    { name: "Lead Tracker Filter", hidden: true, gid: 3 },
    { name: "Performance Tracker", hidden: false, gid: 4 },
    { name: "Performance Tracker Filter", hidden: false, gid: 5 },
    { name: "KPI Indicator", hidden: false, gid: 6 },
  ];

  it("applies include/exclude rules in sheet order", () => {
    expect(pickTab(tabs, TAB_RULES.performance)).toBe("Performance Tracker");
    expect(pickTab(tabs, TAB_RULES.lead)).toBe("Lead & Sales Tracker");
    expect(pickTab(tabs, TAB_RULES.kpi)).toBe("KPI Indicator");
  });

  it("pickPerformanceTab prefers the exact @brand tab", () => {
    const brandTabs = [...tabs, { name: "Performance Tracker@Carress", hidden: false, gid: 7 }];
    expect(pickPerformanceTab(brandTabs, "Carress")).toBe("Performance Tracker@Carress");
    expect(pickPerformanceTab(brandTabs)).toBe("Performance Tracker");
  });
});

describe("recruitment funnel orders column (Carress@BD shape)", () => {
  it('resolves orders to "Signed Up", never the adjacent "Sign Up Rate"', () => {
    const csv = `Date,Taxed Ad Spend,Lead Funnel,Branding,SST,PM,CPL,Contect Given,Appointment,Est.Show Up,Showed Up,,Appointment Rate,Show Up Rate,Sign Up Rate,Signed Up,Total Sales
04/08/2026,RM100.00,90,10,8,5,20,3,2,1,1,,,,"50.00%",2,RM1200`;
    const d = diagnosePerfColumns(csvToRows(csv));
    const orders = d.columns.find((c) => c.metric === "orders")!;
    expect(orders).toMatchObject({ index: 15, header: "Signed Up", usedFallback: false, ambiguous: false });
    const rows = parsePerformanceCSV(csv);
    expect(rows[0].orders).toBe(2); // not 5000 from parsing "50.00%"
    expect(rows[0].sales).toBe(1200);
  });

  it("Order Counts still wins over Signed Up when both exist", () => {
    const csv = `Date,Taxed Ad Spend,x,x,x,PM,x,Contect Given,Appointment,Showed Up,,Order Counts,Signed Up
04/08/2026,RM100.00,,,,5,,3,2,1,,4,9`;
    const d = diagnosePerfColumns(csvToRows(csv));
    expect(d.columns.find((c) => c.metric === "orders")!.index).toBe(11);
  });
});

describe("lead tracker Est.Show Up collision (regression)", () => {
  it("reads Showed Up from the actuals column when an Est column sits beside it", () => {
    const csv = `Date,Source,Status,Name,Phone,x,x,x,x,x,Appt Person,Sales Person,x,Appointment Date,Appt Time,x,Remarks,Est.Show Up,Showed Up,x,x,x,x,x,Purchase Date,x,x,Sales
01/01/2026,FB,New,John,012,x,x,x,x,x,Ali,Ben,x,15/03/2026,10am,x,x,Yes,No,x,x,x,x,x,,x,x,0`;
    const leads = parseLeadSalesCSV(csv);
    expect(leads[0].showed_up).toBe(false); // actuals says No; the Est "Yes" must not leak in
  });

  it("single Showed Up column shape is unaffected", () => {
    const leads = parseLeadSalesCSV(leadCSV);
    expect(leads[0].showed_up).toBe(false);
    expect(leads[1].showed_up).toBe(true);
  });
});

describe("buildPersonData source filter", () => {
  // Rygis-like shape: Source at col 1, Sales Person col 3, all leads in Aug 2026
  const csv = `Date,Source,Name,Sales Person,Appointment Date,Showed Up,Purchase Date,Sales
01/08/2026,Facebook,A,Ali,02/08/2026,Yes,03/08/2026,RM100
02/08/2026,Instagram,B,Ali,03/08/2026,Yes,,0
03/08/2026,Walk In,C,Ali,04/08/2026,Yes,05/08/2026,RM300
04/08/2026,facebook,D,Ben,05/08/2026,No,,0
05/08/2026,,E,Ben,06/08/2026,No,,0`;
  const rows = csv.trim().split("\n").map(parseCSVLine);
  const start = new Date(2026, 7, 1);
  const end = new Date(2026, 7, 31);

  it("enumerates available sources by frequency with original labels", () => {
    const d = buildPersonData(rows, start, end);
    expect(d.availableSources[0]).toBe("Facebook"); // 2 hits (case-insensitive merge)
    expect(d.availableSources).toContain("Instagram");
    expect(d.availableSources).toContain("Walk In");
    expect(d.availableSources).toHaveLength(3); // empty source not listed
  });

  it("unfiltered aggregation counts every row", () => {
    const d = buildPersonData(rows, start, end);
    const ali = d.salesPersons.find((p) => p.name === "Ali")!;
    expect(ali.orders).toBe(2); // FB + Walk In purchases
    expect(ali.sales).toBe(400);
  });

  it("filters by selected sources, case-insensitively", () => {
    const d = buildPersonData(rows, start, end, undefined, ["Facebook", "Instagram"]);
    const ali = d.salesPersons.find((p) => p.name === "Ali")!;
    expect(ali.orders).toBe(1); // Walk In purchase excluded
    expect(ali.sales).toBe(100);
    const ben = d.salesPersons.find((p) => p.name === "Ben");
    expect(ben).toBeDefined(); // lowercase "facebook" row still matches
  });

  it("rows with an empty Source are excluded when filtering", () => {
    const d = buildPersonData(rows, start, end, undefined, ["Facebook"]);
    // Ben's only FB row has showed_up=No; his empty-source row must not count
    const ben = d.salesPersons.find((p) => p.name === "Ben")!;
    expect(ben.appointment).toBe(1);
  });

  it("available sources are enumerated before filtering (options never shrink)", () => {
    const d = buildPersonData(rows, start, end, undefined, ["Facebook"]);
    expect(d.availableSources).toHaveLength(3);
  });
});

describe("countEstShowUp", () => {
  it("counts leads with appointment dates in range", () => {
    const leads = parseLeadSalesCSV(leadCSV);
    const march = countEstShowUp(leads, new Date(2026, 2, 1), new Date(2026, 2, 31));
    const april = countEstShowUp(leads, new Date(2026, 3, 1), new Date(2026, 3, 30));
    expect(march).toBe(1);
    expect(april).toBe(1);
  });
});

describe("shared lead row model (Phase 2 PR-B)", () => {
  const csv = `Date,Source,Name,Phone,Appointment Person,Sales Person,Appointment Date,Showed Up,Purchase Date,Sales,Brand
01/08/2026,Facebook,A,01,Amy,Ali,02/08/2026,Yes,03/08/2026,RM100,Carress
02/08/2026,Instagram,B,02,Beth,Ben,TBC,No,,0,Couch
oops,Facebook,C,03,Amy,Ali,,No,05/08/2026,RM50,Carress
03/08/2026,facebook,E,05,Amy,Cara,04/08/2026,Yes,,0,Carress`;
  const rows = csv.trim().split("\n").map(parseCSVLine);
  const s = new Date(2026, 7, 1), e = new Date(2026, 7, 31);

  it("extractLeadRows keeps purchase-dated rows whose lead date fails to parse", () => {
    const { rows: out, quarantined, appointment_col } = extractLeadRows(rows);
    expect(appointment_col).toBe(true);
    const kept = out.find((r) => r.sales === 50);
    expect(kept).toBeDefined();
    expect(kept!.lead_date).toBeNull();
    expect(kept!.purchase_marked).toBe(true);
    expect(quarantined).toHaveLength(0);
  });

  it("quarantines only rows where no date column parses", () => {
    const bad = `Date,Source,Name,Phone,Appointment Person,Sales Person,Appointment Date,Showed Up,Purchase Date,Sales,Brand
nope,Walkin,D,04,,Dan,,No,,0,Carress`;
    const { rows: out, quarantined } = extractLeadRows(bad.trim().split("\n").map(parseCSVLine));
    expect(out).toHaveLength(0);
    expect(quarantined).toHaveLength(1);
    expect(quarantined[0].sample.date).toBe("nope");
  });

  it("marks filled-but-unparseable appointment cells (TBC still counts as an appointment)", () => {
    const { rows: out } = extractLeadRows(rows);
    const tbc = out.find((r) => r.appointment_person === "Beth");
    expect(tbc!.appointment_marked).toBe(true);
    expect(tbc!.appointment_date).toBeNull();
    const beth = buildPersonData(rows, s, e).appointmentPersons.find((p) => p.name === "Beth");
    expect(beth!.appointment).toBe(1);
  });

  it("sheet path and row-model path produce identical PersonData", () => {
    const { rows: model } = extractLeadRows(rows);
    const viaSheet = buildPersonData(rows, s, e, undefined, ["Facebook"]);
    const viaModel = buildPersonDataFromRows(model, {
      isWalkinFunnel: false, startDate: s, endDate: e, sources: ["Facebook"],
    });
    expect(viaModel).toEqual(viaSheet);
  });

  it("parity holds for brand-filtered walk-in aggregation too", () => {
    const { rows: model } = extractLeadRows(rows);
    const viaSheet = buildPersonData(rows, s, e, "Carress");
    const viaModel = buildPersonDataFromRows(model, {
      isWalkinFunnel: false, startDate: s, endDate: e, brandName: "Carress",
    });
    expect(viaModel).toEqual(viaSheet);
  });
});
