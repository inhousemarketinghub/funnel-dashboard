import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { normalizeLang, LANG_COOKIE } from "@/lib/i18n";
import { getProjectPermissions } from "@/lib/auth";
import { SettingsClient } from "./settings-client";

// Server wrapper: enforce access (the layout only HIDES the Settings link —
// without this check a viewer could navigate here by URL), then read the
// per-viewer language cookie and hand it to the client settings form.
export default async function SettingsPage({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params;
  const perms = await getProjectPermissions(clientId);
  if (!perms.includes("edit_settings")) redirect(`/${clientId}`);

  const lang = normalizeLang((await cookies()).get(LANG_COOKIE)?.value);
  return <SettingsClient lang={lang} />;
}
