"use client";
import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Search, CheckSquare, Trash2, RotateCcw, ArchiveRestore, X } from "lucide-react";
import { StatsBar } from "./stats-bar";
import { ClientKpiCard } from "./client-kpi-card";
import { CardReveal } from "@/components/animations/card-reveal";
import { createClient } from "@/lib/supabase/client";
import type { ClientOverview, OverviewStats, ArchivedClient } from "@/lib/types";
import { toast } from "sonner";

type StatusFilter = "all" | "active" | "inactive";
type FunnelFilter = "all" | "walkin" | "appointment";
type SortKey = "status" | "attention" | "name" | "sales" | "achievement";

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
];

const FUNNEL_OPTIONS: { value: FunnelFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "walkin", label: "Walk In" },
  { value: "appointment", label: "Appointment" },
];

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "status", label: "Active first" },
  { value: "attention", label: "Needs attention" },
  { value: "name", label: "Name A–Z" },
  { value: "sales", label: "Sales (high → low)" },
  { value: "achievement", label: "Achievement (high → low)" },
];

function sortClients(list: ClientOverview[], key: SortKey): ClientOverview[] {
  const arr = [...list];
  switch (key) {
    case "name":
      return arr.sort((a, b) => a.name.localeCompare(b.name));
    case "sales":
      return arr.sort((a, b) => b.metrics.sales - a.metrics.sales);
    case "achievement":
      return arr.sort((a, b) => b.achievement.average - a.achievement.average);
    case "attention": {
      const rank = { alert: 0, watch: 1, good: 2 } as const;
      return arr.sort((a, b) => rank[a.health] - rank[b.health]);
    }
    case "status":
    default:
      return arr.sort((a, b) => {
        if (a.status === "active" && b.status !== "active") return -1;
        if (a.status !== "active" && b.status === "active") return 1;
        return 0;
      });
  }
}

export function OverviewShell({
  clients: initialClients,
  stats: _initialStats,
  isOwner = false,
  archived: initialArchived = [],
}: {
  clients: ClientOverview[];
  stats: OverviewStats;
  isOwner?: boolean;
  archived?: ArchivedClient[];
}) {
  const router = useRouter();
  const [clients, setClients] = useState(initialClients);
  const [archived, setArchived] = useState<ArchivedClient[]>(initialArchived);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [confirmName, setConfirmName] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [funnelFilter, setFunnelFilter] = useState<FunnelFilter>("all");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("status");
  const [view, setView] = useState<"active" | "archived">("active");
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

  const q = search.trim().toLowerCase();
  const filtered = clients.filter((c) => {
    if (statusFilter !== "all" && c.status !== statusFilter) return false;
    if (funnelFilter !== "all" && c.funnel_type !== funnelFilter) return false;
    if (q && !c.name.toLowerCase().includes(q)) return false;
    return true;
  });

  const dynamicStats: OverviewStats = useMemo(() => ({
    activeClients: filtered.filter((c) => c.status === "active").length,
    needAttention: filtered.filter((c) => c.health === "alert").length,
    totalAdSpend: filtered.reduce((sum, c) => sum + c.metrics.ad_spend, 0),
    totalSales: filtered.reduce((sum, c) => sum + c.metrics.sales, 0),
  }), [filtered]);

  const sorted = useMemo(() => sortClients(filtered, sortKey), [filtered, sortKey]);

  async function handleToggleStatus(id: string, newStatus: "active" | "inactive") {
    const supabase = createClient();
    const { error } = await supabase.from("clients").update({ status: newStatus }).eq("id", id);
    if (error) { toast.error("Failed to update status"); return; }
    setClients((prev) => prev.map((c) => (c.id === id ? { ...c, status: newStatus } : c)));
  }

  function moveToArchived(list: ClientOverview[]) {
    const moved: ArchivedClient[] = list.map((c) => ({ id: c.id, name: c.name, logo_url: c.logo_url }));
    setArchived((prev) => [...moved, ...prev].sort((a, b) => a.name.localeCompare(b.name)));
  }

  async function handleArchive(id: string) {
    const res = await fetch("/api/client-lifecycle", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId: id, status: "archived" }),
    });
    if (!res.ok) { toast.error("Failed to archive"); return; }
    const target = clients.find((c) => c.id === id);
    setClients((prev) => prev.filter((c) => c.id !== id));
    if (target) moveToArchived([target]);
    toast.success("Project archived — find it in the Recycle bin");
  }

  async function handleBulkArchive() {
    const ids = [...selected];
    if (ids.length === 0) return;
    setBulkBusy(true);
    const ok: string[] = [];
    for (const id of ids) {
      const res = await fetch("/api/client-lifecycle", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId: id, status: "archived" }),
      });
      if (res.ok) ok.push(id);
    }
    const moved = clients.filter((c) => ok.includes(c.id));
    setClients((prev) => prev.filter((c) => !ok.includes(c.id)));
    moveToArchived(moved);
    setSelected(new Set());
    setSelectMode(false);
    setBulkBusy(false);
    toast[ok.length === ids.length ? "success" : "error"](`${ok.length} of ${ids.length} archived`);
  }

  async function handleRestore(id: string) {
    const res = await fetch("/api/client-lifecycle", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId: id, status: "active" }),
    });
    if (!res.ok) { toast.error("Failed to restore"); return; }
    setArchived((prev) => prev.filter((a) => a.id !== id));
    toast.success("Project restored to your active projects");
    router.refresh(); // re-fetch so it reappears with live KPIs
  }

  async function handleDeleteConfirmed() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await fetch("/api/client-lifecycle", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId: deleteTarget.id, status: "archived" }),
      });
      const res = await fetch("/api/client-lifecycle", {
        method: "DELETE", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId: deleteTarget.id, confirmName }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      setClients((prev) => prev.filter((c) => c.id !== deleteTarget.id));
      setArchived((prev) => prev.filter((a) => a.id !== deleteTarget.id));
      toast.success("Project permanently deleted");
      setDeleteTarget(null);
      setConfirmName("");
    } catch (err) {
      toast.error(`Delete failed: ${err instanceof Error ? err.message : ""}`);
    } finally {
      setDeleting(false);
    }
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const CTRL = "flex h-9 items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--bg2)] px-3 text-[12px] font-medium text-[var(--t2)] transition-colors hover:bg-[var(--bg3)]";

  // ── Recycle bin view ──
  if (view === "archived") {
    return (
      <>
        <div className="mb-5 flex items-center gap-3">
          <button onClick={() => setView("active")} className={CTRL}>
            <X className="h-4 w-4" /> Back to projects
          </button>
          <h2 className="font-heading text-[18px] font-semibold text-[var(--t1)]">Recycle bin</h2>
          <span className="text-[12px] text-[var(--t4)]">{archived.length} archived</span>
        </div>
        {archived.length === 0 ? (
          <div className="py-16 text-center text-[14px] text-[var(--t3)]">Nothing archived.</div>
        ) : (
          <div className="flex flex-col gap-2">
            {archived.map((a) => (
              <div key={a.id} className="card-base flex items-center justify-between gap-3" style={{ padding: 14 }}>
                <div className="flex min-w-0 items-center gap-3">
                  {a.logo_url ? (
                    <img src={a.logo_url} alt="" className="h-8 w-8 flex-shrink-0 rounded-[6px] bg-white object-contain p-[2px]" />
                  ) : (
                    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-[6px] text-[13px] font-semibold" style={{ background: "var(--sand)", color: "var(--t2)" }}>
                      {a.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <span className="truncate text-[14px] font-medium text-[var(--t1)]">{a.name}</span>
                </div>
                <div className="flex flex-shrink-0 items-center gap-2">
                  <button onClick={() => handleRestore(a.id)} className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] px-3 py-1.5 text-[12px] font-medium text-[var(--t1)] transition-colors hover:bg-[var(--bg3)]">
                    <RotateCcw className="h-3.5 w-3.5" /> Restore
                  </button>
                  <button onClick={() => { setConfirmName(""); setDeleteTarget({ id: a.id, name: a.name }); }} className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-medium text-[var(--red)] transition-colors hover:bg-[var(--red-bg)]">
                    <Trash2 className="h-3.5 w-3.5" /> Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        {renderDeleteModal()}
      </>
    );
  }

  return (
    <>
      {/* Controls: search + sort + (owner) select + recycle bin */}
      <div className="mb-4 flex flex-wrap items-center gap-2.5">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--t4)]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search projects…"
            className="h-9 w-[220px] rounded-full border border-[var(--border)] bg-[var(--bg2)] pl-9 pr-3 text-[13px] text-[var(--t1)] outline-none transition-colors focus:border-[var(--blue)]"
          />
        </div>
        <select
          value={sortKey}
          onChange={(e) => setSortKey(e.target.value as SortKey)}
          className="h-9 rounded-full border border-[var(--border)] bg-[var(--bg2)] px-3 text-[12px] font-medium text-[var(--t2)] outline-none transition-colors hover:bg-[var(--bg3)]"
        >
          {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>Sort: {o.label}</option>)}
        </select>
        <div className="flex-1" />
        {isOwner && (
          <button onClick={() => { setSelectMode((s) => !s); setSelected(new Set()); }} className={CTRL} style={selectMode ? { borderColor: "var(--blue)", color: "var(--blue)" } : undefined}>
            <CheckSquare className="h-4 w-4" /> {selectMode ? "Done" : "Select"}
          </button>
        )}
        {isOwner && (
          <button onClick={() => setView("archived")} className={CTRL}>
            <ArchiveRestore className="h-4 w-4" /> Recycle bin{archived.length > 0 ? ` (${archived.length})` : ""}
          </button>
        )}
      </div>

      {/* Status / Funnel chips */}
      <div className="mb-5 flex flex-wrap gap-6">
        <div className="flex items-center gap-2">
          <span className="font-label text-[10px] uppercase tracking-wider text-[var(--t4)]">Status</span>
          <div className="flex gap-1">
            {STATUS_OPTIONS.map((opt) => (
              <button key={opt.value} onClick={() => setStatusFilter(opt.value)}
                className="font-label cursor-pointer rounded-full px-3 py-1 text-[11px] transition-colors"
                style={{
                  background: statusFilter === opt.value ? "var(--blue)" : "var(--bg2)",
                  color: statusFilter === opt.value ? "#fff" : "var(--t3)",
                  border: `1px solid ${statusFilter === opt.value ? "var(--blue)" : "var(--border)"}`,
                }}>
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-label text-[10px] uppercase tracking-wider text-[var(--t4)]">Funnel</span>
          <div className="flex gap-1">
            {FUNNEL_OPTIONS.map((opt) => (
              <button key={opt.value} onClick={() => setFunnelFilter(opt.value)}
                className="font-label cursor-pointer rounded-full px-3 py-1 text-[11px] transition-colors"
                style={{
                  background: funnelFilter === opt.value ? "var(--blue)" : "var(--bg2)",
                  color: funnelFilter === opt.value ? "#fff" : "var(--t3)",
                  border: `1px solid ${funnelFilter === opt.value ? "var(--blue)" : "var(--border)"}`,
                }}>
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <StatsBar stats={dynamicStats} />

      {sorted.length > 0 ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {sorted.map((client, i) => (
            <CardReveal key={client.id} delay={i * 100}>
              <ClientKpiCard
                client={client}
                onToggleStatus={handleToggleStatus}
                onArchive={isOwner ? handleArchive : undefined}
                onDelete={isOwner ? (id) => { const t = clients.find((c) => c.id === id); if (t) { setConfirmName(""); setDeleteTarget({ id: t.id, name: t.name }); } } : undefined}
                selectMode={selectMode}
                selected={selected.has(client.id)}
                onSelectToggle={toggleSelect}
              />
            </CardReveal>
          ))}
        </div>
      ) : (
        <div className="py-16 text-center">
          <p className="mb-1 text-[15px] font-medium text-[var(--t2)]">No projects found.</p>
          <button onClick={() => { setStatusFilter("all"); setFunnelFilter("all"); setSearch(""); }} className="mt-2 cursor-pointer text-[13px] text-[var(--blue)]">
            Clear filters
          </button>
        </div>
      )}

      {/* Bulk action bar */}
      {selectMode && selected.size > 0 && (
        <div className="fixed bottom-5 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-full border border-[var(--border)] bg-[var(--bg2)] py-2 pl-5 pr-2 shadow-lg">
          <span className="text-[13px] font-medium text-[var(--t1)]">{selected.size} selected</span>
          <button onClick={handleBulkArchive} disabled={bulkBusy} className="inline-flex items-center gap-1.5 rounded-full bg-[var(--t1)] px-4 py-1.5 text-[13px] font-medium text-[var(--bg)] transition-opacity disabled:opacity-50">
            {bulkBusy ? "Archiving…" : "Archive selected"}
          </button>
          <button onClick={() => { setSelected(new Set()); setSelectMode(false); }} className="flex h-7 w-7 items-center justify-center rounded-full text-[var(--t3)] hover:bg-[var(--bg3)]">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {renderDeleteModal()}
    </>
  );

  function renderDeleteModal() {
    if (!deleteTarget) return null;
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => !deleting && setDeleteTarget(null)}>
        <div className="w-full max-w-[440px] rounded-[12px] border border-[var(--border)] bg-[var(--bg2)] p-6" onClick={(e) => e.stopPropagation()}>
          <h2 className="font-heading text-[20px] font-semibold text-[var(--t1)]">Delete this project?</h2>
          <p className="mt-2 text-[13px] text-[var(--t3)]">
            This permanently removes <span className="font-semibold text-[var(--t1)]">{deleteTarget.name}</span> and
            all of its data — metrics, reports, sync history, notifications and access. This cannot be undone.
          </p>
          <p className="mt-4 text-[12px] text-[var(--t3)]">
            Type <span className="num font-semibold text-[var(--t1)]">{deleteTarget.name}</span> to confirm:
          </p>
          <input
            autoFocus
            value={confirmName}
            onChange={(e) => setConfirmName(e.target.value)}
            className="mt-1.5 w-full rounded-[6px] border border-[var(--border)] bg-[var(--bg1)] px-3 py-2 text-[13px] text-[var(--t1)] outline-none focus:border-[var(--red)]"
            placeholder={deleteTarget.name}
          />
          <div className="mt-5 flex justify-end gap-2">
            <button onClick={() => { setDeleteTarget(null); setConfirmName(""); }} disabled={deleting} className="rounded-full px-5 py-2 text-[13px] text-[var(--t2)] hover:bg-[var(--bg3)]">
              Cancel
            </button>
            <button onClick={handleDeleteConfirmed} disabled={deleting || confirmName.trim() !== deleteTarget.name} className="rounded-full bg-[var(--red)] px-5 py-2 text-[13px] font-medium text-white transition-opacity disabled:opacity-40">
              {deleting ? "Deleting..." : "Delete permanently"}
            </button>
          </div>
        </div>
      </div>
    );
  }
}
