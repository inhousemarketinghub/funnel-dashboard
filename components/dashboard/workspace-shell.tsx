import { cookies } from "next/headers";
import { getUserRole } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import { normalizeLang, LANG_COOKIE } from "@/lib/i18n";
import { canManageTeam, canCreateClient } from "@/lib/permissions";
import { WorkspaceAppShell } from "./workspace-app-shell";
import { TopLevelMobileNav } from "./top-level-mobile-nav";

/**
 * Shared chrome for the top-level (workspace) pages. Fetches the once-per-page
 * bits (identity, language, unread digests) and wraps the page body in the
 * workspace sidebar + mobile nav, so /projects, /account, /projects/access and
 * /settings/team all feel like the same product as the client dashboard.
 *
 * `maxWidth` lets a page keep its own content width (Overview is wide; the
 * admin pages are narrow) while sharing the outer shell.
 */
export async function WorkspaceShell({
  children,
  maxWidth = "max-w-[1280px]",
}: {
  children: React.ReactNode;
  maxWidth?: string;
}) {
  const { email, memberRole } = await getUserRole();
  const lang = normalizeLang((await cookies()).get(LANG_COOKIE)?.value);

  const supabase = await createServerSupabase();
  const { data: me } = await supabase.from("agencies").select("name, avatar_url").eq("email", email ?? "").single();

  // Unread digest count — mirrors the client layout's computation. RLS scopes
  // notifications to this user's accessible clients; user_states holds the
  // per-user read cursor.
  const { data: seenRow } = await supabase.from("user_states").select("notifications_seen_at").maybeSingle();
  const seenAt = seenRow?.notifications_seen_at ?? "1970-01-01T00:00:00Z";
  const { count } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .gt("created_at", seenAt);
  const unread = count ?? 0;

  const canManageAccess = memberRole ? canManageTeam(memberRole) : false;
  const canCreate = memberRole ? canCreateClient(memberRole) : false;

  const sidebar = {
    email,
    userName: me?.name ?? null,
    userAvatar: me?.avatar_url ?? null,
    lang,
    unread,
    canManageAccess,
    canCreate,
  };

  return (
    <div className="min-h-dvh bg-[var(--bg)]">
      <div className="bauhaus-stripe"><div /><div /><div /><div /></div>
      <WorkspaceAppShell sidebar={sidebar}>
        <TopLevelMobileNav email={email} lang={lang} unread={unread} canManageAccess={canManageAccess} canCreate={canCreate} />
        <main className={`mx-auto ${maxWidth} px-4 sm:px-8 pt-7 pb-20`}>{children}</main>
      </WorkspaceAppShell>
    </div>
  );
}
