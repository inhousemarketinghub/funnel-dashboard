import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { normalizeLang, LANG_COOKIE } from "@/lib/i18n";
import { getProjectPermissions } from "@/lib/auth";
import { ProjectionClient } from "./projection-client";

// Ads Projection: the KPI targets + calculators, moved out of Settings —
// planning tooling deserves its own front door.
export default async function ProjectionPage({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params;
  const perms = await getProjectPermissions(clientId);
  if (!perms.includes("view_projection")) redirect(`/${clientId}`);

  const lang = normalizeLang((await cookies()).get(LANG_COOKIE)?.value);
  return <ProjectionClient lang={lang} canSave={perms.includes("save_projection")} />;
}
