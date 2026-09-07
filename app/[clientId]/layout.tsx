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
  const features = perms;

  // Accessible projects for the sidebar's quick switcher (RLS scopes the list
  // to what this user may see).
  const { data: projectList } = await supabase
    .from("clients")
    .select("id, name, logo_url")
    .eq("status", "active")
    .order("name");

  // Unread digest count for the bell. RLS scopes notifications to this
  // user's accessible clients; user_states holds their own read cursor.
  const { data: seenRow } = await supabase
    .from("user_states").select("notifications_seen_at").maybeSingle();
  const seenAt = seenRow?.notifications_seen_at ?? "1970-01-01T00:00:00Z";
  const { count: unreadCount } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .gt("created_at", seenAt);
  const unread = unreadCount ?? 0;

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
          features,
          lang,
          projects: projectList ?? [],
          unread,
        }}
      >
        <MobileNav
          clientId={clientId}
          clientName={client.name}
          logoUrl={client.logo_url}
          email={email}
          features={features}
          lang={lang}
          unread={unread}
        />
        <main className="mx-auto max-w-[1280px] px-4 sm:px-8 pt-7 pb-20">{children}</main>
      </AppShell>
    </div>
  );
}
