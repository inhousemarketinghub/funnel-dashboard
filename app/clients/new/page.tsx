"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { SheetScanResult } from "@/lib/sheet-scanner";

function extractSheetId(input: string): string {
  const match = input.match(/\/d\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : input.trim();
}

export default function NewClientPage() {
  const [sheetLink, setSheetLink] = useState("");
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<SheetScanResult | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleScan() {
    const sheetId = extractSheetId(sheetLink);
    if (!sheetId) return;

    setScanning(true);
    setScanError(null);
    setScanResult(null);

    try {
      const res = await fetch("/api/scan-sheet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sheetId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Scan failed");
      setScanResult(data);

      // Auto-fill name from first brand (if single brand) or leave empty for multi
      if (data.brands.length === 1 && data.brands[0].name !== "(Default)") {
        setName(data.brands[0].name);
      }
    } catch (err) {
      setScanError(err instanceof Error ? err.message : "Failed to scan sheet");
    } finally {
      setScanning(false);
    }
  }

  async function handleCreate() {
    if (!scanResult || !name.trim()) return;
    setCreating(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setCreating(false); return; }

    let { data: agency } = await supabase.from("agencies").select("id").eq("email", user.email).single();
    if (!agency) {
      const { data } = await supabase.from("agencies").insert({ email: user.email!, name: user.email!.split("@")[0] }).select("id").single();
      agency = data;
    }
    if (!agency) { setCreating(false); return; }

    const sheetId = extractSheetId(sheetLink);
    const { data: client } = await supabase.from("clients").insert({
      agency_id: agency.id,
      name: name.trim(),
      sheet_id: sheetId,
      funnel_type: scanResult.funnelType,
    }).select("id").single();

    if (client) {
      const now = new Date();
      const month = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
      await supabase.from("kpi_configs").insert({ client_id: client.id, month });
      router.push(`/${client.id}`);
    }
    setCreating(false);
  }

  return (
    <div className="min-h-dvh bg-[var(--bg)] p-8 flex justify-center">
      <div className="bauhaus-stripe" style={{ position: "fixed", top: 0, left: 0, right: 0 }}><div /><div /><div /><div /></div>
      <div className="card-base w-full max-w-lg h-fit mt-12" style={{ padding: 28 }}>
        <h1 className="font-heading text-[22px] font-semibold tracking-tight text-[var(--t1)] mb-6">Add New Project</h1>

        {/* Step 1: Sheet Link + Scan */}
        <div className="mb-4">
          <Label className="text-[var(--t3)] text-sm">Google Sheet Link</Label>
          <div className="flex gap-2 mt-1">
            <Input
              placeholder="https://docs.google.com/spreadsheets/d/..."
              value={sheetLink}
              onChange={(e) => { setSheetLink(e.target.value); setScanResult(null); setScanError(null); }}
              className="border-[var(--border)] focus-visible:ring-[var(--blue)] num text-sm flex-1"
            />
            <Button
              onClick={handleScan}
              disabled={!sheetLink.trim() || scanning}
              className="bg-[var(--blue)] hover:bg-[#153D7A] text-white px-4 shrink-0"
            >
              {scanning ? "Scanning..." : "Scan"}
            </Button>
          </div>
          <p className="text-xs text-[var(--t4)] mt-1">Paste the full Google Sheet URL. We&apos;ll auto-detect brands and funnel type.</p>
        </div>

        {/* Scan Error */}
        {scanError && (
          <div className="mb-4 p-3 rounded-[8px] border border-[var(--red)] bg-[var(--red-bg)] text-[var(--red)] text-[12px]">
            {scanError}
          </div>
        )}

        {/* Step 2: Scan Results */}
        {scanResult && (
          <div className="space-y-4">
            {/* Detection Summary */}
            <div className="p-4 rounded-[10px] bg-[var(--bg3)] border border-[var(--border)]">
              <div className="text-[13px] font-semibold text-[var(--t1)] mb-3">Sheet Detected</div>

              {/* Brands */}
              <div className="mb-3">
                <div className="font-label text-[10px] uppercase tracking-widest text-[var(--t4)] mb-1">
                  Brands ({scanResult.brands.length})
                </div>
                <div className="space-y-1">
                  {scanResult.brands.map((b) => (
                    <div key={b.name} className="flex items-center gap-2 text-[12px]">
                      <span className="w-[6px] h-[6px] rounded-full bg-[var(--green)]" />
                      <span className="text-[var(--t1)]">{b.name}</span>
                      <span className="tag tag-blue text-[9px]">{b.funnelType}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Status checks */}
              <div className="flex gap-4 text-[11px]">
                <span className={scanResult.hasKPI ? "text-[var(--green)]" : "text-[var(--red)]"}>
                  {scanResult.hasKPI ? "✓" : "✗"} KPI Indicator
                </span>
                <span className={scanResult.hasLeadTracker ? "text-[var(--green)]" : "text-[var(--red)]"}>
                  {scanResult.hasLeadTracker ? "✓" : "✗"} Lead Tracker
                </span>
              </div>
            </div>

            {/* Client Name */}
            <div>
              <Label className="text-[var(--t3)] text-sm">Client Name</Label>
              <Input
                placeholder={scanResult.brands.length > 1 ? "e.g. Carress Shop" : "e.g. Dream Crafter"}
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="border-[var(--border)] focus-visible:ring-[var(--blue)]"
              />
              {scanResult.brands.length > 1 && (
                <p className="text-xs text-[var(--t4)] mt-1">
                  This name represents the overall account. You can switch between brands in the dashboard.
                </p>
              )}
            </div>

            {/* Create */}
            <Button
              onClick={handleCreate}
              disabled={!name.trim() || creating}
              className="w-full bg-[var(--blue)] hover:bg-[#153D7A] text-white active:translate-y-px transition-transform"
            >
              {creating ? "Creating..." : `Create Client${scanResult.brands.length > 1 ? ` (${scanResult.brands.length} brands)` : ""}`}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
