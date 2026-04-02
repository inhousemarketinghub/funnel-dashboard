"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useParams } from "next/navigation";
import { fmtRM, fmtROAS } from "@/lib/utils";
import Link from "next/link";

export default function MonthlyReportPage() {
  const params = useParams();
  const clientId = params.clientId as string;
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  async function generateReport() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/report/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, type: "monthly" }),
      });
      if (!res.ok) throw new Error(`Failed: ${res.status}`);
      const data = await res.json();
      setReportData(data);
    } catch (e: any) {
      setError(e.message);
    }
    setLoading(false);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link href={`/${clientId}`} className="text-sm text-[#78716C] hover:text-[#D97706] transition-colors">← Dashboard</Link>
          <h1 className="font-[family-name:var(--font-geist-sans)] text-2xl font-bold tracking-tight text-[#1C1917] mt-1">Monthly Report</h1>
          <p className="text-sm text-[#78716C]">Generate the monthly performance report</p>
        </div>
        <Button onClick={generateReport} className="bg-[#D97706] hover:bg-[#B45309] text-white active:translate-y-px transition-transform" disabled={loading}>
          {loading ? "Generating..." : "Generate Report"}
        </Button>
      </div>

      {error && (
        <div className="bg-[#FEF2F2] border border-[#FECACA] rounded-lg p-4 mb-6 text-sm text-[#DC2626]">{error}</div>
      )}

      {reportData && (
        <div className="bg-white border border-[rgba(214,211,209,0.5)] rounded-lg p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-[family-name:var(--font-geist-sans)] font-bold text-lg tracking-tight">{reportData.reportMonth}</h2>
            <span className="text-xs text-[#78716C] font-[family-name:var(--font-geist-mono)]">Generated {new Date(reportData.generatedAt).toLocaleString()}</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Sales", value: fmtRM(reportData.tm.sales) },
              { label: "Orders", value: String(reportData.tm.orders) },
              { label: "ROAS", value: fmtROAS(reportData.tm.roas) },
              { label: "CPL", value: fmtRM(reportData.tm.cpl) },
            ].map((m) => (
              <div key={m.label} className="bg-[#FAFAF9] rounded-lg p-3">
                <div className="text-[10px] uppercase tracking-widest text-[#78716C] font-[family-name:var(--font-geist-mono)]">{m.label}</div>
                <div className="text-lg font-bold text-[#1C1917] font-[family-name:var(--font-geist-mono)]">{m.value}</div>
              </div>
            ))}
          </div>
          <p className="text-sm text-[#78716C]">Full HTML report rendering coming in Phase 2.</p>
        </div>
      )}
    </div>
  );
}
