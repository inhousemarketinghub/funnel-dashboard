"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

interface AccessUser {
  id: string;
  email: string;
  name: string;
  accessId: string;
  permissions: string[];
}

interface Agency {
  id: string;
  email: string;
  name: string;
}

const PERMISSION_OPTIONS = [
  { key: "view_dashboard", label: "Dashboard" },
  { key: "view_report", label: "Report" },
  { key: "edit_settings", label: "Settings" },
  { key: "manage_access", label: "Manage Access" },
];

export function AccessManager({ clientId, clientName }: { clientId: string; clientName: string }) {
  const [users, setUsers] = useState<AccessUser[]>([]);
  const [allAgencies, setAllAgencies] = useState<Agency[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    if (open) { loadUsers(); loadAgencies(); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function loadUsers() {
    const { data } = await supabase
      .from("project_access")
      .select("id, agency_id, permissions, agencies(email, name)")
      .eq("client_id", clientId);

    if (data) {
      setUsers(data.map((d: Record<string, unknown>) => {
        const agency = d.agencies as Record<string, string> | null;
        return {
          id: d.agency_id as string,
          email: agency?.email || "",
          name: agency?.name || "",
          accessId: d.id as string,
          permissions: (d.permissions as string[]) || ["view_dashboard"],
        };
      }));
    }
  }

  async function loadAgencies() {
    const { data } = await supabase.from("agencies").select("id, email, name").order("email");
    if (data) setAllAgencies(data);
  }

  const availableAgencies = allAgencies.filter((a) =>
    !users.some((u) => u.id === a.id) &&
    (search === "" || a.email.toLowerCase().includes(search.toLowerCase()) || (a.name || "").toLowerCase().includes(search.toLowerCase()))
  );

  async function handleAdd(agencyId: string) {
    setLoading(true);
    setError(null);
    const { error: insertErr } = await supabase
      .from("project_access")
      .insert({ agency_id: agencyId, client_id: clientId, permissions: ["view_dashboard"] });
    if (insertErr) {
      setError(insertErr.message.includes("duplicate") ? "User already has access" : insertErr.message);
    } else {
      setSearch("");
      await loadUsers();
    }
    setLoading(false);
  }

  async function handleRemove(accessId: string) {
    await supabase.from("project_access").delete().eq("id", accessId);
    await loadUsers();
  }

  async function togglePermission(accessId: string, currentPerms: string[], perm: string) {
    const newPerms = currentPerms.includes(perm)
      ? currentPerms.filter((p) => p !== perm)
      : [...currentPerms, perm];
    // Always keep view_dashboard
    if (!newPerms.includes("view_dashboard")) newPerms.unshift("view_dashboard");
    await supabase.from("project_access").update({ permissions: newPerms }).eq("id", accessId);
    setUsers((prev) => prev.map((u) => u.accessId === accessId ? { ...u, permissions: newPerms } : u));
  }

  async function setFullAccess(accessId: string) {
    const allPerms = PERMISSION_OPTIONS.map((p) => p.key);
    await supabase.from("project_access").update({ permissions: allPerms }).eq("id", accessId);
    setUsers((prev) => prev.map((u) => u.accessId === accessId ? { ...u, permissions: allPerms } : u));
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="text-[11px] text-[var(--t3)] hover:text-[var(--blue)] transition-colors">
        Manage Access
      </button>
    );
  }

  return (
    <div className="mt-3 pt-3 border-t border-[var(--border)]" onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center justify-between mb-3">
        <span className="font-label text-[10px] uppercase tracking-widest text-[var(--t4)]">User Access — {clientName}</span>
        <button onClick={() => setOpen(false)} className="text-[11px] text-[var(--t3)] hover:text-[var(--t1)]">Close</button>
      </div>

      {/* Assigned users with permission checkboxes */}
      {users.length > 0 ? (
        <div className="space-y-3 mb-4">
          {users.map((u) => (
            <div key={u.accessId} className="bg-[var(--bg3)] rounded-[8px] p-3" style={{ transition: "background 500ms ease" }}>
              <div className="flex items-center justify-between mb-2">
                <div>
                  <span className="text-[12px] font-medium text-[var(--t1)]">{u.name || u.email}</span>
                  {u.name && <span className="text-[10px] text-[var(--t4)] ml-2">{u.email}</span>}
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setFullAccess(u.accessId)} className="text-[9px] text-[var(--blue)] hover:underline">
                    Full Access
                  </button>
                  <button onClick={() => handleRemove(u.accessId)} className="text-[9px] text-[var(--red)] hover:underline">
                    Remove
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {PERMISSION_OPTIONS.map((perm) => {
                  const checked = u.permissions.includes(perm.key);
                  const isBase = perm.key === "view_dashboard";
                  return (
                    <label key={perm.key} className={`flex items-center gap-[5px] text-[10px] cursor-pointer ${isBase ? "opacity-60" : ""}`}>
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={isBase}
                        onChange={() => togglePermission(u.accessId, u.permissions, perm.key)}
                        className="w-3 h-3 rounded accent-[var(--blue)]"
                      />
                      <span className={checked ? "text-[var(--t1)]" : "text-[var(--t3)]"}>{perm.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-[11px] text-[var(--t4)] mb-3">No users assigned yet</p>
      )}

      {/* Search + Add user */}
      {error && <p className="text-[11px] text-[var(--red)] mb-2">{error}</p>}
      <div className="relative">
        <input
          type="text"
          placeholder="Search users by email or name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full h-8 px-3 text-[12px] rounded-[6px] border border-[var(--border)] bg-[var(--bg2)] text-[var(--t1)] outline-none focus:border-[var(--blue)]"
        />
        {search && availableAgencies.length > 0 && (
          <div className="absolute top-9 left-0 right-0 bg-[var(--bg2)] border border-[var(--border)] rounded-[6px] shadow-md z-10 max-h-[160px] overflow-y-auto">
            {availableAgencies.slice(0, 5).map((a) => (
              <button
                key={a.id}
                onClick={() => handleAdd(a.id)}
                disabled={loading}
                className="w-full text-left px-3 py-2 text-[12px] hover:bg-[var(--bg3)] transition-colors flex justify-between items-center"
              >
                <div>
                  <span className="text-[var(--t1)]">{a.name || a.email}</span>
                  {a.name && <span className="text-[var(--t4)] ml-2">{a.email}</span>}
                </div>
                <span className="text-[10px] text-[var(--blue)]">+ Add</span>
              </button>
            ))}
          </div>
        )}
        {search && availableAgencies.length === 0 && (
          <div className="absolute top-9 left-0 right-0 bg-[var(--bg2)] border border-[var(--border)] rounded-[6px] shadow-md z-10 p-3">
            <p className="text-[11px] text-[var(--t4)]">No users found. They need to sign in first.</p>
          </div>
        )}
      </div>
    </div>
  );
}
