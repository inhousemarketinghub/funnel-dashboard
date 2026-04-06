import { describe, it, expect } from "vitest";
import { parsePerformanceCSV, parseLeadSalesCSV, countEstShowUp, parseCSVLine } from "./sheets";

const perfCSV = `Date,Taxed Ad Spend,Lead Funnel,Branding,SST,PM,CPL,Contact Given,Appointment,Showed Up,x,Appt Rate,SU Rate,Conv Rate,Order Counts,x,ROAS Date,ROAS Spend,Total Sales
01/03/2026,RM250.00,200,50,20,10,25,5,1,0,,,,,0,,,,0
02/03/2026,RM260.00,210,50,20,12,22,4,2,1,,,,,1,,,,RM40000`;

describe("parsePerformanceCSV", () => {
  it("parses CSV into DailyMetric array", () => {
    const rows = parsePerformanceCSV(perfCSV);
    expect(rows).toHaveLength(2);
    expect(rows[0].ad_spend).toBe(250);
    expect(rows[0].inquiry).toBe(10);
    expect(rows[0].contact).toBe(5);
    expect(rows[1].sales).toBe(40000);
    expect(rows[1].showup).toBe(1);
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

describe("countEstShowUp", () => {
  it("counts leads with appointment dates in range", () => {
    const leads = parseLeadSalesCSV(leadCSV);
    const march = countEstShowUp(leads, new Date(2026, 2, 1), new Date(2026, 2, 31));
    const april = countEstShowUp(leads, new Date(2026, 3, 1), new Date(2026, 3, 30));
    expect(march).toBe(1);
    expect(april).toBe(1);
  });
});
