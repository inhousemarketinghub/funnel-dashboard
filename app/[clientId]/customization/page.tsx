import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { normalizeLang, LANG_COOKIE } from "@/lib/i18n";
import { getProjectPermissions } from "@/lib/auth";
import { CustomizationClient } from "./customization-client";

// Project Customization: this client's special rules (funnel type, column
// aliases, paid sources) — moved out of Settings into its own page.
export default async function CustomizationPage({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params;
  const perms = await getProjectPermissions(clientId);
  if (!perms.includes("edit_customization")) redirect(`/${clientId}`);

  const lang = normalizeLang((await cookies()).get(LANG_COOKIE)?.value);
  return <CustomizationClient lang={lang} />;
}
