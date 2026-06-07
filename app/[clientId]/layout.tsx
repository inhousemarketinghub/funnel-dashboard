import { createServerSupabase } from "@/lib/supabase/server";
import { getUserRole, getProjectPermissions } from "@/lib/auth";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ThemeToggle } from "@/components/dashboard/theme-toggle";
import { LogoutButton } from "@/components/dashboard/logout-button";
import { MobileNav } from "@/components/dashboard/mobile-nav";

export default async function ClientLayout({ children, params }: { children: React.ReactNode; params: Promise<{ clientId: string }> }) {
  const { clientId } = await params;
  const supabase = await createServerSupabase();
  const { data: client } = await supabase.from("clients").select("*").eq("id", clientId).single();
  if (!client) notFound();

  const { role, email } = await getUserRole();
  const isOwner = role === "owner";
  const perms = await getProjectPermissions(clientId);
  const canSettings = perms.includes("edit_settings");

  return (
    <div>
      <div className="bauhaus-stripe"><div/><div/><div/><div/></div>
      {/* Desktop topbar (md+ only) */}
      <div className="hidden md:block">
      <div className="topbar">
        <div className="flex flex-wrap items-center gap-[14px]">
          <Link href="/projects" className="topbar-logo" style={{ textDecoration: "none" }}>Project Overview</Link>
          <div className="topbar-sep" />
          {client.logo_url && (
            <img src={client.logo_url} alt="" className="w-8 h-8 rounded-[6px] object-contain bg-white p-[2px]" />
          )}
          <span className="topbar-crumb">{client.name}</span>
          <div className="topbar-sep" />
          <Link href={`/${clientId}`} className="topbar-btn" style={{ fontSize: 12, padding: "4px 12px" }}>Summary</Link>
          <Link href={`/${clientId}/trends`} className="topbar-btn" style={{ fontSize: 12, padding: "4px 12px" }}>Trends</Link>
        </div>
        <div className="flex flex-wrap items-center gap-[10px]">
          <ThemeToggle />
          {canSettings && <Link href={`/${clientId}/settings`} className="topbar-btn">Settings</Link>}
          <span className="topbar-email text-[11px] text-[var(--t4)] num">{email}</span>
          <LogoutButton />
        </div>
      </div>
      </div>
      {/* Mobile compact bar (below md) */}
      <MobileNav
        clientId={clientId}
        clientName={client.name}
        logoUrl={client.logo_url}
        email={email}
        canSettings={canSettings}
      />
      <main className="mx-auto max-w-[1280px] px-4 sm:px-8 pt-7 pb-20">{children}</main>
    </div>
  );
}
