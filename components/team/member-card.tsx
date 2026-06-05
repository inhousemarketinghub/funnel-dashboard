"use client";

import { useState } from "react";
import type { MemberInfo, MemberRole } from "@/lib/types";
import { roleDescription, accessCountLabel, accessPreview } from "@/lib/team-summary";
import { ManageAccessDialog } from "./manage-access-dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface MemberCardProps {
  member: MemberInfo;
  allClients: { id: string; name: string }[];
  onRoleChange: (memberId: string, newRole: MemberRole) => void;
  onClientChange: (memberId: string, clientIds: string[]) => void;
  onRemove: (memberId: string) => void;
}

function getInitials(name: string | null, email: string): string {
  if (name) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return parts[0].slice(0, 2).toUpperCase();
  }
  return email.slice(0, 2).toUpperCase();
}

const roleColors: Record<MemberRole, { bg: string; text: string; border: string }> = {
  owner: { bg: "var(--yellow-bg)", text: "var(--yellow)", border: "var(--yellow)" },
  manager: { bg: "var(--blue-bg)", text: "var(--blue)", border: "var(--blue)" },
  viewer: { bg: "var(--green-bg)", text: "var(--green)", border: "var(--green)" },
};

export function MemberCard({ member, allClients, onRoleChange, onClientChange, onRemove }: MemberCardProps) {
  const initials = getInitials(member.name, member.email);
  const [pendingRole, setPendingRole] = useState<MemberRole | null>(null);
  const [accessOpen, setAccessOpen] = useState(false);

  const isOwner = member.role === "owner";
  const displayRole = pendingRole ?? member.role;
  const colors = roleColors[displayRole];
  const hasRoleChange = pendingRole !== null && pendingRole !== member.role;

  const memberClientIds = member.clients.map((c) => c.id);
  const preview = accessPreview(member.clients, 3);

  async function saveRole() {
    if (hasRoleChange && pendingRole) await onRoleChange(member.id, pendingRole);
    setPendingRole(null);
  }

  return (
    <div className="card-base p-4 flex flex-col gap-3" style={{ background: "var(--bg2)" }}>
      {/* Identity + role + overflow menu */}
      <div className="flex items-start gap-3">
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 font-label text-[13px] font-semibold"
          style={{ background: colors.bg, color: colors.text, border: `1.5px solid ${colors.border}` }}
        >
          {initials}
        </div>

        <div className="flex-1 min-w-0">
          <div className="text-[14px] font-medium text-[var(--t1)] truncate">{member.name ?? member.email}</div>
          {member.name && <div className="text-[12px] text-[var(--t3)] truncate">{member.email}</div>}
          <div className="text-[12px] text-[var(--t4)] mt-0.5">{roleDescription(displayRole)}</div>
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          {isOwner ? (
            <span
              className="font-label text-[11px] px-2 py-0.5 rounded-full"
              style={{ background: "var(--yellow-bg)", color: "var(--yellow)", border: "1px solid var(--yellow)" }}
            >
              Owner
            </span>
          ) : (
            <>
              <select
                value={displayRole}
                onChange={(e) => setPendingRole(e.target.value as MemberRole)}
                className="text-[12px] px-2 py-1 rounded-md border cursor-pointer outline-none"
                style={{ background: "var(--bg)", borderColor: hasRoleChange ? "var(--blue)" : "var(--border)", color: "var(--t2)" }}
              >
                <option value="manager">Manager</option>
                <option value="viewer">Viewer</option>
              </select>
              <Popover>
                <PopoverTrigger
                  render={
                    <button
                      aria-label="More options"
                      className="w-7 h-7 rounded-md flex items-center justify-center text-[var(--t3)] hover:text-[var(--t1)] hover:bg-[var(--bg3)] transition-colors cursor-pointer"
                    >
                      ⋯
                    </button>
                  }
                />
                <PopoverContent align="end" sideOffset={4} className="w-44 p-1">
                  <button
                    type="button"
                    onClick={() => onRemove(member.id)}
                    className="w-full text-left text-[13px] px-2.5 py-1.5 rounded-md text-[var(--red)] hover:bg-[var(--bg3)] transition-colors cursor-pointer"
                  >
                    Remove member
                  </button>
                </PopoverContent>
              </Popover>
            </>
          )}
        </div>
      </div>

      {/* Access summary + Manage */}
      <div className="flex items-center justify-between gap-3 pt-3" style={{ borderTop: "1px solid var(--border)" }}>
        <div className="min-w-0">
          <div className="text-[12px] text-[var(--t3)]">
            <span className="font-label uppercase tracking-wider text-[10px] text-[var(--t4)] mr-1">Access</span>
            {isOwner ? "All clients" : accessCountLabel(member.clients.length)}
          </div>
          {!isOwner && member.clients.length > 0 && (
            <div className="text-[12px] text-[var(--t4)] truncate mt-0.5">
              {preview.names.join(" · ")}
              {preview.more > 0 ? `  +${preview.more} more` : ""}
            </div>
          )}
        </div>
        {!isOwner && (
          <button
            type="button"
            onClick={() => setAccessOpen(true)}
            className="topbar-btn flex-shrink-0"
            style={{ fontSize: 12, padding: "4px 12px" }}
          >
            Manage
          </button>
        )}
      </div>

      {/* Role save bar — only when role is pending */}
      {hasRoleChange && (
        <div className="flex items-center justify-between pt-2" style={{ borderTop: "1px solid var(--border)" }}>
          <span className="text-[11px] text-[var(--t4)]">Role changed to {displayRole}</span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPendingRole(null)}
              className="text-[12px] text-[var(--t3)] hover:text-[var(--t1)] transition-colors px-3 py-1"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={saveRole}
              className="text-[12px] font-medium px-4 py-1 rounded-full"
              style={{ background: "var(--blue)", color: "white" }}
            >
              Save
            </button>
          </div>
        </div>
      )}

      {accessOpen && (
        <ManageAccessDialog
          memberLabel={member.email}
          allClients={allClients}
          initialSelected={memberClientIds}
          onClose={() => setAccessOpen(false)}
          onSave={(ids) => onClientChange(member.id, ids)}
        />
      )}
    </div>
  );
}
