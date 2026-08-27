"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import type { Lang } from "@/lib/i18n";

// Slim general settings: project identity + connections. Planning tools live
// in Ads Projection; client-specific parsing rules in Project Customization.
const S_ZH: Record<string, string> = {
  "Settings": "设置",
  // Project name
  "Project Name": "项目名称",
  "Shown everywhere — sidebar, overview cards, reports.": "显示在侧栏、总览卡片、月报等所有地方。",
  "Save Name": "保存名称",
  "Saving...": "保存中…",
  "Name updated": "名称已更新",
  "Failed to update name": "更新名称失败",
  // Logo
  "Client Logo": "客户 Logo",
  "Upload Logo": "上传 Logo", "Uploading...": "上传中…", "Remove Logo": "移除 Logo", "No Logo": "无 Logo",
  "PNG, JPG, or SVG. Max 2MB.": "PNG、JPG 或 SVG,最大 2MB。",
  "Failed to update logo URL": "更新 Logo 链接失败",
  "Logo uploaded": "Logo 已上传", "Failed to remove logo": "移除 Logo 失败", "Logo removed": "Logo 已移除",
  "Failed to upload logo: ": "上传 Logo 失败:",
  // Data connection
  "Data Connection": "数据连接",
  "This project reads from the Google Sheet below. Changing it re-points every number — only managers can edit.": "本项目的数据来自下面这个 Google Sheet。更换后所有数字都会指向新表格 —— 仅管理权限可编辑。",
  "Open Google Sheet": "打开 Google Sheet",
  "Paste a Google Sheet link or ID": "粘贴 Google Sheet 链接或 ID",
  "Save Link": "保存链接",
  "Sheet link updated": "表格链接已更新",
  "Failed to update sheet link": "更新表格链接失败",
  // Team
  "Team & Access": "团队与权限",
  "Manage who can view or manage this project.": "管理谁可以查看或管理这个项目。",
  "Manage Access": "管理权限",
};

const CARD = "mb-6 bg-[var(--bg2)] border border-[var(--border)] rounded-[10px] p-6";
const H2 = "font-semibold text-[15px] tracking-tight text-[var(--t1)] mb-1";
const HINT = "text-[12px] text-[var(--t4)] mb-4";
const FIELD =
  "text-[13px] py-[6px] px-3 rounded-[6px] border border-[var(--border)] bg-[var(--bg1)] text-[var(--t1)] outline-none focus:border-[var(--border-hover)]";

export function SettingsClient({ lang }: { lang: Lang }) {
  const { clientId } = useParams<{ clientId: string }>();
  const router = useRouter();
  const tl = (s: string) => (lang === "zh" && S_ZH[s]) || s;

  const [name, setName] = useState("");
  const [sheetId, setSheetId] = useState<string | null>(null);
  const [sheetUrlInput, setSheetUrlInput] = useState("");
  const [savingSheet, setSavingSheet] = useState(false);
  const [savingName, setSavingName] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data } = await supabase.from("clients").select("name, logo_url, sheet_id").eq("id", clientId).single();
      if (data) {
        setName(data.name ?? "");
        setLogoUrl(data.logo_url ?? null);
        setSheetId(data.sheet_id ?? null);
        setSheetUrlInput(data.sheet_id ? `https://docs.google.com/spreadsheets/d/${data.sheet_id}` : "");
      }
    })();
  }, [clientId]);

  async function handleSaveName() {
    setSavingName(true);
    try {
      const res = await fetch("/api/client-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, name }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error || `HTTP ${res.status}`);
      toast.success(tl("Name updated"));
      router.refresh(); // sidebar + server-rendered name pick it up
    } catch (err) {
      toast.error(`${tl("Failed to update name")}: ${err instanceof Error ? err.message : ""}`);
    } finally {
      setSavingName(false);
    }
  }

  async function handleSaveSheet() {
    setSavingSheet(true);
    try {
      const res = await fetch("/api/client-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, sheetUrl: sheetUrlInput }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      setSheetId(data.sheet_id);
      setSheetUrlInput(`https://docs.google.com/spreadsheets/d/${data.sheet_id}`);
      toast.success(tl("Sheet link updated"));
      router.refresh();
    } catch (err) {
      toast.error(`${tl("Failed to update sheet link")}: ${err instanceof Error ? err.message : ""}`);
    } finally {
      setSavingSheet(false);
    }
  }

  // ── Logo handlers (moved verbatim from the old combined Settings) ──
  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const supabase = createClient();
    const ext = file.name.split(".").pop() || "png";
    const path = `${clientId}.${ext}`;

    const { error: uploadErr } = await supabase.storage.from("logos").upload(path, file, { upsert: true });
    if (uploadErr) {
      toast.error(tl("Failed to upload logo: ") + uploadErr.message);
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage.from("logos").getPublicUrl(path);
    // Re-using the same storage path with upsert returns a byte-identical URL —
    // a fresh ?v= per upload busts browser/CDN caches everywhere it renders.
    const publicUrl = `${urlData.publicUrl}?v=${Date.now()}`;

    const { error: updateErr } = await supabase.from("clients").update({ logo_url: publicUrl }).eq("id", clientId);
    if (updateErr) {
      toast.error(tl("Failed to update logo URL"));
    } else {
      setLogoUrl(publicUrl);
      toast.success(tl("Logo uploaded"));
    }
    setUploading(false);
  }

  async function handleLogoDelete() {
    if (!logoUrl) return;
    setUploading(true);
    const supabase = createClient();
    const urlParts = logoUrl.split("/logos/");
    // Drop any ?v= cache-buster before deriving the storage object name.
    const filePath = urlParts[urlParts.length - 1]?.split("?")[0];
    if (filePath) {
      await supabase.storage.from("logos").remove([filePath]);
    }
    const { error } = await supabase.from("clients").update({ logo_url: null }).eq("id", clientId);
    if (error) {
      toast.error(tl("Failed to remove logo"));
    } else {
      setLogoUrl(null);
      toast.success(tl("Logo removed"));
    }
    setUploading(false);
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-heading font-bold text-2xl text-[var(--t1)] tracking-tight">{tl("Settings")}</h1>
      </div>

      {/* Project name */}
      <div className={CARD}>
        <h2 className={H2}>{tl("Project Name")}</h2>
        <p className={HINT}>{tl("Shown everywhere — sidebar, overview cards, reports.")}</p>
        <div className="flex items-center gap-2">
          <input className={`${FIELD} w-full max-w-[360px]`} value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
          <button className="topbar-btn" onClick={handleSaveName} disabled={savingName || !name.trim()}>
            {savingName ? tl("Saving...") : tl("Save Name")}
          </button>
        </div>
      </div>

      {/* Logo */}
      <div className={CARD}>
        <h2 className={`${H2} mb-4`}>{tl("Client Logo")}</h2>
        <div className="flex items-center gap-5">
          {logoUrl ? (
            <img src={logoUrl} alt="Logo" className="w-20 h-20 rounded-[10px] object-contain border border-[var(--border)] bg-white p-1" />
          ) : (
            <div className="w-20 h-20 rounded-[10px] bg-[var(--sand)] flex items-center justify-center text-[var(--t4)] text-[11px] font-label uppercase">
              {tl("No Logo")}
            </div>
          )}
          <div className="flex flex-col gap-2">
            <label className="topbar-btn inline-flex cursor-pointer">
              {uploading ? tl("Uploading...") : tl("Upload Logo")}
              <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" disabled={uploading} />
            </label>
            {logoUrl && (
              <button onClick={handleLogoDelete} disabled={uploading} className="text-[12px] text-[var(--red)] hover:underline text-left cursor-pointer">
                {tl("Remove Logo")}
              </button>
            )}
            <p className="text-[11px] text-[var(--t4)]">{tl("PNG, JPG, or SVG. Max 2MB.")}</p>
          </div>
        </div>
      </div>

      {/* Data connection */}
      <div className={CARD}>
        <h2 className={H2}>{tl("Data Connection")}</h2>
        <p className={HINT}>{tl("This project reads from the Google Sheet below. Changing it re-points every number — only managers can edit.")}</p>
        <div className="flex flex-wrap items-center gap-2">
          <input
            className={`${FIELD} w-full max-w-[440px]`}
            value={sheetUrlInput}
            onChange={(e) => setSheetUrlInput(e.target.value)}
            placeholder={tl("Paste a Google Sheet link or ID")}
          />
          <button className="topbar-btn" onClick={handleSaveSheet} disabled={savingSheet || !sheetUrlInput.trim()}>
            {savingSheet ? tl("Saving...") : tl("Save Link")}
          </button>
          {sheetId && (
            <a href={`https://docs.google.com/spreadsheets/d/${sheetId}`} target="_blank" rel="noreferrer" className="topbar-btn inline-flex">
              {tl("Open Google Sheet")}
            </a>
          )}
        </div>
      </div>

      {/* Team & access */}
      <div className={CARD}>
        <h2 className={H2}>{tl("Team & Access")}</h2>
        <p className={HINT}>{tl("Manage who can view or manage this project.")}</p>
        <Link href={`/projects/access?back=/${clientId}/settings`} className="topbar-btn inline-flex">
          {tl("Manage Access")}
        </Link>
      </div>
    </div>
  );
}
