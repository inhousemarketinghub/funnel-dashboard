"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import Link from "next/link";

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
  { key: "view_dashboard", label: "Dashboard", desc: "View dashboard data" },
  { key: "view_report", label: "Report", desc: "Generate performance reports" },
  { key: "edit_settings", label: "Settings", desc: "Edit KPI settings" },
  { key: "manage_access", label: "Manage Access", desc: "Manage user permissions" },
];

export default function AccessPage() {
  return (
    <Suspense>
      <AccessPageInner />
    </Suspense>
  );
}

function AccessPageInner() {
  const searchParams = useSearchParams();
  const clientId = searchParams.get("project") || "";
  const clientName = searchParams.get("name") || "Project";

  const [users, setUsers] = useState<AccessUser[]>([]);
  const [allAgencies, setAllAgencies] = useState<Agency[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    if (clientId) { loadUsers(); loadAgencies(); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  async function loadUsers() {
    // Fetch access records
    const { data: accessData } = await supabase
      .from("project_access")
      .select("id, agency_id, permissions")
      .eq("client_id", clientId);

    if (!accessData || accessData.length === 0) {
      setUsers([]);
      return;
    }

    // Fetch agency details separately (avoids RLS join issues)
    const agencyIds = accessData.map((a) => a.agency_id);
    const { data: agencies } = await supabase
      .from("agencies")
      .select("id, email, name")
      .in("id", agencyIds);

    const agencyMap = new Map((agencies || []).map((a) => [a.id, a]));

    setUsers(accessData.map((d) => {
      const agency = agencyMap.get(d.agency_id);
      return {
        id: d.agency_id,
        email: agency?.email || "",
        name: agency?.name || "",
        accessId: d.id,
        permissions: (d.permissions as string[]) || ["view_dashboard"],
      };
    }));
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
    if (!newPerms.includes("view_dashboard")) newPerms.unshift("view_dashboard");
    await supabase.from("project_access").update({ permissions: newPerms }).eq("id", accessId);
    setUsers((prev) => prev.map((u) => u.accessId === accessId ? { ...u, permissions: newPerms } : u));
  }

  async function setFullAccess(accessId: string) {
    const allPerms = PERMISSION_OPTIONS.map((p) => p.key);
    await supabase.from("project_access").update({ permissions: allPerms }).eq("id", accessId);
    setUsers((prev) => prev.map((u) => u.accessId === accessId ? { ...u, permissions: allPerms } : u));
  }

  return (
    <div className="min-h-dvh bg-[var(--bg)]">
      <div className="bauhaus-stripe"><div /><div /><div /><div /></div>
      <div className="max-w-2xl mx-auto p-8">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/clients" className="text-[var(--t3)] hover:text-[var(--t1)] text-[13px] transition-colors">&larr; Back</Link>
          <div>
            <h1 className="font-heading text-[24px] font-semibold tracking-tight text-[var(--t1)]">Manage Access</h1>
            <p className="text-[13px] text-[var(--t3)]">{clientName}</p>
          </div>
        </div>

        {/* Add user */}
        <div className="card-base mb-6" style={{ padding: 20 }}>
          <div className="font-label text-[10px] uppercase tracking-widest text-[var(--t4)] mb-2">Add User</div>
          {error && <p className="text-[11px] text-[var(--red)] mb-2">{error}</p>}
          <div className="relative">
            <input
              type="text"
              placeholder="Search users by email or name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-10 px-3 text-[13px] rounded-[8px] border border-[var(--border)] bg-[var(--bg2)] text-[var(--t1)] outline-none focus:border-[var(--blue)]"
            />
            {search && availableAgencies.length > 0 && (
              <div className="absolute top-11 left-0 right-0 bg-[var(--bg2)] border border-[var(--border)] rounded-[8px] shadow-md z-10 max-h-[200px] overflow-y-auto">
                {availableAgencies.slice(0, 8).map((a) => (
                  <button
                    key={a.id}
                    onClick={() => handleAdd(a.id)}
                    disabled={loading}
                    className="w-full text-left px-4 py-3 text-[13px] hover:bg-[var(--bg3)] transition-colors flex justify-between items-center border-b border-[var(--border)] last:border-b-0"
                  >
                    <div>
                      <span className="text-[var(--t1)] font-medium">{a.name || a.email}</span>
                      {a.name && <span className="text-[var(--t4)] ml-2 text-[12px]">{a.email}</span>}
                    </div>
                    <span className="text-[11px] text-[var(--blue)] font-medium">+ Add</span>
                  </button>
                ))}
              </div>
            )}
            {search && availableAgencies.length === 0 && (
              <div className="absolute top-11 left-0 right-0 bg-[var(--bg2)] border border-[var(--border)] rounded-[8px] shadow-md z-10 p-4">
                <p className="text-[12px] text-[var(--t4)]">No users found. They need to sign in first.</p>
              </div>
            )}
          </div>
        </div>

        {/* User list with permissions */}
        <div className="font-label text-[10px] uppercase tracking-widest text-[var(--t4)] mb-2">
          Users with Access ({users.length})
        </div>
        {users.length === 0 ? (
          <div className="card-base text-center py-8" style={{ padding: 20 }}>
            <p className="text-[var(--t3)] text-[13px]">No users assigned yet. Search above to add users.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {users.map((u) => (
              <div key={u.accessId} className="card-base" style={{ padding: 16 }}>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <span className="text-[14px] font-medium text-[var(--t1)]">{u.name || u.email}</span>
                    {u.name && <span className="text-[12px] text-[var(--t4)] ml-2">{u.email}</span>}
                  </div>
                  <div className="flex items-center gap-3">
                    <button onClick={() => setFullAccess(u.accessId)} className="text-[11px] text-[var(--blue)] hover:underline">
                      Full Access
                    </button>
                    <button onClick={() => handleRemove(u.accessId)} className="text-[11px] text-[var(--red)] hover:underline">
                      Remove
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {PERMISSION_OPTIONS.map((perm) => {
                    const checked = u.permissions.includes(perm.key);
                    const isBase = perm.key === "view_dashboard";
                    return (
                      <label
                        key={perm.key}
                        className={`flex items-center gap-2 p-2 rounded-[6px] cursor-pointer transition-colors ${
                          checked ? "bg-[var(--blue-bg)]" : "bg-[var(--bg3)]"
                        } ${isBase ? "opacity-70" : ""}`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={isBase}
                          onChange={() => togglePermission(u.accessId, u.permissions, perm.key)}
                          className="w-3.5 h-3.5 rounded accent-[var(--blue)]"
                        />
                        <div>
                          <div className={`text-[12px] font-medium ${checked ? "text-[var(--blue)]" : "text-[var(--t2)]"}`}>{perm.label}</div>
                          <div className="text-[10px] text-[var(--t4)]">{perm.desc}</div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
