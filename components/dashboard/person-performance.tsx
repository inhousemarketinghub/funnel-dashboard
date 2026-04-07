"use client";

import { useState, useEffect, useRef } from "react";
import type { ApptPersonMetrics, SalesPersonMetrics, BrandSalesBreakdown } from "@/lib/sheets";
import type { KPIConfig } from "@/lib/types";
import { fmtRM } from "@/lib/utils";

interface Props {
  appointmentPersons: ApptPersonMetrics[];
  salesPersons: SalesPersonMetrics[];
  kpi: KPIConfig;
  brandBreakdowns?: Record<string, BrandSalesBreakdown[]>;
  hasMultiBrand?: boolean;
  funnelType?: string;
}

const COLORS = ["var(--red)", "var(--blue)", "var(--yellow)", "var(--t1)", "var(--green)", "var(--t3)"];

export function PersonPerformance({ appointmentPersons, salesPersons, kpi, brandBreakdowns = {}, hasMultiBrand = false, funnelType = "appointment" }: Props) {
  const [selectedAppt, setSelectedAppt] = useState("all");
  const [selectedSales, setSelectedSales] = useState("all");
  const isWalkin = funnelType === "walkin";
  const hasAppt = appointmentPersons.length > 0;

  // Appointment Setter totals
  const apptTotal = appointmentPersons.reduce(
    (a, p) => ({ contacts: a.contacts + p.contactGiven, appts: a.appts + p.appointment, showUps: a.showUps + p.showUp, orders: a.orders + p.orders, sales: a.sales + p.sales }),
    { contacts: 0, appts: 0, showUps: 0, orders: 0, sales: 0 }
  );
  const selectedApptData = selectedAppt === "all"
    ? { name: "All", contactGiven: apptTotal.contacts, appointment: apptTotal.appts, showUp: apptTotal.showUps, apptRate: apptTotal.contacts ? (apptTotal.appts / apptTotal.contacts) * 100 : 0, orders: apptTotal.orders, sales: apptTotal.sales }
    : appointmentPersons.find((p) => p.name === selectedAppt) || appointmentPersons[0];

  // Sales Person totals — fix conv rate for walk-in
  const salesTotal = salesPersons.reduce(
    (a, p) => ({ visits: a.visits + p.appointment, showUps: a.showUps + p.showUp, orders: a.orders + p.orders, sales: a.sales + p.sales }),
    { visits: 0, showUps: 0, orders: 0, sales: 0 }
  );
  const allConvRate = isWalkin
    ? (salesTotal.visits > 0 ? (salesTotal.orders / salesTotal.visits) * 100 : 0)
    : (salesTotal.showUps > 0 ? (salesTotal.orders / salesTotal.showUps) * 100 : 0);

  const selectedSalesData = selectedSales === "all"
    ? {
        name: "All",
        appointment: salesTotal.visits,
        showUp: salesTotal.showUps,
        showUpRate: salesTotal.visits > 0 ? (salesTotal.showUps / salesTotal.visits) * 100 : 0,
        orders: salesTotal.orders,
        convRate: allConvRate,
        sales: salesTotal.sales,
        aov: salesTotal.orders > 0 ? salesTotal.sales / salesTotal.orders : 0,
      }
    : salesPersons.find((p) => p.name === selectedSales) || salesPersons[0];

  // Brand breakdown — for "all": aggregate all persons; for individual: that person's data
  const selectedBrandBreakdown = (() => {
    if (selectedSales !== "all") return brandBreakdowns[selectedSales] || [];
    // Aggregate all persons' brand breakdowns
    const map = new Map<string, { brand: string; orders: number; sales: number }>();
    for (const bds of Object.values(brandBreakdowns)) {
      for (const b of bds) {
        const existing = map.get(b.brand);
        if (existing) { existing.orders += b.orders; existing.sales += b.sales; }
        else map.set(b.brand, { ...b });
      }
    }
    return Array.from(map.values());
  })();

  return (
    <div>
      {/* ── Appointment Setter Section ── */}
      {hasAppt && (
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="font-label text-[11px] uppercase tracking-widest text-[var(--t3)]">Appointment Setter</div>
            <select value={selectedAppt} onChange={(e) => setSelectedAppt(e.target.value)}
              className="text-[12px] py-[4px] px-2 rounded-[6px] border border-[var(--border)] bg-[var(--bg2)] text-[var(--t1)] outline-none">
              <option value="all">All ({appointmentPersons.length})</option>
              {appointmentPersons.map((p) => <option key={p.name} value={p.name}>{p.name}</option>)}
            </select>
          </div>
          <div className="flex gap-5 flex-wrap">
            <div className="flex-1 min-w-[320px]">
              <div className="grid grid-cols-3 lg:grid-cols-6 gap-[8px]">
                <Metric label="Contact Given" value={selectedApptData.contactGiven} />
                <Metric label="Appointment" value={selectedApptData.appointment} />
                <Metric label="Show Up" value={selectedApptData.showUp}
                  sub={`${selectedApptData.contactGiven ? ((selectedApptData.showUp / selectedApptData.contactGiven) * 100).toFixed(1) : 0}%`} />
                <Metric label="Appt Rate" text={`${selectedApptData.apptRate.toFixed(1)}%`} />
                <Metric label="Orders" value={selectedApptData.orders} />
                <Metric label="Sales" text={fmtRM(selectedApptData.sales)} />
              </div>
            </div>
            <div className="w-[260px] flex-shrink-0">
              <DonutChart
                data={appointmentPersons.map((p) => ({ name: p.name, value: p.contactGiven }))}
                label="contacts"
                title="Person Visit Distribution"
              />
            </div>
          </div>
        </div>
      )}

      {/* ── Sales Person Section ── */}
      <div>
        <div className="flex items-center gap-3 mb-4">
          <div className="font-label text-[11px] uppercase tracking-widest text-[var(--t3)]">Sales Person</div>
          <select value={selectedSales} onChange={(e) => setSelectedSales(e.target.value)}
            className="text-[12px] py-[4px] px-2 rounded-[6px] border border-[var(--border)] bg-[var(--bg2)] text-[var(--t1)] outline-none">
            <option value="all">All ({salesPersons.length})</option>
            {salesPersons.map((p) => <option key={p.name} value={p.name}>{p.name}</option>)}
          </select>
        </div>

        {/* Metrics */}
        <div className={`grid grid-cols-3 ${isWalkin ? "lg:grid-cols-5" : "lg:grid-cols-7"} gap-[8px] mb-5`}>
          <Metric label={isWalkin ? "Visit" : "Appointment"} value={selectedSalesData.appointment} />
          {!isWalkin && <Metric label="Show Up" value={selectedSalesData.showUp} />}
          {!isWalkin && <Metric label="Show Up Rate" text={`${selectedSalesData.showUpRate.toFixed(1)}%`} />}
          <Metric label="Orders" value={selectedSalesData.orders} />
          <Metric label="Conv Rate" text={`${selectedSalesData.convRate.toFixed(1)}%`} />
          <Metric label="Sales" text={fmtRM(selectedSalesData.sales)} />
          <Metric label="AOV" text={fmtRM(selectedSalesData.aov)} />
        </div>

        {/* Donut charts */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {/* 1. Person Visit Distribution */}
          <div>
            <DonutChart
              data={salesPersons.map((p) => ({ name: p.name, value: p.appointment }))}
              label={isWalkin ? "visits" : "appointments"}
              title={isWalkin ? "Person Visit" : "Person Appointment"}
              hoverFn={(d) => `${d.name}: ${d.value} ${isWalkin ? "visits" : "appts"}`}
            />
          </div>

          {/* 2. Person Sales Distribution */}
          <div>
            <DonutChart
              data={salesPersons.map((p) => ({ name: p.name, value: p.sales }))}
              label="sales"
              title="Person Sales"
              hoverFn={(d) => {
                const sp = salesPersons.find((s) => s.name === d.name);
                return `${d.name}: ${fmtRM(d.value)} (${sp?.orders || 0} orders)`;
              }}
            />
          </div>

          {/* 3. Brand Orders Distribution (multi-brand only) */}
          {hasMultiBrand && selectedBrandBreakdown.length > 0 && (
            <div>
              <DonutChart
                data={selectedBrandBreakdown.map((b) => ({ name: b.brand, value: b.orders }))}
                label="orders"
                title="Brand Orders"
                hoverFn={(d) => {
                  const bb = selectedBrandBreakdown.find((b) => b.brand === d.name);
                  return `${d.name}: ${bb?.orders || 0} orders`;
                }}
              />
            </div>
          )}

          {/* 4. Brand Sales Distribution (multi-brand only) */}
          {hasMultiBrand && selectedBrandBreakdown.length > 0 && (
            <div>
              <DonutChart
                data={selectedBrandBreakdown.map((b) => ({ name: b.brand, value: b.sales }))}
                label="sales"
                title="Brand Sales"
                hoverFn={(d) => {
                  const bb = selectedBrandBreakdown.find((b) => b.brand === d.name);
                  return `${d.name}: ${fmtRM(d.value)} (${bb?.orders || 0} orders)`;
                }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Donut with hover ──────────────────────────────────────────

function DonutChart({ data, label, title, hoverFn }: {
  data: { name: string; value: number }[];
  label: string;
  title?: string;
  hoverFn?: (d: { name: string; value: number }) => string;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [visible, setVisible] = useState(false);
  const [hovered, setHovered] = useState<number | null>(null);

  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => { entries.forEach((e) => { if (e.isIntersecting) { setVisible(true); obs.unobserve(el); } }); },
      { threshold: 0.3 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const items = data.filter((d) => d.value > 0).slice(0, 6);
  const total = items.reduce((a, d) => a + d.value, 0) || 1;
  const circ = 2 * Math.PI * 46;

  return (
    <div className="relative">
      {title && <div className="font-label text-[9px] uppercase tracking-widest text-[var(--t4)] mb-2">{title}</div>}
      <div className="flex items-center gap-3">
        <svg ref={svgRef} viewBox="0 0 120 120" style={{ width: 90, height: 90, transform: "rotate(-90deg)", flexShrink: 0 }}>
          <circle cx="60" cy="60" r="46" fill="none" stroke="var(--sand)" strokeWidth="12" />
          {items.map((d, i) => {
            const pct = d.value / total;
            const arc = pct * circ;
            const gap = 4;
            const offset = items.slice(0, i).reduce((a, x) => a + (x.value / total) * circ, 0);
            return (
              <circle key={d.name} cx="60" cy="60" r="46" fill="none" stroke={COLORS[i]} strokeWidth={hovered === i ? 15 : 12} strokeLinecap="round"
                strokeDasharray={visible ? `${arc - gap} ${circ - arc + gap}` : "0 314"} strokeDashoffset={-offset}
                style={{ transition: `stroke-dasharray 1000ms ease ${i * 150}ms, stroke-width 200ms ease`, cursor: "pointer" }}
                onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)} />
            );
          })}
        </svg>
        <div className="flex flex-col gap-[4px] flex-1 min-w-0">
          {items.map((d, i) => (
            <div key={d.name} className="flex items-center gap-[5px] text-[10px]"
              style={{ color: hovered === i ? "var(--t1)" : "var(--t2)", cursor: "pointer" }}
              onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)}>
              <span className="w-[5px] h-[5px] rounded-full flex-shrink-0" style={{ background: COLORS[i] }} />
              <span className="truncate">{d.name}</span>
              <span className="num text-[var(--t3)] ml-auto flex-shrink-0">{((d.value / total) * 100).toFixed(0)}%</span>
            </div>
          ))}
        </div>
      </div>
      {hovered !== null && items[hovered] && (
        <div className="tip show" style={{ position: "absolute", top: -28, left: "40%", transform: "translateX(-50%)", zIndex: 20 }}>
          {hoverFn ? hoverFn(items[hovered]) : `${items[hovered].name}: ${items[hovered].value} ${label} (${((items[hovered].value / total) * 100).toFixed(1)}%)`}
        </div>
      )}
    </div>
  );
}

// ── Metric Card ───────────────────────────────────────────────

function Metric({ label, value, text, sub }: { label: string; value?: number; text?: string; sub?: string }) {
  return (
    <div className="bg-[var(--bg3)] rounded-[8px] p-[10px]" style={{ transition: "background 500ms ease" }}>
      <div className="text-[9px] text-[var(--t4)] uppercase tracking-wider mb-[3px]">{label}</div>
      <div className="num text-[16px] font-semibold text-[var(--t1)]">{text ?? value?.toLocaleString() ?? "0"}</div>
      {sub && <div className="text-[10px] text-[var(--t3)] mt-[2px]">{sub}</div>}
    </div>
  );
}
