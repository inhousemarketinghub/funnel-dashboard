"use client";

import { useState } from "react";
import type { MemberInfo, MemberRole } from "@/lib/types";

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

const roleBadgeStyle: Record<MemberRole, React.CSSProperties> = {
  owner: { background: "var(--yellow-bg)", color: "var(--yellow)", border: "1px solid var(--yellow)" },
  manager: { background: "var(--blue-bg)", color: "var(--blue)", border: "1px solid var(--blue)" },
  viewer: { background: "var(--green-bg)", color: "var(--green)", border: "1px solid var(--green)" },
};

export function MemberCard({ member, allClients, onRoleChange, onClientChange, onRemove }: MemberCardProps) {
  const initials = getInitials(member.name, member.email);
  const colors = roleColors[member.role];
  const [pendingRole, setPendingRole] = useState<MemberRole | null>(null);
  const [editingClients, setEditingClients] = useState(false);
  const [selectedClientIds, setSelectedClientIds] = useState<string[]>(member.clients.map((c) => c.id));
  const [saving, setSaving] = useState(false);

  const isOwner = member.role === "owner";
  const hasRoleChange = pendingRole !== null && pendingRole !== member.role;
  const memberClientIds = member.clients.map((c) => c.id);
  const hasClientChange = editingClients && (
    selectedClientIds.length !== memberClientIds.length ||
    selectedClientIds.some((id) => !memberClientIds.includes(id))
  );
  const hasChanges = hasRoleChange || hasClientChange;

  function toggleClient(id: string) {
    setSelectedClientIds((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  }

  async function handleSave() {
    setSaving(true);
    if (hasRoleChange && pendingRole) {
      await onRoleChange(member.id, pendingRole);
    }
    if (hasClientChange) {
      await onClientChange(member.id, selectedClientIds);
    }
    setPendingRole(null);
    setEditingClients(false);
    setSaving(false);
  }

  function handleCancel() {
    setPendingRole(null);
    setSelectedClientIds(memberClientIds);
    setEditingClients(false);
  }

  return (
    <div
      className="card-base p-4 flex flex-col gap-3"
      style={{ background: "var(--bg2)" }}
    >
      {/* Top row: avatar + name/email + role controls */}
      <div className="flex items-start gap-3">
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 font-label text-[13px] font-semibold"
          style={{
            background: colors.bg,
            color: colors.text,
            border: `1.5px solid ${colors.border}`,
          }}
        >
          {initials}
        </div>

        <div className="flex-1 min-w-0">
          <div className="text-[14px] font-medium text-[var(--t1)] truncate">
            {member.name ?? member.email}
          </div>
          {member.name && (
            <div className="text-[12px] text-[var(--t3)] truncate">{member.email}</div>
          )}
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {isOwner ? (
            <span
              className="font-label text-[11px] px-2 py-0.5 rounded-full"
              style={roleBadgeStyle.owner}
            >
              Owner
            </span>
          ) : (
            <>
              <select
                value={pendingRole ?? member.role}
                onChange={(e) => setPendingRole(e.target.value as MemberRole)}
                className="text-[12px] px-2 py-1 rounded-md border cursor-pointer outline-none"
                style={{
                  background: "var(--bg)",
                  borderColor: hasRoleChange ? "var(--blue)" : "var(--border)",
                  color: "var(--t2)",
                }}
              >
                <option value="manager">Manager</option>
                <option value="viewer">Viewer</option>
              </select>
              <button
                onClick={() => onRemove(member.id)}
                className="text-[12px] text-[var(--t3)] hover:text-[var(--red)] transition-colors px-2 py-1"
              >
                Remove
              </button>
            </>
          )}
        </div>
      </div>

      {/* Client tags */}
      <div className="flex flex-wrap gap-1.5 items-center">
        {isOwner ? (
          <span
            className="font-label text-[11px] px-2 py-0.5 rounded-full"
            style={{ background: "var(--yellow-bg)", color: "var(--yellow)" }}
          >
            All clients (Owner)
          </span>
        ) : editingClients ? (
          /* Editing mode: toggle buttons for each client */
          allClients.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => toggleClient(c.id)}
              className="font-label text-[11px] px-2 py-0.5 rounded-full transition-colors"
              style={{
                background: selectedClientIds.includes(c.id) ? "var(--blue-bg)" : "var(--bg3)",
                color: selectedClientIds.includes(c.id) ? "var(--blue)" : "var(--t4)",
                border: selectedClientIds.includes(c.id) ? "1px solid var(--blue)" : "1px solid var(--border)",
              }}
            >
              {selectedClientIds.includes(c.id) ? "✓ " : ""}{c.name}
            </button>
          ))
        ) : member.clients.length > 0 ? (
          <>
            {member.clients.map((client) => (
              <span
                key={client.id}
                className="font-label text-[11px] px-2 py-0.5 rounded-full"
                style={{ background: "var(--blue-bg)", color: "var(--blue)" }}
              >
                {client.name}
              </span>
            ))}
            <button
              type="button"
              onClick={() => setEditingClients(true)}
              className="font-label text-[11px] px-2 py-0.5 text-[var(--t4)] hover:text-[var(--blue)] transition-colors"
            >
              Edit
            </button>
          </>
        ) : (
          <>
            <span className="text-[12px] text-[var(--t4)]">No clients assigned</span>
            <button
              type="button"
              onClick={() => setEditingClients(true)}
              className="font-label text-[11px] px-2 py-0.5 text-[var(--blue)]"
            >
              + Assign
            </button>
          </>
        )}
      </div>

      {/* Save / Cancel bar — only shows when changes are pending */}
      {hasChanges && (
        <div className="flex items-center justify-between pt-2" style={{ borderTop: "1px solid var(--border)" }}>
          <span className="text-[11px] text-[var(--t4)]">
            {hasRoleChange && hasClientChange ? "Role + client access changed" : hasRoleChange ? "Role changed" : "Client access changed"}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleCancel}
              className="text-[12px] text-[var(--t3)] hover:text-[var(--t1)] transition-colors px-3 py-1"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="text-[12px] font-medium px-4 py-1 rounded-full transition-colors"
              style={{ background: "var(--blue)", color: "white" }}
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
