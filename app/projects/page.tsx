import { redirect } from "next/navigation";
import Link from "next/link";
import { getUserRole } from "@/lib/auth";
import { canViewOverview, canCreateClient } from "@/lib/permissions";
import { fetchAllClientsOverview, fetchArchivedClients } from "@/lib/overview";
import { OverviewShell } from "@/components/overview/overview-shell";
import { ClientKpiCard } from "@/components/overview/client-kpi-card";
import { SplitText } from "@/components/animations/split-text";
import { WorkspaceShell } from "@/components/dashboard/workspace-shell";

export default async function ClientsPage() {
  const { email, memberRole } = await getUserRole();

  if (!email || !memberRole) {
    redirect("/login");
  }

  const { clients, stats } = await fetchAllClientsOverview();

  // Viewers with only one assigned client go directly to that client's dashboard
  if (memberRole === "viewer" && clients.length === 1) {
    redirect(`/${clients[0].id}`);
  }

  // Archived projects power the owner-only recycle bin.
  const archived = memberRole === "owner" ? await fetchArchivedClients() : [];

  const showOverview = canViewOverview(memberRole);
  const canCreate = canCreateClient(memberRole);

  const isOwnerOrManager = memberRole === "owner" || memberRole === "manager";
  const title = "Project Overview";

  return (
    <WorkspaceShell maxWidth="max-w-7xl">
      {/* Header — account / theme / access now live in the sidebar; only the
          title and the primary "New Client" CTA remain here. */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <SplitText text={title} />
          <p className="mt-1 text-[13px] text-[var(--t3)]">
            {isOwnerOrManager
              ? "Current month performance across all clients"
              : "Select a project to view performance"}
          </p>
        </div>
        {canCreate && (
          <Link
            href="/projects/new"
            className="topbar-btn"
            style={{ background: "var(--blue)", color: "white", borderColor: "var(--blue)" }}
          >
            + New Client
          </Link>
        )}
      </div>

      {/* Client grid */}
      {clients.length > 0 ? (
        showOverview ? (
          <OverviewShell clients={clients} stats={stats} isOwner={memberRole === "owner"} archived={archived} />
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {clients.map((client) => (
              <ClientKpiCard key={client.id} client={client} />
            ))}
          </div>
        )
      ) : (
        <div className="py-16 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--sand)] text-[22px] text-[var(--t4)]">
            +
          </div>
          {canCreate ? (
            <>
              <p className="mb-1 text-[15px] font-medium text-[var(--t2)]">No projects yet</p>
              <p className="mb-4 text-[13px] text-[var(--t4)]">Create your first project to start tracking performance</p>
              <Link
                href="/projects/new"
                className="topbar-btn inline-flex"
                style={{ background: "var(--blue)", color: "white", borderColor: "var(--blue)" }}
              >
                + New Client
              </Link>
            </>
          ) : (
            <>
              <p className="mb-1 text-[15px] font-medium text-[var(--t2)]">No projects assigned</p>
              <p className="text-[13px] text-[var(--t4)]">Contact your admin to get access to a project</p>
            </>
          )}
        </div>
      )}
    </WorkspaceShell>
  );
}
