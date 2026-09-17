import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getUserRole } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { normalizeLang, LANG_COOKIE } from "@/lib/i18n";
import { WorkspaceShell } from "@/components/dashboard/workspace-shell";
import { AccountClient } from "./account-client";

// Session-scoped identity — never cache this page across users.
export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const { email, agencyId, memberRole } = await getUserRole();
  if (!email) redirect("/login");

  const lang = normalizeLang((await cookies()).get(LANG_COOKIE)?.value);

  // Which providers are linked to this login (is Google connected?).
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  // Linked sign-in methods. identities is the source of truth AND carries each
  // provider's email, so we can show WHICH Google account is bound.
  const identities = user?.identities ?? [];
  const googleIdentity = identities.find((i) => i.provider === "google");
  const googleLinked = !!googleIdentity;
  const googleEmail = (googleIdentity?.identity_data?.email as string | undefined) ?? null;
  // Only email/password logins can set a password or self-change their email;
  // Google-only accounts are managed on Google's side.
  const hasPassword = identities.some((i) => i.provider === "email");

  // Read-only, user's own data → service role keeps it independent of RLS gaps.
  const db = createAdminSupabase();

  const { data: agency } = await db
    .from("agencies")
    .select("name, phone, avatar_url")
    .eq("email", email)
    .single();

  // Projects this member can open (owners see every project in their agency).
  let projects: { id: string; name: string }[] = [];
  if (memberRole === "owner" && agencyId) {
    const { data } = await db
      .from("clients")
      .select("id, name")
      .eq("agency_id", agencyId)
      .neq("status", "archived")
      .order("name");
    projects = data ?? [];
  } else if (agencyId) {
    const { data } = await db
      .from("project_access")
      .select("clients(id, name)")
      .eq("agency_id", agencyId);
    projects = (data ?? [])
      .map((r) => r.clients as unknown as { id: string; name: string } | null)
      .filter((c): c is { id: string; name: string } => !!c && !!c.id);
  }

  return (
    <WorkspaceShell maxWidth="max-w-[760px]">
      <AccountClient
        lang={lang}
        userId={user?.id ?? ""}
        email={email}
        name={agency?.name ?? email.split("@")[0]}
        phone={agency?.phone ?? ""}
        avatarUrl={agency?.avatar_url ?? null}
        memberRole={memberRole}
        googleLinked={googleLinked}
        googleEmail={googleEmail}
        hasPassword={hasPassword}
        projects={projects}
      />
    </WorkspaceShell>
  );
}
