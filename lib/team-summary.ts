import type { MemberRole } from "./types";

// Plain-language summaries for the Team page — turns raw counts/roles into the
// scannable text shown on member cards and the page header.

export function accessCountLabel(count: number): string {
  if (count === 0) return "No clients assigned";
  return count === 1 ? "1 client" : `${count} clients`;
}

export function accessPreview(
  clients: { name: string }[],
  max = 3,
): { names: string[]; more: number } {
  return {
    names: clients.slice(0, max).map((c) => c.name),
    more: Math.max(0, clients.length - max),
  };
}

const ROLE_DESC: Record<MemberRole, string> = {
  owner: "Full access to all clients and settings",
  manager: "Can view and edit assigned clients",
  viewer: "View only — cannot edit",
};

export function roleDescription(role: MemberRole): string {
  return ROLE_DESC[role] ?? "";
}

const ROLE_LABEL: Record<MemberRole, string> = { owner: "Owner", manager: "Manager", viewer: "Viewer" };

export function teamRoleSummary(members: { role: MemberRole }[]): string {
  const counts: Record<MemberRole, number> = { owner: 0, manager: 0, viewer: 0 };
  for (const m of members) counts[m.role] = (counts[m.role] ?? 0) + 1;

  const memberWord = members.length === 1 ? "member" : "members";
  const parts = (["owner", "manager", "viewer"] as MemberRole[])
    .filter((r) => counts[r] > 0)
    .map((r) => `${counts[r]} ${ROLE_LABEL[r]}`);

  return `${members.length} ${memberWord}${parts.length ? " · " + parts.join(" · ") : ""}`;
}
