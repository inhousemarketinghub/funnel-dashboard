"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { OnboardingState } from "@/lib/types";
import type { SheetScanResult } from "@/lib/sheet-scanner";

function extractSheetId(input: string): string {
  const match = input.match(/\/d\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : input.trim();
}

interface Props {
  state: OnboardingState;
  setState: React.Dispatch<React.SetStateAction<OnboardingState>>;
  next: () => void;
  back: () => void;
}

export function StepConnectSheet({ state, setState, next, back }: Props) {
  const [sheetUrl, setSheetUrl] = useState(
    state.sheetId
      ? `https://docs.google.com/spreadsheets/d/${state.sheetId}`
      : ""
  );
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);

  async function handleScan() {
    const sheetId = extractSheetId(sheetUrl);
    if (!sheetId) return;

    setScanning(true);
    setScanError(null);
    setState((s) => ({ ...s, scanResult: null, sheetId: "" }));

    try {
      const res = await fetch("/api/scan-sheet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sheetId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Scan failed");

      const result = data as SheetScanResult;
      setState((s) => ({
        ...s,
        sheetId,
        scanResult: result,
        // Auto-fill name if single brand detected and name not already set
        name:
          !s.name &&
          result.brands.length === 1 &&
          result.brands[0].name !== "(Default)"
            ? result.brands[0].name
            : s.name,
      }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to scan sheet";
      setScanError(
        `${msg}. Make sure the sheet is shared as "Anyone with the link can view" and contains Performance Tracker + Lead & Sales Tracker tabs.`
      );
    } finally {
      setScanning(false);
    }
  }

  const scanResult = state.scanResult;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-heading text-[20px] font-semibold text-[var(--t1)] mb-1">
          Connect Sheet
        </h2>
        <p className="text-[13px] text-[var(--t3)]">
          Paste your Google Sheet link and we&apos;ll auto-detect brands and funnel type.
        </p>
      </div>

      {/* URL Input + Scan */}
      <div className="space-y-1">
        <Label className="text-[var(--t2)] text-[13px] font-medium">
          Google Sheet Link
        </Label>
        <div className="flex gap-2">
          <Input
            placeholder="https://docs.google.com/spreadsheets/d/..."
            value={sheetUrl}
            onChange={(e) => {
              setSheetUrl(e.target.value);
              setScanError(null);
              setState((s) => ({ ...s, scanResult: null, sheetId: "" }));
            }}
            className="border-[var(--border)] focus-visible:ring-[var(--blue)] num text-sm flex-1"
          />
          <Button
            onClick={handleScan}
            disabled={!sheetUrl.trim() || scanning}
            className="bg-[var(--blue)] hover:bg-[#153D7A] text-white px-5 shrink-0 min-w-[90px]"
          >
            {scanning ? (
              <span className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Scanning
              </span>
            ) : (
              "Scan"
            )}
          </Button>
        </div>
        <p className="text-[11px] text-[var(--t4)]">
          Ensure the sheet is shared as &ldquo;Anyone with the link can view.&rdquo;
        </p>
      </div>

      {/* Scan Error */}
      {scanError && (
        <div
          className="p-3 rounded-[8px] border text-[12px]"
          style={{
            borderColor: "var(--red)",
            background: "var(--red-bg)",
            color: "var(--red)",
          }}
        >
          {scanError}
        </div>
      )}

      {/* Scan Results */}
      {scanResult && (
        <div
          className="p-4 rounded-[10px] border space-y-3"
          style={{ background: "var(--bg3)", borderColor: "var(--border)" }}
        >
          <div className="text-[13px] font-semibold text-[var(--t1)]">
            Sheet Detected
          </div>

          {/* Tabs found */}
          <div className="flex gap-4 text-[11px]">
            <span
              style={{
                color: scanResult.hasKPI ? "var(--green)" : "var(--red)",
              }}
            >
              {scanResult.hasKPI ? "✓" : "✗"} KPI Indicator
            </span>
            <span
              style={{
                color: scanResult.hasLeadTracker
                  ? "var(--green)"
                  : "var(--red)",
              }}
            >
              {scanResult.hasLeadTracker ? "✓" : "✗"} Lead Tracker
            </span>
          </div>

          {/* Brands */}
          <div>
            <div
              className="font-label text-[10px] uppercase tracking-widest mb-1"
              style={{ color: "var(--t4)" }}
            >
              Brands ({scanResult.brands.length})
            </div>
            <div className="space-y-1">
              {scanResult.brands.map((b) => (
                <div key={b.name} className="flex items-center gap-2 text-[12px]">
                  <span
                    className="w-[6px] h-[6px] rounded-full"
                    style={{ background: "var(--green)" }}
                  />
                  <span style={{ color: "var(--t1)" }}>{b.name}</span>
                  <span className="tag tag-blue text-[9px]">{b.funnelType}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Funnel type */}
          <div className="text-[11px]" style={{ color: "var(--t3)" }}>
            Funnel type:{" "}
            <span className="font-semibold" style={{ color: "var(--t1)" }}>
              {scanResult.funnelType}
            </span>
          </div>
        </div>
      )}

      {/* Nav */}
      <div className="flex justify-between pt-2">
        <button type="button" onClick={back} className="topbar-btn">
          ← Back
        </button>
        <Button
          onClick={next}
          disabled={!scanResult}
          className="bg-[var(--blue)] hover:bg-[#153D7A] text-white px-6"
        >
          Next →
        </Button>
      </div>
    </div>
  );
}
