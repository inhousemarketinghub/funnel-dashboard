"use client";

import { useEffect, useState } from "react";
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
import type { KPIConfig } from "@/lib/types";
import { toast } from "sonner";

const DEFAULT_KPI: KPIConfig = {
  sales: 0,
  orders: 0,
  aov: 0,
  cpl: 0,
  respond_rate: 0,
  appt_rate: 0,
  showup_rate: 0,
  conv_rate: 0,
  ad_spend: 0,
  daily_ad: 0,
  roas: 0,
  cpa_pct: 0,
  target_contact: 0,
  target_appt: 0,
  target_showup: 0,
};

function getMonthOptions() {
  const options: { value: string; label: string }[] = [];
  const now = new Date();
  for (let i = -3; i <= 3; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
    const label = d.toLocaleDateString("en-MY", {
      year: "numeric",
      month: "long",
    });
    options.push({ value, label });
  }
  return options;
}

function getCurrentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
}

interface FieldDef {
  key: keyof KPIConfig;
  label: string;
  step: string;
  prefix?: string;
  suffix?: string;
}

const SECTIONS: {
  title: string;
  fields: FieldDef[];
}[] = [
  {
    title: "Revenue Targets",
    fields: [
      { key: "sales", label: "Sales", step: "100", prefix: "RM" },
      { key: "orders", label: "Orders", step: "1" },
      { key: "aov", label: "AOV", step: "1", prefix: "RM" },
    ],
  },
  {
    title: "Ad Performance",
    fields: [
      { key: "ad_spend", label: "Ad Spend", step: "100", prefix: "RM" },
      { key: "daily_ad", label: "Daily Ad", step: "10", prefix: "RM" },
      { key: "cpl", label: "CPL", step: "0.1", prefix: "RM" },
      { key: "roas", label: "ROAS", step: "0.1", suffix: "x" },
    ],
  },
  {
    title: "Funnel Rates",
    fields: [
      { key: "respond_rate", label: "Respond Rate", step: "1", suffix: "%" },
      { key: "appt_rate", label: "Appt Rate", step: "1", suffix: "%" },
      { key: "showup_rate", label: "Show Up Rate", step: "1", suffix: "%" },
      { key: "conv_rate", label: "Conv Rate", step: "1", suffix: "%" },
      { key: "cpa_pct", label: "CPA", step: "1", suffix: "%" },
    ],
  },
  {
    title: "Pipeline Targets",
    fields: [
      { key: "target_contact", label: "Target Contact", step: "1" },
      { key: "target_appt", label: "Target Appt", step: "1" },
      { key: "target_showup", label: "Target Show Up", step: "1" },
    ],
  },
];

export default function SettingsPage() {
  const { clientId } = useParams<{ clientId: string }>();
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth);
  const [form, setForm] = useState<KPIConfig>({ ...DEFAULT_KPI });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [language, setLanguage] = useState<string>("en");

  const monthOptions = getMonthOptions();

  // Fetch logo and language on mount
  useEffect(() => {
    async function fetchClientSettings() {
      const supabase = createClient();
      const { data } = await supabase.from("clients").select("logo_url, language").eq("id", clientId).single();
      if (data?.logo_url) setLogoUrl(data.logo_url);
      if (data?.language) setLanguage(data.language);
    }
    fetchClientSettings();
  }, [clientId]);

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

    // Extract file path from URL
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

  useEffect(() => {
    async function fetchConfig() {
      setLoading(true);
      const supabase = createClient();
      const { data } = await supabase
        .from("kpi_configs")
        .select("*")
        .eq("client_id", clientId)
        .eq("month", selectedMonth)
        .single();

      if (data) {
        const kpi: KPIConfig = { ...DEFAULT_KPI };
        for (const key of Object.keys(DEFAULT_KPI) as (keyof KPIConfig)[]) {
          if (data[key] != null) kpi[key] = Number(data[key]);
        }
        setForm(kpi);
      } else {
        setForm({ ...DEFAULT_KPI });
      }
      setLoading(false);
    }
    fetchConfig();
  }, [clientId, selectedMonth]);

  async function handleSave() {
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.from("kpi_configs").upsert(
      {
        client_id: clientId,
        month: selectedMonth,
        ...form,
      },
      { onConflict: "client_id,month" }
    );

    if (error) {
      toast.error("Failed to save KPI config");
    } else {
      toast.success("KPI config saved");
    }
    setSaving(false);
  }

  function handleChange(key: keyof KPIConfig, value: string) {
    setForm((prev) => ({ ...prev, [key]: value === "" ? 0 : Number(value) }));
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

      {/* Month Selector */}
      <div className="mb-6">
        <Label className="text-sm text-[var(--t3)] mb-2">Month</Label>
        <Select
          value={selectedMonth}
          onValueChange={(val) => { if (val) setSelectedMonth(val); }}
        >
          <SelectTrigger className="w-[220px] border-[var(--border)] focus-visible:ring-[var(--blue)]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {monthOptions.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="text-center text-[var(--t3)] py-12">Loading...</div>
      ) : (
        <>
          {/* KPI Sections */}
          {SECTIONS.map((section) => (
            <div
              key={section.title}
              className="bg-[var(--bg2)] border border-[var(--border)] rounded-[10px] p-6 mb-6"
            >
              <h2 className="font-bold text-[15px] tracking-tight text-[var(--t1)] dark:text-[var(--t1)] mb-4">
                {section.title}
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {section.fields.map((field) => (
                  <div key={field.key}>
                    <Label className="text-sm text-[var(--t3)] mb-1">
                      {field.label}
                      {field.prefix && (
                        <span className="text-xs text-[var(--t3)]/60 ml-1">
                          ({field.prefix})
                        </span>
                      )}
                      {field.suffix && (
                        <span className="text-xs text-[var(--t3)]/60 ml-1">
                          ({field.suffix})
                        </span>
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
          ))}

          {/* Save Button */}
          <div className="flex justify-end mb-12">
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-[var(--blue)] hover:bg-[#153D7A] text-white px-6"
            >
              {saving ? "Saving..." : "Save KPI Config"}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
