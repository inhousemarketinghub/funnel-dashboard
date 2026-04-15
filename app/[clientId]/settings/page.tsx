"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

// ── Editable field definitions by funnel type ────────────────

interface FieldDef {
  key: string;
  label: string;
  step: string;
  prefix?: string;
  suffix?: string;
}

const APPOINTMENT_FIELDS: FieldDef[] = [
  { key: "sales", label: "Targeted Sales", step: "100", prefix: "RM" },
  { key: "aov", label: "Targeted AOV", step: "1", prefix: "RM" },
  { key: "cpa_pct", label: "Targeted CPA", step: "0.1", suffix: "%" },
  { key: "conv_rate", label: "Targeted Conversion Rate", step: "1", suffix: "%" },
  { key: "showup_rate", label: "Targeted Show Up Rate", step: "1", suffix: "%" },
  { key: "appt_rate", label: "Targeted Appointment Rate", step: "1", suffix: "%" },
  { key: "respond_rate", label: "Targeted Respond Rate", step: "1", suffix: "%" },
];

const WALKIN_FIELDS: FieldDef[] = [
  { key: "sales", label: "Targeted Sales", step: "100", prefix: "RM" },
  { key: "aov", label: "Targeted AOV", step: "1", prefix: "RM" },
  { key: "cpa_pct", label: "Targeted CPA", step: "0.1", suffix: "%" },
  { key: "conv_rate", label: "Targeted Conversion Rate", step: "1", suffix: "%" },
  { key: "respond_rate", label: "Targeted Visit Rate", step: "1", suffix: "%" },
];

// ── Helpers ──────────────────────────────────────────────────

function fmtRM(v: number) {
  return `RM${v.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ── Derived value display definition ────────────────────────

interface DerivedMetric {
  label: string;
  key: string;
  format: "rm" | "count" | "pct" | "number";
  funnelFilter?: "walkin" | "appointment";
}

const DERIVED_METRICS: DerivedMetric[] = [
  { label: "Targeted Order", key: "orders", format: "count" },
  { label: "CPL (Incl SST)", key: "cpl", format: "rm" },
  { label: "CP.Acquisition (Incl SST)", key: "cp_acquisition", format: "rm" },
  { label: "FB Leads Inquiry", key: "fb_leads", format: "count" },
  { label: "CP.Visit (Incl SST)", key: "cp_visit", format: "rm", funnelFilter: "walkin" },
  { label: "Visit", key: "target_visit", format: "count", funnelFilter: "walkin" },
  { label: "CP.Show Up (Incl SST)", key: "cp_showup", format: "rm", funnelFilter: "appointment" },
  { label: "Show Up", key: "target_showup", format: "count", funnelFilter: "appointment" },
  { label: "CP.Appointment (Incl SST)", key: "cp_appointment", format: "rm", funnelFilter: "appointment" },
  { label: "Appointment", key: "target_appt", format: "count", funnelFilter: "appointment" },
  { label: "CP.Contact Given (Incl SST)", key: "cp_contact", format: "rm", funnelFilter: "appointment" },
  { label: "Contact Given", key: "target_contact", format: "count", funnelFilter: "appointment" },
  { label: "Monthly Ad Spend (Incl SST)", key: "monthly_ad_incl", format: "rm" },
  { label: "Monthly Ad Spend (Excl SST)", key: "monthly_ad_excl", format: "rm" },
  { label: "Targeted Daily Ad Spend (Incl SST)", key: "daily_ad_targeted_incl", format: "rm" },
  { label: "Targeted Daily Ad Spend (Excl SST)", key: "daily_ad_targeted_excl", format: "rm" },
];

function formatDerived(val: number, format: DerivedMetric["format"]) {
  if (format === "rm") return fmtRM(val);
  if (format === "pct") return `${val.toFixed(2)}%`;
  if (format === "count") return String(val);
  return val.toFixed(2);
}

export default function SettingsPage() {
  const { clientId } = useParams<{ clientId: string }>();

  // Core state
  const [form, setForm] = useState<Record<string, number>>({});
  const [sheetDerived, setSheetDerived] = useState<Record<string, number>>({});
  const [funnelType, setFunnelType] = useState<"appointment" | "walkin">("appointment");
  const [brands, setBrands] = useState<string[]>([]);
  const [selectedBrand, setSelectedBrand] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Logo & language state
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [language, setLanguage] = useState<string>("en");

  const fields = funnelType === "walkin" ? WALKIN_FIELDS : APPOINTMENT_FIELDS;
  const visibleDerived = DERIVED_METRICS.filter(
    (m) => !m.funnelFilter || m.funnelFilter === funnelType,
  );

  // ── Real-time derived values from form inputs ─────────────
  // Formula chain: Monthly Ad = Sales × CPA%, then pipeline works backwards from Orders
  const derived = useMemo(() => {
    const sales = form.sales || 0;
    const aov = form.aov || 0;
    const cpaPct = (form.cpa_pct || 0) / 100;
    const convRate = (form.conv_rate || 0) / 100;
    const dailyExcl = form.daily_ad || 0;

    const orders = aov > 0 ? Math.round(sales / aov) : 0;

    // Monthly Ad Spend derived from Sales × CPA%
    const monthlyAdIncl = sales * cpaPct;
    const monthlyAdExcl = monthlyAdIncl / 1.08;

    // Targeted Daily Ad Spend = Monthly Ad Spend / Days in month
    const now = new Date();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const dailyAdTargetedIncl = daysInMonth > 0 ? monthlyAdIncl / daysInMonth : 0;
    const dailyAdTargetedExcl = daysInMonth > 0 ? monthlyAdExcl / daysInMonth : 0;

    // Daily Ad (Incl SST) from the editable current daily budget
    const dailyAdIncl = dailyExcl * 1.08;

    // Funnel pipeline: work backwards from orders
    let pipelineEnd = 0;
    let fbLeads = 0;
    let apptCount = 0;
    let contactCount = 0;

    if (funnelType === "walkin") {
      const visitRate = (form.respond_rate || 0) / 100;
      pipelineEnd = convRate > 0 ? Math.round(orders / convRate) : 0;
      fbLeads = visitRate > 0 ? Math.round(pipelineEnd / visitRate) : 0;
    } else {
      const showupRate = (form.showup_rate || 0) / 100;
      const apptRate = (form.appt_rate || 0) / 100;
      const respondRate = (form.respond_rate || 0) / 100;
      const showups = convRate > 0 ? Math.round(orders / convRate) : 0;
      const appts = showupRate > 0 ? Math.round(showups / showupRate) : 0;
      const contacts = apptRate > 0 ? Math.round(appts / apptRate) : 0;
      fbLeads = respondRate > 0 ? Math.round(contacts / respondRate) : 0;
      pipelineEnd = showups;
      apptCount = appts;
      contactCount = contacts;
    }

    const cpl = fbLeads > 0 ? monthlyAdExcl / fbLeads : 0;
    const cpAcquisition = orders > 0 ? monthlyAdExcl / orders : 0;
    const cpVisit = pipelineEnd > 0 ? monthlyAdExcl / pipelineEnd : 0;
    const cpShowup = pipelineEnd > 0 ? monthlyAdExcl / pipelineEnd : 0;
    const cpAppointment = apptCount > 0 ? monthlyAdExcl / apptCount : 0;
    const cpContact = contactCount > 0 ? monthlyAdExcl / contactCount : 0;

    return {
      orders,
      cpl,
      cp_acquisition: cpAcquisition,
      fb_leads: fbLeads,
      cp_visit: cpVisit,
      target_visit: funnelType === "walkin" ? pipelineEnd : 0,
      cp_showup: cpShowup,
      target_showup: funnelType === "appointment" ? pipelineEnd : 0,
      cp_appointment: cpAppointment,
      target_appt: apptCount,
      cp_contact: cpContact,
      target_contact: contactCount,
      monthly_ad_incl: monthlyAdIncl,
      monthly_ad_excl: monthlyAdExcl,
      daily_ad_targeted_incl: dailyAdTargetedIncl,
      daily_ad_targeted_excl: dailyAdTargetedExcl,
      daily_ad_actual_incl: dailyAdIncl,
      daily_ad_current_excl: dailyExcl,
    };
  }, [form, funnelType]);

  // ── Fetch logo & language on mount ────────────────────────
  useEffect(() => {
    async function fetchClientSettings() {
      const supabase = createClient();
      const { data } = await supabase.from("clients").select("logo_url, language").eq("id", clientId).single();
      if (data?.logo_url) setLogoUrl(data.logo_url);
      if (data?.language) setLanguage(data.language);
    }
    fetchClientSettings();
  }, [clientId]);

  // ── Fetch KPI from Google Sheet ───────────────────────────
  useEffect(() => {
    async function fetchKPI() {
      setLoading(true);
      try {
        const params = new URLSearchParams({ clientId });
        if (selectedBrand) params.set("brand", selectedBrand);

        const res = await fetch(`/api/kpi?${params}`);
        if (!res.ok) throw new Error("Failed to load KPI data");
        const data = await res.json();

        setFunnelType(data.funnelType || "appointment");
        if (data.brands?.length > 0) {
          setBrands(data.brands);
          if (!selectedBrand) setSelectedBrand(data.brands[0]);
        }

        // Populate editable form fields
        const kpi = data.kpi || {};
        const editableKeys = (data.funnelType === "walkin" ? WALKIN_FIELDS : APPOINTMENT_FIELDS).map((f) => f.key);
        const formValues: Record<string, number> = {};
        for (const key of editableKeys) {
          formValues[key] = kpi[key] ?? 0;
        }
        // Use excluded SST value from derived data for Daily Ad Spend Budget
        const derivedData = data.derived || {};
        formValues.daily_ad = derivedData.daily_ad_current_excl ?? kpi.daily_ad ?? 0;
        setForm(formValues);

        setSheetDerived(derivedData);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to load KPI");
      }
      setLoading(false);
    }
    fetchKPI();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId, selectedBrand]);

  // ── Re-fetch derived values from sheet ─────────────────────
  async function refreshDerived() {
    const params = new URLSearchParams({ clientId });
    if (selectedBrand) params.set("brand", selectedBrand);
    const res = await fetch(`/api/kpi?${params}`);
    if (res.ok) {
      const data = await res.json();
      setSheetDerived(data.derived || {});
    }
  }

  // ── Save to Google Sheet + Supabase ───────────────────────
  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch("/api/kpi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          fields: form,
          brand: selectedBrand || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Save failed");
      }

      toast.success("KPI synced to Google Sheet");

      // Re-fetch derived values — sheet formulas recalculate after write
      await refreshDerived();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    }
    setSaving(false);
  }

  function handleChange(key: string, value: string) {
    setForm((prev) => ({ ...prev, [key]: value === "" ? 0 : Number(value) }));
  }

  // ── Logo handlers ─────────────────────────────────────────
  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const supabase = createClient();
    const ext = file.name.split(".").pop() || "png";
    const path = `${clientId}.${ext}`;

    const { error: uploadErr } = await supabase.storage.from("logos").upload(path, file, { upsert: true });
    if (uploadErr) {
      toast.error("Failed to upload logo: " + uploadErr.message);
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage.from("logos").getPublicUrl(path);
    const publicUrl = urlData.publicUrl;

    const { error: updateErr } = await supabase.from("clients").update({ logo_url: publicUrl }).eq("id", clientId);
    if (updateErr) {
      toast.error("Failed to update logo URL");
    } else {
      setLogoUrl(publicUrl);
      toast.success("Logo uploaded");
    }
    setUploading(false);
  }

  async function handleLogoDelete() {
    if (!logoUrl) return;
    setUploading(true);
    const supabase = createClient();
    const urlParts = logoUrl.split("/logos/");
    const filePath = urlParts[urlParts.length - 1];
    if (filePath) {
      await supabase.storage.from("logos").remove([filePath]);
    }

    const { error } = await supabase.from("clients").update({ logo_url: null }).eq("id", clientId);
    if (error) {
      toast.error("Failed to remove logo");
    } else {
      setLogoUrl(null);
      toast.success("Logo removed");
    }
    setUploading(false);
  }

  async function handleLanguageChange(val: string) {
    setLanguage(val);
    const supabase = createClient();
    const { error } = await supabase.from("clients").update({ language: val }).eq("id", clientId);
    if (error) {
      toast.error("Failed to update language");
    } else {
      toast.success("Language updated");
    }
  }

  return (
    <div className="max-w-[800px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <Link
            href={`/${clientId}`}
            className="text-sm text-[var(--t3)] hover:text-[var(--t1)] transition-colors"
          >
            &larr; Dashboard
          </Link>
          <h1 className="font-heading font-bold text-2xl text-[var(--t1)] dark:text-[var(--t1)] tracking-tight">
            Settings
          </h1>
        </div>
      </div>

      {/* Logo Upload */}
      <div className="mb-6 bg-[var(--bg2)] border border-[var(--border)] rounded-[10px] p-6">
        <h2 className="font-semibold text-[15px] tracking-tight text-[var(--t1)] dark:text-[var(--t1)] mb-4">Client Logo</h2>
        <div className="flex items-center gap-5">
          {logoUrl ? (
            <img src={logoUrl} alt="Logo" className="w-20 h-20 rounded-[10px] object-contain border border-[var(--border)] bg-white p-1" />
          ) : (
            <div className="w-20 h-20 rounded-[10px] bg-[var(--sand)] flex items-center justify-center text-[var(--t4)] text-[11px] font-label uppercase">
              No Logo
            </div>
          )}
          <div className="flex flex-col gap-2">
            <label className="topbar-btn inline-flex cursor-pointer">
              {uploading ? "Uploading..." : "Upload Logo"}
              <input
                type="file"
                accept="image/*"
                onChange={handleLogoUpload}
                className="hidden"
                disabled={uploading}
              />
            </label>
            {logoUrl && (
              <button
                onClick={handleLogoDelete}
                disabled={uploading}
                className="text-[12px] text-[var(--red)] hover:underline text-left cursor-pointer"
              >
                Remove Logo
              </button>
            )}
            <p className="text-[11px] text-[var(--t4)]">PNG, JPG, or SVG. Max 2MB.</p>
          </div>
        </div>
      </div>

      {/* Summary Language */}
      <div className="mb-6 bg-[var(--bg2)] border border-[var(--border)] rounded-[10px] p-6">
        <h2 className="font-semibold text-[15px] tracking-tight text-[var(--t1)] mb-4">Summary Language</h2>
        <Select value={language} onValueChange={(val) => { if (val) handleLanguageChange(val); }}>
          <SelectTrigger className="w-[220px] border-[var(--border)] focus-visible:ring-[var(--blue)]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="en">English</SelectItem>
            <SelectItem value="zh">中文</SelectItem>
            <SelectItem value="ms">Bahasa Melayu</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-[11px] text-[var(--t4)] mt-2">Language for the Performance Summary section on the dashboard.</p>
      </div>

      {/* KPI Content */}
      {loading ? (
        <div className="text-center text-[var(--t3)] py-12">Loading KPI from Google Sheet...</div>
      ) : (
        <>
          {/* Brand Selector (multi-brand only) */}
          {brands.length > 1 && (
            <div className="mb-6">
              <Label className="text-sm text-[var(--t3)] mb-2">Brand</Label>
              <Select
                value={selectedBrand}
                onValueChange={(val) => { if (val) setSelectedBrand(val); }}
              >
                <SelectTrigger className="w-[220px] border-[var(--border)] focus-visible:ring-[var(--blue)]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {brands.map((b) => (
                    <SelectItem key={b} value={b}>{b}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Section 1: KPI Targets (editable) */}
          <div className="bg-[var(--bg2)] border border-[var(--border)] rounded-[10px] p-6 mb-6">
            <div className="flex items-center gap-3 mb-4">
              <h2 className="font-bold text-[15px] tracking-tight text-[var(--t1)] dark:text-[var(--t1)]">
                KPI Targets
              </h2>
              <span className="text-[10px] font-label uppercase tracking-wider text-[var(--blue)] bg-[var(--blue)]/10 px-2 py-0.5 rounded-full">
                Synced from Google Sheet
              </span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {fields.map((field) => (
                <div key={field.key}>
                  <Label className="text-sm text-[var(--t3)] mb-1">
                    {field.label}
                    {field.prefix && (
                      <span className="text-xs text-[var(--t3)]/60 ml-1">({field.prefix})</span>
                    )}
                    {field.suffix && (
                      <span className="text-xs text-[var(--t3)]/60 ml-1">({field.suffix})</span>
                    )}
                  </Label>
                  <Input
                    type="number"
                    step={field.step}
                    min="0"
                    value={form[field.key] || ""}
                    onChange={(e) => handleChange(field.key, e.target.value)}
                    className="num border-[var(--border)] focus-visible:ring-[var(--blue)]"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Section 2: Derived Values (read-only, from sheet formulas) */}
          <div className="bg-[var(--bg2)] border border-[var(--border)] rounded-[10px] p-6 mb-6 opacity-80">
            <h2 className="font-bold text-[15px] tracking-tight text-[var(--t1)] dark:text-[var(--t1)] mb-4">
              Derived Values
              <span className="text-[10px] font-label uppercase tracking-wider text-[var(--t4)] ml-2">Auto-calculated</span>
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {visibleDerived.map((m) => (
                <div key={m.key}>
                  <div className="text-[11px] text-[var(--t4)] uppercase tracking-wider mb-1">{m.label}</div>
                  <div className="num text-[15px] font-semibold text-[var(--t1)]">
                    {formatDerived((derived as Record<string, number>)[m.key] ?? 0, m.format)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Section 3: Daily Ad Spend Budget */}
          <div className="bg-[var(--bg2)] border border-[var(--border)] rounded-[10px] p-6 mb-6">
            <h2 className="font-bold text-[15px] tracking-tight text-[var(--t1)] dark:text-[var(--t1)] mb-4">
              Daily Ad Spend Budget
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm text-[var(--t3)] mb-1">
                  Current Daily Ad Spend
                  <span className="text-xs text-[var(--t3)]/60 ml-1">(Excluded 8% SST)</span>
                </Label>
                <Input
                  type="number"
                  step="10"
                  min="0"
                  value={form.daily_ad || ""}
                  onChange={(e) => handleChange("daily_ad", e.target.value)}
                  className="num border-[var(--border)] focus-visible:ring-[var(--blue)]"
                />
              </div>
              <div>
                <div className="text-sm text-[var(--t3)] mb-1">
                  Actual Daily Ad Spend
                  <span className="text-xs text-[var(--t3)]/60 ml-1">(Included 8% SST)</span>
                </div>
                <div className="num text-[20px] font-semibold text-[var(--t1)] mt-1.5">
                  {fmtRM(derived.daily_ad_actual_incl ?? 0)}
                </div>
              </div>
            </div>
          </div>

          {/* Save Button */}
          <div className="flex justify-end mb-12">
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-[var(--blue)] hover:bg-[#153D7A] text-white px-6"
            >
              {saving ? "Syncing..." : "Save & Sync to Sheet"}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
