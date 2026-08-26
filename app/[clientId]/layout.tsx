import { createServerSupabase } from "@/lib/supabase/server";
import { getUserRole, getProjectPermissions } from "@/lib/auth";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { AppShell } from "@/components/dashboard/app-shell";
import { MobileNav } from "@/components/dashboard/mobile-nav";
import { normalizeLang, LANG_COOKIE } from "@/lib/i18n";

export default async function ClientLayout({ children, params }: { children: React.ReactNode; params: Promise<{ clientId: string }> }) {
  const { clientId } = await params;
  const lang = normalizeLang((await cookies()).get(LANG_COOKIE)?.value);
  const supabase = await createServerSupabase();
  const { data: client } = await supabase.from("clients").select("*").eq("id", clientId).single();
  if (!client) notFound();

  const { email } = await getUserRole();
  const perms = await getProjectPermissions(clientId);
  const canSettings = perms.includes("edit_settings");

  // Accessible projects for the sidebar's quick switcher (RLS scopes the list
  // to what this user may see).
  const { data: projectList } = await supabase
    .from("clients")
    .select("id, name, logo_url")
    .eq("status", "active")
    .order("name");

  return (
    <div>
      <div className="bauhaus-stripe"><div/><div/><div/><div/></div>
      {/* Desktop: ERP-style left sidebar; Mobile: unchanged hamburger nav.
          children render once — the sidebar hides itself below md via CSS. */}
      <AppShell
        sidebar={{
          clientId,
          clientName: client.name,
          logoUrl: client.logo_url,
          email,
          canSettings,
          lang,
          projects: projectList ?? [],
        }}
      >
        <MobileNav
          clientId={clientId}
          clientName={client.name}
          logoUrl={client.logo_url}
          email={email}
          canSettings={canSettings}
          lang={lang}
        />
        <main className="mx-auto max-w-[1280px] px-4 sm:px-8 pt-7 pb-20">{children}</main>
      </AppShell>
    </div>
  );
}
