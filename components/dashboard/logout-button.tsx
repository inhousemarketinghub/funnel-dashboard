"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { t, type Lang } from "@/lib/i18n";

export function LogoutButton({ lang = "en" }: { lang?: Lang }) {
  const supabase = createClient();
  const router = useRouter();

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      onClick={handleLogout}
      className="text-[12px] text-[var(--t3)] hover:text-[var(--red)] transition-colors"
    >
      {t(lang, "signOut")}
    </button>
  );
}
