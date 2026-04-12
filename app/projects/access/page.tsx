"use client";

import { useState, useEffect, Suspense, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import Link from "next/link";

interface AccessRecord {
  accessId: string;
  agencyId: string;
  clientId: string;
  email: string;
  name: string;
  permissions: string[];
}

interface Agency { id: string; email: string; name: string; }
interface Client { id: string; name: string; }

const PERMS = [
  { key: "view_dashboard", label: "Dashboard", desc: "View dashboard data" },
  { key: "view_report", label: "Report", desc: "Generate reports" },
  { key: "edit_settings", label: "Settings", desc: "Edit KPI settings" },
  { key: "manage_access", label: "Manage", desc: "Manage user access" },
];

export default function AccessPage() {
  return <Suspense><AccessPageInner /></Suspense>;
}

function AccessPageInner() {
  const searchParams = useSearchParams();
  const initialProject = searchParams.get("project") || "";
  const initialName = searchParams.get("name") || "";

  const [tab, setTab] = useState<"project" | "user">(initialProject ? "project" : "project");
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [allAccess, setAllAccess] = useState<AccessRecord[]>([]);
  const [selectedProject, setSelectedProject] = useState(initialProject);
  const [selectedUser, setSelectedUser] = useState("");
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState<AccessRecord[]>([]);
  const [hasChanges, setHasChanges] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const supabase = createClient();

  const loadAll = useCallback(async () => {
    const [{ data: ags }, { data: cls }, { data: acc }] = await Promise.all([
      supabase.from("agencies").select("id, email, name").order("email"),
      supabase.from("clients").select("id, name").order("name"),
      supabase.from("project_access").select("id, agency_id, client_id, permissions"),
    ]);

    setAgencies(ags || []);
    setClients(cls || []);

    const records: AccessRecord[] = (acc || []).map((a) => {
      const ag = (ags || []).find((x) => x.id === a.agency_id);
      return {
        accessId: a.id,
        agencyId: a.agency_id,
        clientId: a.client_id,
        email: ag?.email || "",
        name: ag?.name || "",
        permissions: (a.permissions as string[]) || ["view_dashboard"],
      };
    });
    setAllAccess(records);
    setDraft(records.map((r) => ({ ...r, permissions: [...r.permissions] })));
    setHasChanges(false);
  }, [supabase]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // Filtered records based on tab + selection
  const filtered = tab === "project"
    ? draft.filter((r) => r.clientId === selectedProject)
    : draft.filter((r) => r.agencyId === selectedUser);

  // Available agencies not yet assigned to selected project
  const assignedIds = new Set(draft.filter((r) => r.clientId === selectedProject).map((r) => r.agencyId));
  const searchResults = agencies.filter((a) =>
    !assignedIds.has(a.id) &&
    search && (a.email.toLowerCase().includes(search.toLowerCase()) || (a.name || "").toLowerCase().includes(search.toLowerCase()))
  );

  function togglePerm(accessId: string, perm: string) {
    setDraft((prev) => prev.map((r) => {
      if (r.accessId !== accessId) return r;
      const newPerms = r.permissions.includes(perm)
        ? r.permissions.filter((p) => p !== perm)
        : [...r.permissions, perm];
      if (!newPerms.includes("view_dashboard")) newPerms.unshift("view_dashboard");
      return { ...r, permissions: newPerms };
    }));
    setHasChanges(true);
  }

  function setFullAccess(accessId: string) {
    setDraft((prev) => prev.map((r) =>
      r.accessId === accessId ? { ...r, permissions: PERMS.map((p) => p.key) } : r
    ));
    setHasChanges(true);
  }

  function addUserToProject(agencyId: string, clientId: string) {
    const ag = agencies.find((a) => a.id === agencyId);
    const tempId = `new-${Date.now()}-${Math.random()}`;
    setDraft((prev) => [...prev, {
      accessId: tempId,
      agencyId,
      clientId,
      email: ag?.email || "",
      name: ag?.name || "",
      permissions: ["view_dashboard"],
    }]);
    setSearch("");
    setHasChanges(true);
  }

  function addProjectToUser(clientId: string) {
    if (!selectedUser) return;
    addUserToProject(selectedUser, clientId);
  }

  function removeAccess(accessId: string) {
    if (!window.confirm("Remove this user's access? Click Save to confirm.")) return;
    setDraft((prev) => prev.filter((r) => r.accessId !== accessId));
    setHasChanges(true);
  }

  async function handleSave() {
    setSaving(true);
    setFeedback(null);

    // Find changes: new records, deleted records, updated permissions
    const origIds = new Set(allAccess.map((r) => r.accessId));
    const draftIds = new Set(draft.map((r) => r.accessId));

    // Deleted
    const deleted = allAccess.filter((r) => !draftIds.has(r.accessId));
    for (const d of deleted) {
      await supabase.from("project_access").delete().eq("id", d.accessId);
    }

    // New
    const added = draft.filter((r) => !origIds.has(r.accessId));
    for (const a of added) {
      await supabase.from("project_access").insert({
        agency_id: a.agencyId,
        client_id: a.clientId,
        permissions: a.permissions,
      });
    }

    // Updated permissions
    const updated = draft.filter((r) => origIds.has(r.accessId));
    for (const u of updated) {
      const orig = allAccess.find((o) => o.accessId === u.accessId);
      if (orig && JSON.stringify(orig.permissions.sort()) !== JSON.stringify(u.permissions.sort())) {
        await supabase.from("project_access").update({ permissions: u.permissions }).eq("id", u.accessId);
      }
    }

    await loadAll();
    setSaving(false);
    setFeedback("Permissions saved successfully");
    setTimeout(() => setFeedback(null), 3000);
  }

  function handleCancel() {
    setDraft(allAccess.map((r) => ({ ...r, permissions: [...r.permissions] })));
    setHasChanges(false);
  }

  const projectName = clients.find((c) => c.id === selectedProject)?.name || initialName;
  const userName = agencies.find((a) => a.id === selectedUser)?.email || "";

  return (
    <div className="min-h-dvh bg-[var(--bg)]">
      <div className="bauhaus-stripe"><div /><div /><div /><div /></div>
      <div className="max-w-3xl mx-auto p-8">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/projects" className="text-[var(--t3)] hover:text-[var(--t1)] text-[13px] transition-colors">&larr; Back</Link>
          <h1 className="font-heading text-[24px] font-semibold tracking-tight text-[var(--t1)]">Manage Access</h1>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 border-b border-[var(--border)]">
          <button onClick={() => setTab("project")}
            className={`text-[13px] font-medium pb-2 px-3 border-b-2 transition-colors ${tab === "project" ? "border-[var(--blue)] text-[var(--t1)]" : "border-transparent text-[var(--t3)] hover:text-[var(--t1)]"}`}>
            By Project
          </button>
          <button onClick={() => setTab("user")}
            className={`text-[13px] font-medium pb-2 px-3 border-b-2 transition-colors ${tab === "user" ? "border-[var(--blue)] text-[var(--t1)]" : "border-transparent text-[var(--t3)] hover:text-[var(--t1)]"}`}>
            By User
          </button>
        </div>

        {/* Selector */}
        <div className="mb-6">
          {tab === "project" ? (
            <select value={selectedProject} onChange={(e) => setSelectedProject(e.target.value)}
              className="w-full h-10 px-3 text-[13px] rounded-[8px] border border-[var(--border)] bg-[var(--bg2)] text-[var(--t1)] outline-none">
              <option value="">Select a project...</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          ) : (
            <select value={selectedUser} onChange={(e) => setSelectedUser(e.target.value)}
              className="w-full h-10 px-3 text-[13px] rounded-[8px] border border-[var(--border)] bg-[var(--bg2)] text-[var(--t1)] outline-none">
              <option value="">Select a user...</option>
              {agencies.map((a) => <option key={a.id} value={a.id}>{a.name || a.email} ({a.email})</option>)}
            </select>
          )}
        </div>

        {/* Feedback */}
        {feedback && (
          <div className="mb-4 p-3 rounded-[8px] bg-[var(--green-bg)] text-[var(--green)] text-[13px] text-center">{feedback}</div>
        )}

        {/* Content */}
        {tab === "project" && selectedProject && (
          <>
            {/* Add user search */}
            <div className="card-base mb-4" style={{ padding: 16 }}>
              <div className="font-label text-[10px] uppercase tracking-widest text-[var(--t4)] mb-2">Add User to {projectName}</div>
              <div className="relative">
                <input type="text" placeholder="Search by email or name..." value={search} onChange={(e) => setSearch(e.target.value)}
                  className="w-full h-9 px-3 text-[12px] rounded-[6px] border border-[var(--border)] bg-[var(--bg2)] text-[var(--t1)] outline-none focus:border-[var(--blue)]" />
                {searchResults.length > 0 && (
                  <div className="absolute top-10 left-0 right-0 bg-[var(--bg2)] border border-[var(--border)] rounded-[6px] shadow-md z-10 max-h-[160px] overflow-y-auto">
                    {searchResults.slice(0, 5).map((a) => (
                      <button key={a.id} onClick={() => addUserToProject(a.id, selectedProject)}
                        className="w-full text-left px-3 py-2 text-[12px] hover:bg-[var(--bg3)] flex justify-between border-b border-[var(--border)] last:border-0">
                        <span className="text-[var(--t1)]">{a.name || a.email} {a.name && <span className="text-[var(--t4)]">{a.email}</span>}</span>
                        <span className="text-[var(--blue)] text-[10px]">+ Add</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* User list */}
            {filtered.length === 0 ? (
              <p className="text-[var(--t4)] text-[13px] text-center py-8">No users assigned to this project</p>
            ) : (
              <div className="space-y-3">
                {filtered.map((r) => (
                  <PermissionCard key={r.accessId} record={r} label={r.name || r.email} sublabel={r.name ? r.email : ""}
                    onToggle={(p) => togglePerm(r.accessId, p)} onFullAccess={() => setFullAccess(r.accessId)} onRemove={() => removeAccess(r.accessId)} />
                ))}
              </div>
            )}
          </>
        )}

        {tab === "user" && selectedUser && (
          <div className="space-y-3">
            {clients.map((c) => {
              const rec = draft.find((r) => r.agencyId === selectedUser && r.clientId === c.id);
              if (rec) {
                return (
                  <PermissionCard key={rec.accessId} record={rec} label={c.name} sublabel=""
                    onToggle={(p) => togglePerm(rec.accessId, p)} onFullAccess={() => setFullAccess(rec.accessId)} onRemove={() => removeAccess(rec.accessId)} />
                );
              }
              return (
                <div key={c.id} className="card-base flex items-center justify-between" style={{ padding: 14 }}>
                  <span className="text-[13px] text-[var(--t3)]">{c.name}</span>
                  <button onClick={() => addProjectToUser(c.id)} className="text-[11px] text-[var(--blue)] hover:underline">+ Assign</button>
                </div>
              );
            })}
          </div>
        )}

        {/* Save / Cancel bar */}
        {hasChanges && (
          <div className="fixed bottom-0 left-0 right-0 bg-[var(--bg2)] border-t border-[var(--border)] p-4 flex justify-center gap-3 z-50" style={{ backdropFilter: "blur(10px)" }}>
            <Button onClick={handleCancel} className="bg-[var(--bg3)] text-[var(--t2)] hover:bg-[var(--border)] px-6">
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving} className="bg-[var(--blue)] hover:bg-[#153D7A] text-white px-6">
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function PermissionCard({ record, label, sublabel, onToggle, onFullAccess, onRemove }: {
  record: AccessRecord; label: string; sublabel: string;
  onToggle: (perm: string) => void; onFullAccess: () => void; onRemove: () => void;
}) {
  return (
    <div className="card-base" style={{ padding: 16 }}>
      <div className="flex items-center justify-between mb-3">
        <div>
          <span className="text-[14px] font-medium text-[var(--t1)]">{label}</span>
          {sublabel && <span className="text-[11px] text-[var(--t4)] ml-2">{sublabel}</span>}
        </div>
        <div className="flex gap-3">
          <button onClick={onFullAccess} className="text-[10px] text-[var(--blue)] hover:underline">Full Access</button>
          <button onClick={onRemove} className="text-[10px] text-[var(--red)] hover:underline">Remove</button>
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {PERMS.map((p) => {
          const checked = record.permissions.includes(p.key);
          const isBase = p.key === "view_dashboard";
          return (
            <label key={p.key} className={`flex items-center gap-2 p-2 rounded-[6px] cursor-pointer transition-colors ${checked ? "bg-[var(--blue-bg)]" : "bg-[var(--bg3)]"} ${isBase ? "opacity-70" : ""}`}>
              <input type="checkbox" checked={checked} disabled={isBase} onChange={() => onToggle(p.key)} className="w-3.5 h-3.5 rounded accent-[var(--blue)]" />
              <div>
                <div className={`text-[11px] font-medium ${checked ? "text-[var(--blue)]" : "text-[var(--t2)]"}`}>{p.label}</div>
                <div className="text-[9px] text-[var(--t4)]">{p.desc}</div>
              </div>
            </label>
          );
        })}
      </div>
    </div>
  );
}
