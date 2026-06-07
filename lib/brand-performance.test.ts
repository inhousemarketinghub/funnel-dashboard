import { describe, it, expect } from "vitest";
import { aggregateOrderItems, filterOrderItemsByDate, buildOrderDateMap } from "./sheets";

// "Order Items" tab layout: A=Order No. B=Brand C=Product D=Model/Name E=Qty F=Item Sales (RM)
const orderItemsHeader = ["Order No.", "Brand", "Product", "Model/Name", "Qty", "Item Sales (RM)"];

// The 5 canonical rows provided as the standard answer (all within the current period)
const orderItemsRows: string[][] = [
  orderItemsHeader,
  ["101", "2990's", "Mattress", "Arrus F", "1", "8970"],
  ["102", "2990's", "Sofa", "Booqit", "1", "3240"],
  ["103", "2990's", "Sofa", "Ommbuc", "1", "2615"],
  ["105", "2990's", "Sofa", "Xammar", "1", "3240"],
  ["105", "2990's", "Add-On", "Seat extend + Fabric", "1", "375"],
];

describe("aggregateOrderItems", () => {
  it("groups by product summing qty and sales", () => {
    const { byProduct } = aggregateOrderItems(orderItemsRows);
    const get = (name: string) => byProduct.find((p) => p.name === name);

    expect(get("Mattress")).toEqual({ name: "Mattress", qty: 1, sales: 8970 });
    expect(get("Sofa")).toEqual({ name: "Sofa", qty: 3, sales: 9095 });
    expect(get("Add-On")).toEqual({ name: "Add-On", qty: 1, sales: 375 });
    expect(byProduct).toHaveLength(3);
  });

  it("groups by brand summing qty and sales", () => {
    const { byBrand } = aggregateOrderItems(orderItemsRows);
    expect(byBrand).toEqual([{ name: "2990's", qty: 5, sales: 18440 }]);
  });

  it("computes overall totals", () => {
    const { totalQty, totalSales } = aggregateOrderItems(orderItemsRows);
    expect(totalQty).toBe(5);
    expect(totalSales).toBe(18440);
  });

  it("returns empty structure for header-only or empty input", () => {
    expect(aggregateOrderItems([orderItemsHeader])).toEqual({
      byBrand: [],
      byProduct: [],
      totalQty: 0,
      totalSales: 0,
    });
    expect(aggregateOrderItems([])).toEqual({
      byBrand: [],
      byProduct: [],
      totalQty: 0,
      totalSales: 0,
    });
  });
});

describe("filterOrderItemsByDate", () => {
  const start = new Date(2026, 5, 1); // 2026-06-01
  const end = new Date(2026, 5, 30); // 2026-06-30

  const rows: string[][] = [
    orderItemsHeader,
    ["101", "2990's", "Mattress", "Arrus F", "1", "8970"], // in range
    ["999", "2990's", "Sofa", "OldOrder", "1", "5000"], // out of range
  ];

  it("keeps only rows whose order purchase date is within range", () => {
    const orderDates = new Map<string, Date | null>([
      ["101", new Date(2026, 5, 5)], // 2026-06-05 → in
      ["999", new Date(2026, 4, 1)], // 2026-05-01 → out
    ]);
    const filtered = filterOrderItemsByDate(rows, orderDates, start, end);
    const { totalQty, totalSales, byProduct } = aggregateOrderItems(filtered);
    expect(totalQty).toBe(1);
    expect(totalSales).toBe(8970);
    expect(byProduct.map((p) => p.name)).toEqual(["Mattress"]);
  });

  it("drops rows whose order number has no matching purchase date", () => {
    const orderDates = new Map<string, Date | null>([["101", new Date(2026, 5, 5)]]);
    const filtered = filterOrderItemsByDate(rows, orderDates, start, end);
    expect(aggregateOrderItems(filtered).totalQty).toBe(1);
  });

  it("returns all rows unchanged when no date range is given", () => {
    const orderDates = new Map<string, Date | null>();
    expect(filterOrderItemsByDate(rows, orderDates)).toBe(rows);
  });
});

describe("buildOrderDateMap", () => {
  // Main 'Lead & Sales Tracker': O col (14) = Purchase Date, P col (15) = Order No.
  const leadHeader = Array(16).fill("");
  leadHeader[0] = "Date";
  leadHeader[14] = "Purchase Date";
  leadHeader[15] = "Order No.";

  const mkRow = (date: string, purchase: string, orderNo: string) => {
    const r = Array(16).fill("");
    r[0] = date;
    r[14] = purchase;
    r[15] = orderNo;
    return r;
  };

  it("maps order number to its purchase date", () => {
    const rows = [
      leadHeader,
      mkRow("01/06/2026", "10/06/2026", "101"),
      mkRow("02/06/2026", "12/06/2026", "102"),
    ];
    const map = buildOrderDateMap(rows);
    expect(map.get("101")?.getMonth()).toBe(5); // June
    expect(map.get("101")?.getDate()).toBe(10);
    expect(map.get("102")?.getDate()).toBe(12);
  });

  it("ignores rows without an order number", () => {
    const rows = [leadHeader, mkRow("01/06/2026", "10/06/2026", "")];
    expect(buildOrderDateMap(rows).size).toBe(0);
  });

  it("works on a sliced 2-column (O:P) fetch — Purchase Date + Order No. only", () => {
    // Efficiency optimization: we fetch only columns O:P instead of the whole tab,
    // so the map builder must detect the two columns by header within the slice.
    const rows = [
      ["Purchase Date", "Order No."],
      ["10/06/2026", "101"],
      ["12/06/2026", "102"],
    ];
    const map = buildOrderDateMap(rows);
    expect(map.size).toBe(2);
    expect(map.get("101")?.getDate()).toBe(10);
    expect(map.get("102")?.getDate()).toBe(12);
  });
});
