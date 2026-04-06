import { createServerSupabase } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ThemeToggle } from "@/components/dashboard/theme-toggle";
import { LogoutButton } from "@/components/dashboard/logout-button";

export default async function ClientLayout({ children, params }: { children: React.ReactNode; params: Promise<{ clientId: string }> }) {
  const { clientId } = await params;
  const supabase = await createServerSupabase();
  const { data: client } = await supabase.from("clients").select("*").eq("id", clientId).single();
  if (!client) notFound();

  return (
    <div>
      <div className="bauhaus-stripe"><div/><div/><div/><div/></div>
      <div className="topbar">
        <div className="flex items-center gap-[14px]">
          <Link href="/clients" className="topbar-logo" style={{ textDecoration: "none" }}>Funnel</Link>
          <div className="topbar-sep" />
          {client.logo_url && (
            <img src={client.logo_url} alt="" className="w-8 h-8 rounded-[6px] object-contain bg-white p-[2px]" />
          )}
          <span className="topbar-crumb">{client.name}</span>
        </div>
        <div className="flex items-center gap-[10px]">
          <ThemeToggle />
          <Link href={`/${clientId}/settings`} className="topbar-btn">Settings</Link>
          <LogoutButton />
        </div>
      </div>
      <main style={{ maxWidth: 1280, margin: "0 auto", padding: "28px 32px 80px" }}>{children}</main>
    </div>
  );
}
