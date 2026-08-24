"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { parseProfile, ALIAS_METRICS, type AliasMetric, type ClientProfile } from "@/lib/profile";
import type { Lang } from "@/lib/i18n";

// Admin-only section with self-contained strings — same local-dict pattern as
// the rest of Settings (keyed by the English source string).
const P_ZH: Record<string, string> = {
  "Project Profile": "项目档案",
  "Client-specific rules live here instead of in code. Fields marked Phase 2 take effect once the database pipeline is switched on.": "客户的特殊规则记在这里,不再写死在代码里。标注 Phase 2 的项目会在数据库管道启用后生效。",
  "Funnel type": "漏斗类型",
  "Auto (infer from sheet headers)": "自动(按表头推断)",
  "Appointment": "预约型 (appointment)",
  "Walk-in": "到店型 (walk-in)",
  "Paid Ads sources": "Paid Ads 来源清单",
  "Comma-separated, e.g. Facebook, Instagram, WhatsApp": "逗号分隔,例如 Facebook, Instagram, WhatsApp",
  "Column aliases": "列别名",
  "Teach the parser this client's column names, e.g. orders = Signed Up": "告诉程式这个客户的列叫什么,例如 orders = Signed Up",
  "Metric": "指标",
  "Alias keyword": "别名关键字",
  "Add alias": "+ 添加别名",
  "Remove": "移除",
  "Data source": "数据源",
  "Google Sheets (current)": "Google Sheets(现行)",
  "Database mirror — enabled per client in Phase 3": "数据库镜像 —— Phase 3 逐客户启用",
  "Save Profile": "保存档案",
  "Saving...": "保存中...",
  "Profile saved": "档案已保存",
  "Failed to save profile": "档案保存失败",
  "Failed to load profile": "档案读取失败",
  "Phase 2": "Phase 2",
};

const METRIC_LABELS: Record<AliasMetric, string> = {
  inquiry: "Inquiry / PM", contact: "Contact / Visit", appointment: "Appointment",
  estShowup: "Est.Show Up", showup: "Showed Up", orders: "Orders", sales: "Sales",
};

interface AliasRow { metric: AliasMetric; keyword: string }

const FIELD =
  "text-[13px] py-[6px] px-3 rounded-[6px] border border-[var(--border)] bg-[var(--bg1)] text-[var(--t1)] outline-none focus:border-[var(--border-hover)]";
const PHASE2 =
  "ml-2 inline-block rounded-full bg-[var(--bg3)] px-2 py-[1px] text-[10px] text-[var(--t4)]";

export function ProfileEditor({ clientId, lang }: { clientId: string; lang: Lang }) {
  const tl = (s: string) => (lang === "zh" && P_ZH[s]) || s;
  const [funnelType, setFunnelType] = useState<"" | "appointment" | "walkin">("");
  const [paidSources, setPaidSources] = useState("");
  const [aliasRows, setAliasRows] = useState<AliasRow[]>([]);
  const [dataSource, setDataSource] = useState<"sheets" | "db">("sheets");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const supabase = createClient();
        const { data } = await supabase.from("clients").select("profile").eq("id", clientId).single();
        const p = parseProfile(data?.profile);
        setFunnelType(p.funnel_type ?? "");
        setPaidSources((p.paid_sources ?? []).join(", "));
        setDataSource(p.data_source ?? "sheets");
        const rows: AliasRow[] = [];
        for (const m of ALIAS_METRICS) {
          for (const kw of p.column_aliases?.[m] ?? []) rows.push({ metric: m, keyword: kw });
        }
        setAliasRows(rows);
      } catch {
        toast.error(tl("Failed to load profile"));
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  function buildProfile(): ClientProfile {
    const aliases: Partial<Record<AliasMetric, string[]>> = {};
    for (const r of aliasRows) {
      const kw = r.keyword.trim().toLowerCase();
      if (!kw) continue;
      (aliases[r.metric] ??= []).push(kw);
    }
    return parseProfile({
      funnel_type: funnelType || undefined,
      paid_sources: paidSources.split(",").map((s) => s.trim()).filter(Boolean),
      column_aliases: aliases,
      data_source: dataSource,
    });
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, profile: buildProfile() }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error || `HTTP ${res.status}`);
      toast.success(tl("Profile saved"));
    } catch (err) {
      toast.error(`${tl("Failed to save profile")}: ${err instanceof Error ? err.message : ""}`);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return null;

  return (
    <div className="mb-6 bg-[var(--bg2)] border border-[var(--border)] rounded-[10px] p-6">
      <h2 className="font-semibold text-[15px] tracking-tight text-[var(--t1)] mb-1">{tl("Project Profile")}</h2>
      <p className="text-[12px] text-[var(--t4)] mb-5">
        {tl("Client-specific rules live here instead of in code. Fields marked Phase 2 take effect once the database pipeline is switched on.")}
      </p>

      <div className="flex flex-col gap-5">
        {/* Funnel type */}
        <div>
          <label className="block text-[12px] font-medium text-[var(--t3)] mb-1.5">
            {tl("Funnel type")}<span className={PHASE2}>{tl("Phase 2")}</span>
          </label>
          <select className={FIELD} value={funnelType} onChange={(e) => setFunnelType(e.target.value as typeof funnelType)}>
            <option value="">{tl("Auto (infer from sheet headers)")}</option>
            <option value="appointment">{tl("Appointment")}</option>
            <option value="walkin">{tl("Walk-in")}</option>
          </select>
        </div>

        {/* Paid sources */}
        <div>
          <label className="block text-[12px] font-medium text-[var(--t3)] mb-1.5">{tl("Paid Ads sources")}</label>
          <input
            className={`${FIELD} w-full max-w-[420px]`}
            value={paidSources}
            onChange={(e) => setPaidSources(e.target.value)}
            placeholder={tl("Comma-separated, e.g. Facebook, Instagram, WhatsApp")}
          />
        </div>

        {/* Column aliases */}
        <div>
          <label className="block text-[12px] font-medium text-[var(--t3)] mb-1.5">
            {tl("Column aliases")}<span className={PHASE2}>{tl("Phase 2")}</span>
          </label>
          <p className="text-[11px] text-[var(--t4)] mb-2">{tl("Teach the parser this client's column names, e.g. orders = Signed Up")}</p>
          <div className="flex flex-col gap-2">
            {aliasRows.map((row, i) => (
              <div key={i} className="flex items-center gap-2">
                <select
                  className={FIELD}
                  value={row.metric}
                  onChange={(e) => setAliasRows(aliasRows.map((r, j) => (j === i ? { ...r, metric: e.target.value as AliasMetric } : r)))}
                >
                  {ALIAS_METRICS.map((m) => <option key={m} value={m}>{METRIC_LABELS[m]}</option>)}
                </select>
                <input
                  className={`${FIELD} flex-1 max-w-[240px]`}
                  value={row.keyword}
                  placeholder={tl("Alias keyword")}
                  onChange={(e) => setAliasRows(aliasRows.map((r, j) => (j === i ? { ...r, keyword: e.target.value } : r)))}
                />
                <button
                  className="text-[12px] text-[var(--t4)] hover:text-[var(--red)]"
                  onClick={() => setAliasRows(aliasRows.filter((_, j) => j !== i))}
                >
                  {tl("Remove")}
                </button>
              </div>
            ))}
            <button
              className="self-start text-[12px] text-[var(--t3)] hover:text-[var(--t1)]"
              onClick={() => setAliasRows([...aliasRows, { metric: "orders", keyword: "" }])}
            >
              {tl("Add alias")}
            </button>
          </div>
        </div>

        {/* Data source (display-only until Phase 3) */}
        <div>
          <label className="block text-[12px] font-medium text-[var(--t3)] mb-1.5">{tl("Data source")}</label>
          <div className="flex items-center gap-2 text-[13px] text-[var(--t2)]">
            <span className="inline-block rounded-full bg-[var(--bg3)] px-3 py-1">
              {dataSource === "db" ? tl("Database mirror — enabled per client in Phase 3") : tl("Google Sheets (current)")}
            </span>
          </div>
        </div>

        <div>
          <button className="topbar-btn" onClick={handleSave} disabled={saving}>
            {saving ? tl("Saving...") : tl("Save Profile")}
          </button>
        </div>
      </div>
    </div>
  );
}
