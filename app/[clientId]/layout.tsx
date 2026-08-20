import { createServerSupabase } from "@/lib/supabase/server";
import { getUserRole, getProjectPermissions } from "@/lib/auth";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import Link from "next/link";
import { ThemeToggle } from "@/components/dashboard/theme-toggle";
import { LanguageToggle } from "@/components/dashboard/language-toggle";
import { LogoutButton } from "@/components/dashboard/logout-button";
import { MobileNav } from "@/components/dashboard/mobile-nav";
import { t, normalizeLang, LANG_COOKIE } from "@/lib/i18n";

export default async function ClientLayout({ children, params }: { children: React.ReactNode; params: Promise<{ clientId: string }> }) {
  const { clientId } = await params;
  const lang = normalizeLang((await cookies()).get(LANG_COOKIE)?.value);
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
          <Link href="/projects" className="topbar-logo" style={{ textDecoration: "none" }}>{t(lang, "projectOverview")}</Link>
          <div className="topbar-sep" />
          {client.logo_url && (
            <img src={client.logo_url} alt="" className="w-8 h-8 rounded-[6px] object-contain bg-white p-[2px]" />
          )}
          <Link href={`/${clientId}`} className="topbar-crumb" style={{ textDecoration: "none" }}>{client.name}</Link>
        </div>
        <div className="flex flex-wrap items-center gap-[10px]">
          <LanguageToggle lang={lang} />
          <ThemeToggle />
          {canSettings && <Link href={`/${clientId}/diagnostics`} className="topbar-btn">{t(lang, "diagnostics")}</Link>}
          {canSettings && <Link href={`/${clientId}/settings`} className="topbar-btn">{t(lang, "settings")}</Link>}
          <span className="topbar-email text-[11px] text-[var(--t4)] num">{email}</span>
          <LogoutButton lang={lang} />
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
        lang={lang}
      />
      <main className="mx-auto max-w-[1280px] px-4 sm:px-8 pt-7 pb-20">{children}</main>
    </div>
  );
}
