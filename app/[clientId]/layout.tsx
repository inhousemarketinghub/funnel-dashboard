import { createServerSupabase } from "@/lib/supabase/server";
import { getUserRole, getProjectPermissions } from "@/lib/auth";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ThemeToggle } from "@/components/dashboard/theme-toggle";
import { LogoutButton } from "@/components/dashboard/logout-button";

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
      <div className="topbar">
        <div className="flex items-center gap-[14px]">
          <Link href="/clients" className="topbar-logo" style={{ textDecoration: "none" }}>Dashboard</Link>
          <div className="topbar-sep" />
          {client.logo_url && (
            <img src={client.logo_url} alt="" className="w-8 h-8 rounded-[6px] object-contain bg-white p-[2px]" />
          )}
          <span className="topbar-crumb">{client.name}</span>
          <div className="topbar-sep" />
          <Link href={`/${clientId}`} className="topbar-btn" style={{ fontSize: 12, padding: "4px 12px" }}>Dashboard</Link>
          <Link href={`/${clientId}/trends`} className="topbar-btn" style={{ fontSize: 12, padding: "4px 12px" }}>Trends</Link>
        </div>
        <div className="flex items-center gap-[10px]">
          <ThemeToggle />
          {canSettings && <Link href={`/${clientId}/settings`} className="topbar-btn">Settings</Link>}
          <span className="text-[11px] text-[var(--t4)] num">{email}</span>
          <LogoutButton />
        </div>
      </div>
      <main style={{ maxWidth: 1280, margin: "0 auto", padding: "28px 32px 80px" }}>{children}</main>
    </div>
  );
}
