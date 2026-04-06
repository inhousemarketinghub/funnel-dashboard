"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface AccessUser {
  id: string;
  email: string;
  name: string;
  accessId: string;
}

export function AccessManager({ clientId, clientName }: { clientId: string; clientName: string }) {
  const [users, setUsers] = useState<AccessUser[]>([]);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    if (open) loadUsers();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function loadUsers() {
    const { data } = await supabase
      .from("project_access")
      .select("id, agency_id, agencies(email, name)")
      .eq("client_id", clientId);

    if (data) {
      setUsers(data.map((d: Record<string, unknown>) => {
        const agency = d.agencies as Record<string, string> | null;
        return {
          id: d.agency_id as string,
          email: agency?.email || "",
          name: agency?.name || "",
          accessId: d.id as string,
        };
      }));
    }
  }

  async function handleAdd() {
    if (!email.trim()) return;
    setLoading(true);
    setError(null);

    // Find agency by email
    const { data: agency } = await supabase
      .from("agencies")
      .select("id")
      .eq("email", email.trim().toLowerCase())
      .single();

    if (!agency) {
      setError("User not found. They need to sign in first.");
      setLoading(false);
      return;
    }

    const { error: insertErr } = await supabase
      .from("project_access")
      .insert({ agency_id: agency.id, client_id: clientId });

    if (insertErr) {
      setError(insertErr.message.includes("duplicate") ? "User already has access" : insertErr.message);
    } else {
      setEmail("");
      await loadUsers();
    }
    setLoading(false);
  }

  async function handleRemove(accessId: string) {
    await supabase.from("project_access").delete().eq("id", accessId);
    await loadUsers();
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-[11px] text-[var(--t3)] hover:text-[var(--blue)] transition-colors"
      >
        Manage Access
      </button>
    );
  }

  return (
    <div className="mt-3 pt-3 border-t border-[var(--border)]">
      <div className="flex items-center justify-between mb-2">
        <span className="font-label text-[10px] uppercase tracking-widest text-[var(--t4)]">
          User Access — {clientName}
        </span>
        <button onClick={() => setOpen(false)} className="text-[11px] text-[var(--t3)] hover:text-[var(--t1)]">Close</button>
      </div>

      {/* User list */}
      {users.length > 0 ? (
        <div className="space-y-1 mb-3">
          {users.map((u) => (
            <div key={u.accessId} className="flex items-center justify-between py-1">
              <div>
                <span className="text-[12px] text-[var(--t1)]">{u.name || u.email}</span>
                {u.name && <span className="text-[11px] text-[var(--t4)] ml-2">{u.email}</span>}
              </div>
              <button
                onClick={() => handleRemove(u.accessId)}
                className="text-[10px] text-[var(--red)] hover:underline"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-[11px] text-[var(--t4)] mb-3">No users assigned yet</p>
      )}

      {/* Add user */}
      {error && <p className="text-[11px] text-[var(--red)] mb-2">{error}</p>}
      <div className="flex gap-2">
        <Input
          type="email"
          placeholder="user@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="border-[var(--border)] focus-visible:ring-[var(--blue)] h-8 text-[12px] flex-1"
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
        />
        <Button
          onClick={handleAdd}
          disabled={loading || !email.trim()}
          className="bg-[var(--blue)] hover:bg-[#153D7A] text-white h-8 text-[11px] px-3"
        >
          {loading ? "..." : "Add"}
        </Button>
      </div>
    </div>
  );
}
