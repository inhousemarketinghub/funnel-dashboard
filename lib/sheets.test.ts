import { describe, it, expect } from "vitest";
import { parsePerformanceCSV, parseLeadSalesCSV, countEstShowUp } from "./sheets";

const perfCSV = `Date,Taxed Ad Spend,Lead Funnel,Branding,PM (Inquiry),x,Contact Given,Appointment,Showed Up,x,x,x,x,Order Counts,x,x,x,Total Sales
01/03/2026,RM250.00,200,50,10,0,5,1,0,0,0,0,0,0,0,0,0,0
02/03/2026,RM260.00,210,50,12,0,4,2,1,0,0,0,0,1,0,0,0,RM40000`;

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

describe("countEstShowUp", () => {
  it("counts leads with appointment dates in range", () => {
    const leads = parseLeadSalesCSV(leadCSV);
    const march = countEstShowUp(leads, new Date(2026, 2, 1), new Date(2026, 2, 31));
    const april = countEstShowUp(leads, new Date(2026, 3, 1), new Date(2026, 3, 30));
    expect(march).toBe(1);
    expect(april).toBe(1);
  });
});
