import { redirect } from "next/navigation";
import Link from "next/link";
import { getUserRole } from "@/lib/auth";
import { canViewOverview, canCreateClient } from "@/lib/permissions";
import { fetchAllClientsOverview } from "@/lib/overview";
import { OverviewShell } from "@/components/overview/overview-shell";
import { ClientKpiCard } from "@/components/overview/client-kpi-card";
import { SplitText } from "@/components/animations/split-text";
import { LogoutButton } from "@/components/dashboard/logout-button";

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

  const showOverview = canViewOverview(memberRole);
  const canCreate = canCreateClient(memberRole);

  const isOwnerOrManager = memberRole === "owner" || memberRole === "manager";
  const title = isOwnerOrManager ? "Performance Overview" : "Your Projects";

  return (
    <div className="min-h-dvh bg-[var(--bg)]" style={{ transition: "background 500ms ease" }}>
      <div className="bauhaus-stripe"><div /><div /><div /><div /></div>

      <div className="max-w-7xl mx-auto p-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <SplitText text={title} />
            <p className="text-[13px] text-[var(--t3)] mt-1">
              {isOwnerOrManager
                ? "Current month performance across all clients"
                : "Select a project to view performance"}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {isOwnerOrManager && (
              <Link href="/settings/team" className="topbar-btn">
                Team
              </Link>
            )}
            {canCreate && (
              <Link
                href="/clients/new"
                className="topbar-btn"
                style={{ background: "var(--blue)", color: "white", borderColor: "var(--blue)" }}
              >
                + New Client
              </Link>
            )}
            <span className="text-[11px] text-[var(--t4)] num">{email}</span>
            <LogoutButton />
          </div>
        </div>

        {/* Client grid */}
        {clients.length > 0 ? (
          showOverview ? (
            /* Owners/managers: stats bar + filterable card grid */
            <OverviewShell clients={clients} stats={stats} />
          ) : (
            /* Viewers with multiple clients: plain grid, no stats */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {clients.map((client) => (
                <ClientKpiCard key={client.id} client={client} />
              ))}
            </div>
          )
        ) : (
          <div className="col-span-2 text-center py-16">
            <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-[var(--sand)] flex items-center justify-center text-[22px] text-[var(--t4)]">
              +
            </div>
            {canCreate ? (
              <>
                <p className="text-[var(--t2)] text-[15px] font-medium mb-1">No projects yet</p>
                <p className="text-[var(--t4)] text-[13px] mb-4">
                  Create your first project to start tracking performance
                </p>
                <Link
                  href="/clients/new"
                  className="topbar-btn inline-flex"
                  style={{ background: "var(--blue)", color: "white", borderColor: "var(--blue)" }}
                >
                  + New Client
                </Link>
              </>
            ) : (
              <>
                <p className="text-[var(--t2)] text-[15px] font-medium mb-1">No projects assigned</p>
                <p className="text-[var(--t4)] text-[13px]">
                  Contact your admin to get access to a project
                </p>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
