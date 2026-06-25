import { cookies } from "next/headers";
import { normalizeLang, LANG_COOKIE } from "@/lib/i18n";
import { SettingsClient } from "./settings-client";

// Thin server wrapper: read the per-viewer language cookie and hand it to the
// client settings form (so it renders in the chosen language with no flash).
export default async function SettingsPage() {
  const lang = normalizeLang((await cookies()).get(LANG_COOKIE)?.value);
  return <SettingsClient lang={lang} />;
}
