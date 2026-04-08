"use client";

import type { MemberInfo, MemberRole } from "@/lib/types";

interface MemberCardProps {
  member: MemberInfo;
  onRoleChange: (memberId: string, newRole: MemberRole) => void;
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

export function MemberCard({ member, onRoleChange, onRemove }: MemberCardProps) {
  const initials = getInitials(member.name, member.email);
  const colors = roleColors[member.role];

  return (
    <div
      className="card-base p-4 flex flex-col gap-3"
      style={{ background: "var(--bg2)" }}
    >
      {/* Top row: avatar + name/email + role controls */}
      <div className="flex items-start gap-3">
        {/* Avatar */}
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

        {/* Name + email */}
        <div className="flex-1 min-w-0">
          <div className="text-[14px] font-medium text-[var(--t1)] truncate">
            {member.name ?? member.email}
          </div>
          {member.name && (
            <div className="text-[12px] text-[var(--t3)] truncate">{member.email}</div>
          )}
        </div>

        {/* Role controls */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {member.role === "owner" ? (
            <span
              className="font-label text-[11px] px-2 py-0.5 rounded-full"
              style={roleBadgeStyle.owner}
            >
              Owner
            </span>
          ) : (
            <>
              <select
                value={member.role}
                onChange={(e) => onRoleChange(member.id, e.target.value as MemberRole)}
                className="text-[12px] px-2 py-1 rounded-md border cursor-pointer outline-none"
                style={{
                  background: "var(--bg)",
                  borderColor: "var(--border)",
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
      <div className="flex flex-wrap gap-1.5">
        {member.role === "owner" ? (
          <span
            className="font-label text-[11px] px-2 py-0.5 rounded-full"
            style={{ background: "var(--yellow-bg)", color: "var(--yellow)" }}
          >
            All clients (Owner)
          </span>
        ) : member.clients.length > 0 ? (
          member.clients.map((client) => (
            <span
              key={client.id}
              className="font-label text-[11px] px-2 py-0.5 rounded-full"
              style={{ background: "var(--blue-bg)", color: "var(--blue)" }}
            >
              {client.name}
            </span>
          ))
        ) : (
          <span className="text-[12px] text-[var(--t4)]">No clients assigned</span>
        )}
      </div>
    </div>
  );
}
