"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { InviteDialog } from "@/components/team/invite-dialog";
import type { MemberInfo, PendingInvitation } from "@/lib/types";
import { teamRoleSummary } from "@/lib/team-summary";

export function TeamClient() {
  const [members, setMembers] = useState<MemberInfo[]>([]);
  const [accessSummary, setAccessSummary] = useState<Record<string, { count: number; roles: string[] }>>({});
  const [invitations, setInvitations] = useState<PendingInvitation[]>([]);
  const [clients, setClients] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);

  const supabase = createClient();

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [membersRes, invitationsRes] = await Promise.all([
        fetch("/api/team"),
        fetch("/api/invitations"),
      ]);

      const [membersData, invitationsData] = await Promise.all([
        membersRes.ok ? membersRes.json() : [],
        invitationsRes.ok ? invitationsRes.json() : [],
      ]);

      setMembers(membersData);
      setInvitations(invitationsData);

      const { data: acc } = await supabase
        .from("project_access")
        .select("agency_id, roles(name)");
      const summary: Record<string, { count: number; roles: string[] }> = {};
      for (const a of acc ?? []) {
        const key = a.agency_id as string;
        const roleName = (a.roles as { name?: string } | null)?.name;
        summary[key] ??= { count: 0, roles: [] };
        summary[key].count++;
        if (roleName && !summary[key].roles.includes(roleName)) summary[key].roles.push(roleName);
      }
      setAccessSummary(summary);

      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email) {
        const { data: agency } = await supabase
          .from("agencies")
          .select("id")
          .eq("email", user.email)
          .single();

        if (agency?.id) {
          const { data: clientsData } = await supabase
            .from("clients")
            .select("id, name")
            .eq("agency_id", agency.id);

          setClients(clientsData ?? []);
        }
      }
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleRemove(memberId: string) {
    const confirmed = window.confirm(
      "Are you sure you want to remove this team member? They will lose access to all assigned clients."
    );
    if (!confirmed) return;

    await fetch("/api/team", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberId }),
    });
    await loadData();
  }

  async function handleInvite(email: string, role: string, clientIds: string[]) {
    const res = await fetch("/api/invitations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, role, client_ids: clientIds }),
    });
    if (!res.ok) {
      const data = await res.json();
      alert(data.error ?? "Failed to send invitation");
      return;
    }
    await loadData();
  }

  async function handleRevokeInvite(invitationId: string) {
    await supabase.from("invitations").delete().eq("id", invitationId);
    await loadData();
  }

  async function handleResendInvite(invitation: PendingInvitation) {
    await supabase.from("invitations").delete().eq("id", invitation.id);
    await fetch("/api/invitations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: invitation.email,
        role: invitation.role,
        client_ids: invitation.client_ids,
      }),
    });
    await loadData();
  }

  return (
    <>
      {/* Header (embedded in the Manage Access → Members tab, so no page title) */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[13px] text-[var(--t3)]">Everyone on your team and their access.</p>
          {!loading && members.length > 0 && (
            <p className="num mt-0.5 text-[12px] text-[var(--t4)]">{teamRoleSummary(members)}</p>
          )}
        </div>
        <button
          onClick={() => setInviteOpen(true)}
          className="topbar-btn"
          style={{ background: "var(--blue)", color: "white", borderColor: "var(--blue)" }}
        >
          + Invite Member
        </button>
      </div>

      {/* Members list */}
      {loading ? (
        <div className="mb-8 flex flex-col gap-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="card-base animate-pulse p-4" style={{ background: "var(--bg2)", height: "88px" }} />
          ))}
        </div>
      ) : members.length > 0 ? (
        <div className="mb-8 flex flex-col gap-3">
          {members.map((member) => {
            const sum = accessSummary[member.id];
            const isOwner = member.role === "owner";
            return (
              <div key={member.id} className="card-base" style={{ padding: 18 }}>
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-[14px] font-medium text-[var(--t1)]">{member.email}</div>
                    <div className="mt-0.5 text-[12px] text-[var(--t4)]">
                      {isOwner
                        ? "Owner · full access to all projects"
                        : sum
                          ? `${sum.count} project${sum.count === 1 ? "" : "s"}${sum.roles.length ? ` · ${sum.roles.join(", ")}` : ""}`
                          : "No projects assigned"}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    {isOwner ? (
                      <span className="rounded-full bg-[var(--yellow-bg)] px-3 py-1 text-[11px] font-medium text-[var(--yellow)]">Owner</span>
                    ) : (
                      <>
                        <Link href={`/projects/access?user=${member.id}`} className="topbar-btn" style={{ padding: "8px 16px" }}>
                          Manage Access
                        </Link>
                        <button onClick={() => handleRemove(member.id)} className="text-[11px] text-[var(--red)] hover:underline">Remove</button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="mb-8 py-12 text-center text-[14px] text-[var(--t3)]">
          No team members yet. Invite someone to get started.
        </div>
      )}

      {/* Pending invitations */}
      {!loading && invitations.length > 0 && (
        <div className="flex flex-col gap-3">
          <h2 className="font-label mb-1 text-[11px] uppercase tracking-wider text-[var(--t3)]">Pending Invitations</h2>
          {invitations.map((inv) => (
            <div
              key={inv.id}
              className="flex items-center justify-between gap-3 rounded-xl p-4"
              style={{ border: "1.5px dashed var(--border)", background: "var(--bg3)" }}
            >
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="truncate text-[14px] font-medium text-[var(--t1)]">{inv.email}</span>
                <div className="flex items-center gap-2">
                  <span
                    className="font-label rounded-full px-2 py-0.5 text-[11px] capitalize"
                    style={{
                      background: inv.role === "manager" ? "var(--blue-bg)" : "var(--green-bg)",
                      color: inv.role === "manager" ? "var(--blue)" : "var(--green)",
                    }}
                  >
                    {inv.role}
                  </span>
                  <span className="text-[12px] text-[var(--t4)]">Pending</span>
                </div>
              </div>
              <div className="flex flex-shrink-0 items-center gap-2">
                <button onClick={() => handleResendInvite(inv)} className="px-2 py-1 text-[12px] text-[var(--t3)] transition-colors hover:text-[var(--blue)]">Resend</button>
                <button onClick={() => handleRevokeInvite(inv.id)} className="px-2 py-1 text-[12px] text-[var(--t3)] transition-colors hover:text-[var(--red)]">Revoke</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && members.length === 0 && invitations.length === 0 && (
        <div className="py-16 text-center">
          <p className="text-[14px] text-[var(--t3)]">Your team is empty. Invite members to collaborate on client dashboards.</p>
        </div>
      )}

      <InviteDialog clients={clients} open={inviteOpen} onClose={() => setInviteOpen(false)} onInvite={handleInvite} />
    </>
  );
}
