"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { MemberCard } from "@/components/team/member-card";
import { InviteDialog } from "@/components/team/invite-dialog";
import { LogoutButton } from "@/components/dashboard/logout-button";
import type { MemberInfo, MemberRole, PendingInvitation } from "@/lib/types";

export default function TeamPage() {
  const [members, setMembers] = useState<MemberInfo[]>([]);
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

      // Fetch clients list from supabase directly
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

  async function handleRoleChange(memberId: string, newRole: MemberRole) {
    await fetch("/api/team", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberId, newRole }),
    });
    await loadData();
  }

  async function handleClientChange(memberId: string, clientIds: string[]) {
    await fetch("/api/team", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberId, clientIds }),
    });
    await loadData();
  }

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

  async function handleInvite(email: string, role: MemberRole, clientIds: string[]) {
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
    // Revoke old and create new
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
    <div className="min-h-dvh bg-[var(--bg)]" style={{ transition: "background 500ms ease" }}>
      <div className="bauhaus-stripe"><div /><div /><div /><div /></div>

      <div className="max-w-3xl mx-auto p-8">
        {/* Top nav */}
        <div className="flex justify-between items-center mb-8">
          <span className="font-heading text-[18px] font-semibold text-[var(--t1)]">
            Funnel Dashboard
          </span>
          <div className="flex items-center gap-3">
            <Link
              href="/clients"
              className="topbar-btn"
            >
              Overview
            </Link>
            <span
              className="topbar-btn"
              style={{
                background: "var(--t1)",
                color: "white",
                borderColor: "var(--t1)",
              }}
            >
              Team
            </span>
            <LogoutButton />
          </div>
        </div>

        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="font-heading text-[24px] font-semibold text-[var(--t1)]">
              Team Members
            </h1>
            <p className="text-[13px] text-[var(--t3)] mt-0.5">
              Manage your team's access and permissions
            </p>
          </div>
          <button
            onClick={() => setInviteOpen(true)}
            className="topbar-btn"
            style={{
              background: "var(--blue)",
              color: "white",
              borderColor: "var(--blue)",
            }}
          >
            + Invite Member
          </button>
        </div>

        {/* Members list */}
        {loading ? (
          <div className="flex flex-col gap-3 mb-8">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="card-base p-4 animate-pulse"
                style={{ background: "var(--bg2)", height: "88px" }}
              />
            ))}
          </div>
        ) : members.length > 0 ? (
          <div className="flex flex-col gap-3 mb-8">
            {members.map((member) => (
              <MemberCard
                key={member.id}
                member={member}
                allClients={clients}
                onRoleChange={handleRoleChange}
                onClientChange={handleClientChange}
                onRemove={handleRemove}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-12 text-[14px] text-[var(--t3)] mb-8">
            No team members yet. Invite someone to get started.
          </div>
        )}

        {/* Pending invitations */}
        {!loading && invitations.length > 0 && (
          <div className="flex flex-col gap-3">
            <h2 className="font-label text-[11px] text-[var(--t3)] uppercase tracking-wider mb-1">
              Pending Invitations
            </h2>
            {invitations.map((inv) => (
              <div
                key={inv.id}
                className="rounded-xl p-4 flex items-center justify-between gap-3"
                style={{
                  border: "1.5px dashed var(--border)",
                  background: "var(--bg3)",
                }}
              >
                <div className="flex flex-col gap-0.5 min-w-0">
                  <span className="text-[14px] font-medium text-[var(--t1)] truncate">
                    {inv.email}
                  </span>
                  <div className="flex items-center gap-2">
                    <span
                      className="font-label text-[11px] px-2 py-0.5 rounded-full capitalize"
                      style={{
                        background: inv.role === "manager" ? "var(--blue-bg)" : "var(--green-bg)",
                        color: inv.role === "manager" ? "var(--blue)" : "var(--green)",
                      }}
                    >
                      {inv.role}
                    </span>
                    <span className="text-[12px] text-[var(--t4)]">
                      Pending
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => handleResendInvite(inv)}
                    className="text-[12px] text-[var(--t3)] hover:text-[var(--blue)] transition-colors px-2 py-1"
                  >
                    Resend
                  </button>
                  <button
                    onClick={() => handleRevokeInvite(inv.id)}
                    className="text-[12px] text-[var(--t3)] hover:text-[var(--red)] transition-colors px-2 py-1"
                  >
                    Revoke
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && members.length === 0 && invitations.length === 0 && (
          <div className="text-center py-16">
            <p className="text-[14px] text-[var(--t3)]">
              Your team is empty. Invite members to collaborate on client dashboards.
            </p>
          </div>
        )}
      </div>

      {/* Invite dialog */}
      <InviteDialog
        clients={clients}
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        onInvite={handleInvite}
      />
    </div>
  );
}
