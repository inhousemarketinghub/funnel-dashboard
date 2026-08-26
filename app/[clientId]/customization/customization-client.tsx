"use client";

import { useParams } from "next/navigation";
import { ProfileEditor } from "@/components/settings/profile-editor";
import type { Lang } from "@/lib/i18n";

const C_ZH: Record<string, string> = {
  "Project Customization": "项目定制",
};

export function CustomizationClient({ lang }: { lang: Lang }) {
  const { clientId } = useParams<{ clientId: string }>();
  const tl = (s: string) => (lang === "zh" && C_ZH[s]) || s;

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-heading font-bold text-2xl text-[var(--t1)] tracking-tight">
          {tl("Project Customization")}
        </h1>
      </div>
      <ProfileEditor clientId={clientId} lang={lang} />
    </div>
  );
}
