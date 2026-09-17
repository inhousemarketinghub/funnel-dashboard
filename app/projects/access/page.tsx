import { redirect } from "next/navigation";
import { getUserRole } from "@/lib/auth";
import { canManageTeam } from "@/lib/permissions";
import { WorkspaceShell } from "@/components/dashboard/workspace-shell";
import { AccessClient } from "./access-client";

export const dynamic = "force-dynamic";

export default async function AccessPage() {
  const { memberRole } = await getUserRole();
  if (!memberRole) redirect("/login");
  if (!canManageTeam(memberRole)) redirect("/projects");

  return (
    <WorkspaceShell maxWidth="max-w-3xl">
      <AccessClient />
    </WorkspaceShell>
  );
}
