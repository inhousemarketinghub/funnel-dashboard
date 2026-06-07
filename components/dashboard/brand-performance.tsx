"use client";

import type { BrandPerformanceData } from "@/lib/sheets";
import { fmtRM } from "@/lib/utils";
import { DonutChart, Metric } from "./breakdown-donut";

// Brand Performance — splits "Order Items" sales by brand and by product.
// Four donuts mirror the Person Performance layout: brand & product, each
// distributed by units sold and by sales value.

export function BrandPerformance({ data }: { data: BrandPerformanceData }) {
  const { byBrand, byProduct, totalQty, totalSales } = data;

  return (
    <div>
      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-[8px] mb-5 max-w-[360px]">
        <Metric label="Total Products Sold" value={totalQty} />
        <Metric label="Total Sales" text={fmtRM(totalSales)} />
      </div>

      {/* Donuts: Brand & Product, each by Qty and by Sales */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* 1. Brand by Qty */}
        <DonutChart
          data={byBrand.map((b) => ({ name: b.name, value: b.qty }))}
          label="units"
          title="Brand · Qty"
          hoverFn={(d) => {
            const b = byBrand.find((x) => x.name === d.name);
            return `${d.name}: ${b?.qty || 0} units`;
          }}
        />

        {/* 2. Brand by Sales */}
        <DonutChart
          data={byBrand.map((b) => ({ name: b.name, value: b.sales }))}
          label="sales"
          title="Brand · Sales"
          hoverFn={(d) => {
            const b = byBrand.find((x) => x.name === d.name);
            return `${d.name}: ${fmtRM(b?.sales || 0)} (${b?.qty || 0} units)`;
          }}
        />

        {/* 3. Product by Qty */}
        <DonutChart
          data={byProduct.map((p) => ({ name: p.name, value: p.qty }))}
          label="units"
          title="Product · Qty"
          hoverFn={(d) => {
            const p = byProduct.find((x) => x.name === d.name);
            return `${d.name}: ${p?.qty || 0} units`;
          }}
        />

        {/* 4. Product by Sales */}
        <DonutChart
          data={byProduct.map((p) => ({ name: p.name, value: p.sales }))}
          label="sales"
          title="Product · Sales"
          hoverFn={(d) => {
            const p = byProduct.find((x) => x.name === d.name);
            return `${d.name}: ${fmtRM(p?.sales || 0)} (${p?.qty || 0} units)`;
          }}
        />
      </div>
    </div>
  );
}
