"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { type Lang } from "@/lib/i18n";
import { setLanguage } from "@/app/[clientId]/actions";

/**
 * Global EN/中 switch. Per-viewer preference stored in the `dashboard_lang`
 * cookie so the server can render the right language (no hydration flash).
 * Current value comes from a prop (server reads the cookie) to stay in sync.
 */
export function LanguageToggle({ lang }: { lang: Lang }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function setLang(next: Lang) {
    if (next === lang) return;
    startTransition(async () => {
      await setLanguage(next);
      router.refresh();
    });
  }

  const opts: { value: Lang; label: string }[] = [
    { value: "en", label: "EN" },
    { value: "zh", label: "中" },
  ];

  return (
    <div
      className="inline-flex items-center rounded-[8px] border border-[var(--border)] overflow-hidden"
      style={{ opacity: isPending ? 0.6 : 1, transition: "opacity 150ms ease" }}
      role="group"
      aria-label="Language"
    >
      {opts.map((o) => {
        const active = o.value === lang;
        return (
          <button
            key={o.value}
            onClick={() => setLang(o.value)}
            disabled={isPending}
            className="px-2.5 py-[5px] text-[12px] font-medium transition-colors cursor-pointer disabled:cursor-not-allowed"
            style={{
              background: active ? "var(--t1)" : "transparent",
              color: active ? "var(--bg)" : "var(--t3)",
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
