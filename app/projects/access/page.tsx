"use client";

import { useState, useEffect, Suspense, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import Link from "next/link";

// Role-based access: members are assigned a ROLE per project; what each role
// can open is defined once in the Roles tab (feature checklist). Assignments
// dual-write the legacy permissions array so the currently-deployed code
// (which still reads it) keeps working until this branch ships.

interface AccessRecord {
  accessId: string;
  agencyId: string;
  clientId: string;
  email: string;
  name: string;
  roleId: string | null;
}

interface Agency { id: string; email: string; name: string; }
interface Client { id: string; name: string; }
interface Role { id: string; name: string; permissions: string[]; built_in: boolean; }

// One entry per gated surface — mirrors the sidebar
const FEATURES = [
  { key: "view_trends", label: "Trends", desc: "Historical trends page" },
  { key: "view_report", label: "Monthly Report", desc: "Generate monthly reports" },
  { key: "view_projection", label: "Ads Projection", desc: "KPI targets & calculators" },
  { key: "save_projection", label: "Projection: Save", desc: "Save targets to Google Sheet" },
  { key: "edit_customization", label: "Project Customization", desc: "Client-specific rules" },
  { key: "view_diagnostics", label: "Data Diagnostics", desc: "Parsing & sync health" },
  { key: "edit_settings", label: "Settings", desc: "Name, logo, sheet link" },
  { key: "manage_access", label: "Manage Access", desc: "This page" },
];

// Legacy keys understood by the currently-deployed code
function legacyPermissions(rolePerms: string[]): string[] {
  const out = ["view_dashboard"];
  for (const k of ["view_report", "edit_settings", "manage_access"]) {
    if (rolePerms.includes(k)) out.push(k);
  }
  return out;
}

export default function AccessPage() {
  return <Suspense><AccessPageInner /></Suspense>;
}

function AccessPageInner() {
  const searchParams = useSearchParams();
  // Honor ?back= so entries from a project's Settings return there, not to
  // the global Project Overview. Internal paths only (no open redirect).
  const backParam = searchParams.get("back");
  const backHref = backParam && backParam.startsWith("/") && !backParam.startsWith("//") ? backParam : "/projects";
  const initialProject = searchParams.get("project") || "";
  const initialUser = searchParams.get("user") || "";
  const initialName = searchParams.get("name") || "";

  const [tab, setTab] = useState<"project" | "user" | "roles">(initialUser ? "user" : "project");
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [allAccess, setAllAccess] = useState<AccessRecord[]>([]);
  const [selectedProject, setSelectedProject] = useState(initialProject);
  const [selectedUser, setSelectedUser] = useState(initialUser);
  const [search, setSearch] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [bulkSelected, setBulkSelected] = useState<Set<string>>(new Set());
  const [bulkRoleId, setBulkRoleId] = useState<string>("");
  const [draft, setDraft] = useState<AccessRecord[]>([]);
  const [hasChanges, setHasChanges] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const supabase = createClient();

  const loadAll = useCallback(async () => {
    const [{ data: ags }, { data: cls }, { data: acc }, { data: rls }] = await Promise.all([
      supabase.from("agencies").select("id, email, name").order("email"),
      supabase.from("clients").select("id, name").order("name"),
      supabase.from("project_access").select("id, agency_id, client_id, role_id"),
      supabase.from("roles").select("id, name, permissions, built_in").order("built_in", { ascending: false }).order("created_at"),
    ]);

    setAgencies(ags || []);
    setClients(cls || []);
    setRoles((rls || []).map((r) => ({ ...r, permissions: (r.permissions as string[]) || [] })));

    const records: AccessRecord[] = (acc || []).map((a) => {
      const ag = (ags || []).find((x) => x.id === a.agency_id);
      return {
        accessId: a.id,
        agencyId: a.agency_id,
        clientId: a.client_id,
        email: ag?.email || "",
        name: ag?.name || "",
        roleId: a.role_id ?? null,
      };
    });
    setAllAccess(records);
    setDraft(records.map((r) => ({ ...r })));
    setHasChanges(false);
  }, [supabase]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const viewerRole = roles.find((r) => r.name === "Viewer");
  const roleById = (id: string | null) => roles.find((r) => r.id === id);

  const filtered = tab === "project"
    ? draft.filter((r) => r.clientId === selectedProject)
    : draft.filter((r) => r.agencyId === selectedUser);

  const assignedIds = new Set(draft.filter((r) => r.clientId === selectedProject).map((r) => r.agencyId));
  // Focused with no query = show everyone not yet assigned (no need to type)
  const searchResults = agencies.filter((a) =>
    !assignedIds.has(a.id) &&
    (search
      ? a.email.toLowerCase().includes(search.toLowerCase()) || (a.name || "").toLowerCase().includes(search.toLowerCase())
      : searchFocused)
  );

  function setRole(accessId: string, roleId: string) {
    setDraft((prev) => prev.map((r) => (r.accessId === accessId ? { ...r, roleId } : r)));
    setHasChanges(true);
  }

  function addUserToProject(agencyId: string, clientId: string, roleId?: string) {
    const ag = agencies.find((a) => a.id === agencyId);
    const tempId = `new-${Date.now()}-${Math.random()}`;
    setDraft((prev) => [...prev, {
      accessId: tempId,
      agencyId,
      clientId,
      email: ag?.email || "",
      name: ag?.name || "",
      roleId: roleId ?? viewerRole?.id ?? null,
    }]);
    setSearch("");
    setHasChanges(true);
  }

  function toggleBulk(clientId: string) {
    setBulkSelected((prev) => {
      const next = new Set(prev);
      if (next.has(clientId)) next.delete(clientId); else next.add(clientId);
      return next;
    });
  }

  function bulkAssign() {
    if (!selectedUser || !bulkRoleId || bulkSelected.size === 0) return;
    for (const clientId of bulkSelected) {
      addUserToProject(selectedUser, clientId, bulkRoleId);
    }
    setBulkSelected(new Set());
  }

  function removeAccess(accessId: string) {
    if (!window.confirm("Remove this user's access? Click Save to confirm.")) return;
    setDraft((prev) => prev.filter((r) => r.accessId !== accessId));
    setHasChanges(true);
  }

  async function handleSave() {
    setSaving(true);
    setFeedback(null);

    const origIds = new Set(allAccess.map((r) => r.accessId));
    const draftIds = new Set(draft.map((r) => r.accessId));

    const deleted = allAccess.filter((r) => !draftIds.has(r.accessId));
    for (const d of deleted) {
      await supabase.from("project_access").delete().eq("id", d.accessId);
    }

    const added = draft.filter((r) => !origIds.has(r.accessId));
    for (const a of added) {
      const perms = roleById(a.roleId)?.permissions ?? [];
      await supabase.from("project_access").insert({
        agency_id: a.agencyId,
        client_id: a.clientId,
        role_id: a.roleId,
        permissions: legacyPermissions(perms),
      });
    }

    const updated = draft.filter((r) => origIds.has(r.accessId));
    for (const u of updated) {
      const orig = allAccess.find((o) => o.accessId === u.accessId);
      if (orig && orig.roleId !== u.roleId) {
        const perms = roleById(u.roleId)?.permissions ?? [];
        await supabase.from("project_access")
          .update({ role_id: u.roleId, permissions: legacyPermissions(perms) })
          .eq("id", u.accessId);
      }
    }

    await loadAll();
    setSaving(false);
    setFeedback("Access saved successfully");
    setTimeout(() => setFeedback(null), 3000);
  }

  function handleCancel() {
    setDraft(allAccess.map((r) => ({ ...r })));
    setHasChanges(false);
  }

  const projectName = clients.find((c) => c.id === selectedProject)?.name || initialName;

  const TAB = (key: typeof tab, label: string) => (
    <button onClick={() => setTab(key)}
      className={`text-[13px] font-medium pb-2 px-3 border-b-2 transition-colors ${tab === key ? "border-[var(--blue)] text-[var(--t1)]" : "border-transparent text-[var(--t3)] hover:text-[var(--t1)]"}`}>
      {label}
    </button>
  );

  return (
    <div className="min-h-dvh bg-[var(--bg)]">
      <div className="bauhaus-stripe"><div /><div /><div /><div /></div>
      <div className="max-w-3xl mx-auto p-8">
        <div className="flex items-center gap-3 mb-6">
          <Link href={backHref} className="text-[var(--t3)] hover:text-[var(--t1)] text-[13px] transition-colors">&larr; Back</Link>
          <h1 className="font-heading text-[24px] font-semibold tracking-tight text-[var(--t1)]">Manage Access</h1>
          <div className="flex-1" />
          <Link href="/settings/team" className="text-[12px] text-[var(--blue)] hover:underline">+ Invite Member</Link>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 border-b border-[var(--border)]">
          {TAB("project", "By Project")}
          {TAB("user", "By User")}
          {TAB("roles", "Roles")}
        </div>

        {/* Selector */}
        {tab !== "roles" && (
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
        )}

        {feedback && (
          <div className="mb-4 p-3 rounded-[8px] bg-[var(--green-bg)] text-[var(--green)] text-[13px] text-center">{feedback}</div>
        )}

        {/* By Project */}
        {tab === "project" && selectedProject && (
          <>
            <div className="card-base mb-4" style={{ padding: 16 }}>
              <div className="font-label text-[10px] uppercase tracking-widest text-[var(--t4)] mb-2">Add User to {projectName}</div>
              <div className="relative">
                <input type="text" placeholder="Click to see all users, or type to filter..." value={search} onChange={(e) => setSearch(e.target.value)}
                  onFocus={() => setSearchFocused(true)}
                  onBlur={() => setTimeout(() => setSearchFocused(false), 200)}
                  className="w-full h-9 px-3 text-[12px] rounded-[6px] border border-[var(--border)] bg-[var(--bg2)] text-[var(--t1)] outline-none focus:border-[var(--blue)]" />
                {searchResults.length > 0 && (
                  <div className="absolute top-10 left-0 right-0 bg-[var(--bg2)] border border-[var(--border)] rounded-[6px] shadow-md z-10 max-h-[160px] overflow-y-auto">
                    {searchResults.slice(0, 8).map((a) => (
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

            {filtered.length === 0 ? (
              <p className="text-[var(--t4)] text-[13px] text-center py-8">No users assigned to this project</p>
            ) : (
              <div className="space-y-2">
                {filtered.map((r) => (
                  <AssignmentRow key={r.accessId} label={r.name || r.email} sublabel={r.name ? r.email : ""}
                    roleId={r.roleId} roles={roles}
                    onRole={(id) => setRole(r.accessId, id)} onRemove={() => removeAccess(r.accessId)} />
                ))}
              </div>
            )}
          </>
        )}

        {/* By User */}
        {tab === "user" && selectedUser && (() => {
          const assigned = clients.filter((c) => draft.some((r) => r.agencyId === selectedUser && r.clientId === c.id));
          const unassigned = clients.filter((c) => !draft.some((r) => r.agencyId === selectedUser && r.clientId === c.id));
          return (
            <div className="space-y-4">
              {assigned.length > 0 && (
                <div className="space-y-2">
                  {assigned.map((c) => {
                    const rec = draft.find((r) => r.agencyId === selectedUser && r.clientId === c.id)!;
                    return (
                      <AssignmentRow key={rec.accessId} label={c.name} sublabel=""
                        roleId={rec.roleId} roles={roles}
                        onRole={(id) => setRole(rec.accessId, id)} onRemove={() => removeAccess(rec.accessId)} />
                    );
                  })}
                </div>
              )}

              {unassigned.length > 0 && (
                <div className="card-base" style={{ padding: 16 }}>
                  <div className="font-label text-[10px] uppercase tracking-widest text-[var(--t4)] mb-3">
                    Assign more projects — tick, pick a role, one click
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
                    {unassigned.map((c) => (
                      <label key={c.id} className={`flex items-center gap-2 p-2 rounded-[6px] cursor-pointer transition-colors ${bulkSelected.has(c.id) ? "bg-[var(--blue-bg)]" : "bg-[var(--bg3)]"}`}>
                        <input type="checkbox" checked={bulkSelected.has(c.id)} onChange={() => toggleBulk(c.id)}
                          className="w-3.5 h-3.5 rounded accent-[var(--blue)]" />
                        <span className={`text-[12px] ${bulkSelected.has(c.id) ? "text-[var(--blue)] font-medium" : "text-[var(--t2)]"}`}>{c.name}</span>
                      </label>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setBulkSelected(new Set(unassigned.map((c) => c.id)))}
                      className="text-[11px] text-[var(--t3)] hover:text-[var(--t1)] hover:underline">Select all</button>
                    <div className="flex-1" />
                    <span className="text-[11px] text-[var(--t4)]">{bulkSelected.size} selected · as</span>
                    <select value={bulkRoleId} onChange={(e) => setBulkRoleId(e.target.value)}
                      className="h-8 px-2 text-[12px] rounded-[6px] border border-[var(--border)] bg-[var(--bg2)] text-[var(--t1)] outline-none">
                      <option value="">Choose role...</option>
                      {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                    </select>
                    <Button onClick={bulkAssign} disabled={!bulkRoleId || bulkSelected.size === 0}
                      className="bg-[var(--blue)] hover:bg-[#A34D2F] text-white h-8 px-4 text-[12px]">
                      Assign {bulkSelected.size > 0 ? bulkSelected.size : ""}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {/* Roles */}
        {tab === "roles" && <RolesEditor roles={roles} onChanged={loadAll} />}

        {/* Save / Cancel bar */}
        {hasChanges && (
          <div className="fixed bottom-0 left-0 right-0 bg-[var(--bg2)] border-t border-[var(--border)] p-4 flex justify-center gap-3 z-50" style={{ backdropFilter: "blur(10px)" }}>
            <Button onClick={handleCancel} className="bg-[var(--bg3)] text-[var(--t2)] hover:bg-[var(--border)] px-6">
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving} className="bg-[var(--blue)] hover:bg-[#A34D2F] text-white px-6">
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function AssignmentRow({ label, sublabel, roleId, roles, onRole, onRemove }: {
  label: string; sublabel: string; roleId: string | null; roles: Role[];
  onRole: (roleId: string) => void; onRemove: () => void;
}) {
  const role = roles.find((r) => r.id === roleId);
  return (
    <div className="card-base flex items-center justify-between gap-3" style={{ padding: 14 }}>
      <div className="min-w-0">
        <span className="text-[14px] font-medium text-[var(--t1)]">{label}</span>
        {sublabel && <span className="text-[11px] text-[var(--t4)] ml-2">{sublabel}</span>}
        {role && (
          <div className="text-[10px] text-[var(--t4)] mt-0.5 truncate">
            {role.permissions.length} feature{role.permissions.length === 1 ? "" : "s"} · {FEATURES.filter((f) => role.permissions.includes(f.key)).map((f) => f.label).join(", ") || "Dashboard only"}
          </div>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <select value={roleId ?? ""} onChange={(e) => e.target.value && onRole(e.target.value)}
          className="h-8 px-2 text-[12px] rounded-[6px] border border-[var(--border)] bg-[var(--bg2)] text-[var(--t1)] outline-none">
          {roleId === null && <option value="">No role</option>}
          {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
        <button onClick={onRemove} className="text-[10px] text-[var(--red)] hover:underline">Remove</button>
      </div>
    </div>
  );
}

function RolesEditor({ roles, onChanged }: { roles: Role[]; onChanged: () => void }) {
  const [drafts, setDrafts] = useState<Role[]>(roles.map((r) => ({ ...r, permissions: [...r.permissions] })));
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDrafts(roles.map((r) => ({ ...r, permissions: [...r.permissions] })));
  }, [roles]);

  function toggle(roleId: string, key: string) {
    setDrafts((prev) => prev.map((r) => {
      if (r.id !== roleId) return r;
      const has = r.permissions.includes(key);
      return { ...r, permissions: has ? r.permissions.filter((p) => p !== key) : [...r.permissions, key] };
    }));
  }

  async function saveRole(r: Role) {
    setBusy(true); setError(null);
    const res = await fetch("/api/roles", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: r.id, name: r.name, permissions: r.permissions }),
    });
    if (!res.ok) setError((await res.json().catch(() => null))?.error || `HTTP ${res.status}`);
    else onChanged();
    setBusy(false);
  }

  async function addRole() {
    if (!newName.trim()) return;
    setBusy(true); setError(null);
    const res = await fetch("/api/roles", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim(), permissions: [] }),
    });
    if (!res.ok) setError((await res.json().catch(() => null))?.error || `HTTP ${res.status}`);
    else { setNewName(""); onChanged(); }
    setBusy(false);
  }

  async function deleteRole(r: Role) {
    if (!window.confirm(`Delete role "${r.name}"?`)) return;
    setBusy(true); setError(null);
    const res = await fetch("/api/roles", {
      method: "DELETE", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: r.id }),
    });
    if (!res.ok) setError((await res.json().catch(() => null))?.error || `HTTP ${res.status}`);
    else onChanged();
    setBusy(false);
  }

  return (
    <div className="space-y-4">
      <p className="text-[12px] text-[var(--t4)]">
        Every role always includes the Overview dashboard. Tick what else each role can open — changes apply to everyone holding the role, on every project they&apos;re assigned to.
      </p>
      {error && <div className="p-3 rounded-[8px] bg-[var(--red-bg)] text-[var(--red)] text-[13px]">{error}</div>}

      {drafts.map((r) => (
        <div key={r.id} className="card-base" style={{ padding: 16 }}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              {r.built_in ? (
                <span className="text-[14px] font-semibold text-[var(--t1)]">{r.name}</span>
              ) : (
                <input value={r.name} onChange={(e) => setDrafts((prev) => prev.map((x) => x.id === r.id ? { ...x, name: e.target.value } : x))}
                  className="h-8 px-2 text-[14px] font-semibold rounded-[6px] border border-[var(--border)] bg-[var(--bg2)] text-[var(--t1)] outline-none w-[180px]" />
              )}
              {r.built_in && <span className="rounded-full bg-[var(--bg3)] px-2 py-[1px] text-[9px] uppercase tracking-wider text-[var(--t4)]">built-in</span>}
            </div>
            <div className="flex gap-3">
              <button onClick={() => saveRole(r)} disabled={busy} className="text-[11px] text-[var(--blue)] hover:underline">Save</button>
              {!r.built_in && (
                <button onClick={() => deleteRole(r)} disabled={busy} className="text-[11px] text-[var(--red)] hover:underline">Delete</button>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {FEATURES.map((f) => {
              const checked = r.permissions.includes(f.key);
              return (
                <label key={f.key} className={`flex items-center gap-2 p-2 rounded-[6px] cursor-pointer transition-colors ${checked ? "bg-[var(--blue-bg)]" : "bg-[var(--bg3)]"}`}>
                  <input type="checkbox" checked={checked} onChange={() => toggle(r.id, f.key)} className="w-3.5 h-3.5 rounded accent-[var(--blue)]" />
                  <div>
                    <div className={`text-[11px] font-medium ${checked ? "text-[var(--blue)]" : "text-[var(--t2)]"}`}>{f.label}</div>
                    <div className="text-[9px] text-[var(--t4)]">{f.desc}</div>
                  </div>
                </label>
              );
            })}
          </div>
        </div>
      ))}

      <div className="card-base flex items-center gap-2" style={{ padding: 14 }}>
        <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="New role name (e.g. Client)"
          className="h-9 flex-1 px-3 text-[12px] rounded-[6px] border border-[var(--border)] bg-[var(--bg2)] text-[var(--t1)] outline-none" />
        <Button onClick={addRole} disabled={busy || !newName.trim()} className="bg-[var(--blue)] hover:bg-[#A34D2F] text-white">+ Add Role</Button>
      </div>
    </div>
  );
}
