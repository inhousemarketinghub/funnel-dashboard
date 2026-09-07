"use client";

import { useState } from "react";
import { Bell } from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { t, type Lang } from "@/lib/i18n";
import type { DigestBody, DigestSeverity } from "@/lib/notify";

/**
 * 通知中心铃铛 (owner-approved 2026-09-07): unread dot + a popover listing
 * the daily health digests. Opening the panel marks everything seen (no
 * extra button). body is STRUCTURED — all copy renders here per language.
 * House rule: nothing truncates; long lines wrap.
 */

interface Item {
  id: string;
  day: string;
  severity: DigestSeverity;
  body: DigestBody;
  clients: { name: string } | null;
}

const SANITY_KEY: Record<string, string> = {
  showup_exceeds_est: "sanityShowupEst",
  orders_exceed_showup: "sanityOrdersShowup",
  contact_exceeds_inquiry: "sanityContactInquiry",
  sales_without_orders: "sanitySalesNoOrders",
};

const SEV_PILL: Record<DigestSeverity, string> = {
  info: "bg-[var(--green)]/15 text-[var(--green)]",
  warn: "bg-[var(--yellow)]/15 text-[var(--yellow)]",
  error: "bg-[var(--red)]/15 text-[var(--red)]",
};

function DigestLine({ item, lang }: { item: Item; lang: Lang }) {
  const b = item.body;
  const bits: string[] = [];
  if (b.sync.status !== "success") bits.push(`${t(lang, "notifSyncFailed")}${b.sync.error ? `: ${b.sync.error}` : ""}`);
  if (b.kpi_error) bits.push(`${t(lang, "notifKpiMirror")}: ${b.kpi_error}`);
  if (b.anomaly) bits.push(`${t(lang, "notifCplSpike")} RM${b.anomaly.value} (${t(lang, "notifBaseline")} RM${b.anomaly.baseline})`);
  if (b.quarantine > 0) bits.push(`${t(lang, "notifQuarantine")} +${b.quarantine}`);
  for (const code of b.sanity) bits.push(t(lang, SANITY_KEY[code] ?? code));
  if (b.changes.count > 0) bits.push(`${b.changes.count} ${t(lang, "notifChanges")}${b.changes.months.length ? ` (${b.changes.months.join(", ")})` : ""}`);
  if (bits.length === 0) bits.push(t(lang, "notifAllQuiet"));
  return (
    <div className="flex items-start gap-2 py-1">
      <span className={`mt-[2px] inline-block shrink-0 rounded-full px-2 py-[1px] text-[10px] font-medium ${SEV_PILL[item.severity]}`}>
        {item.clients?.name ?? "—"}
      </span>
      <span className="min-w-0 text-[12px] leading-relaxed text-[var(--t2)]">{bits.join(" · ")}</span>
    </div>
  );
}

export function NotificationBell({
  lang, initialUnread, variant, collapsed = false,
}: {
  lang: Lang;
  initialUnread: number;
  variant: "nav" | "icon";
  collapsed?: boolean;
}) {
  const [unread, setUnread] = useState(initialUnread);
  const [items, setItems] = useState<Item[] | null>(null);

  async function onOpenChange(open: boolean) {
    if (!open) return;
    try {
      const res = await fetch("/api/notifications");
      const data = await res.json();
      setItems(data.items ?? []);
      await fetch("/api/notifications", { method: "POST" });
      setUnread(0);
    } catch {
      setItems([]);
    }
  }

  const icon = (
    <span className="relative inline-flex">
      <Bell className="h-4 w-4 shrink-0" />
      {unread > 0 && (
        <span className="absolute -right-[3px] -top-[3px] h-[7px] w-[7px] rounded-full bg-[var(--red)]" />
      )}
    </span>
  );

  // Group by day; quiet info rows collapse into one line per day.
  const days = new Map<string, Item[]>();
  for (const it of items ?? []) {
    if (!days.has(it.day)) days.set(it.day, []);
    days.get(it.day)!.push(it);
  }

  return (
    <Popover onOpenChange={onOpenChange}>
      <PopoverTrigger
        render={
          variant === "nav" ? (
            <button
              title={collapsed ? t(lang, "notifications") : undefined}
              className="flex w-full items-center gap-2.5 rounded-[8px] px-3 py-2 text-[13px] font-medium text-[var(--t2)] transition-colors hover:bg-[var(--sidebar-accent)] hover:text-[var(--sidebar-accent-foreground)]"
            >
              {icon}
              <span className={"whitespace-nowrap transition-opacity duration-150 " + (collapsed ? "opacity-0" : "opacity-100 delay-100")}>{t(lang, "notifications")}</span>
              {!collapsed && unread > 0 && (
                <span className="ml-auto rounded-full bg-[var(--red)]/15 px-1.5 text-[11px] font-semibold text-[var(--red)]">{unread}</span>
              )}
            </button>
          ) : (
            <button
              aria-label={t(lang, "notifications")}
              className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[8px] text-[var(--t2)] transition-colors hover:bg-[var(--bg3)] cursor-pointer"
            >
              {icon}
            </button>
          )
        }
      />
      <PopoverContent align={variant === "nav" ? "start" : "end"} sideOffset={6} className="w-[340px] max-w-[90vw] p-3">
        <div className="mb-1 text-[11px] font-medium uppercase tracking-widest text-[var(--t4)]">{t(lang, "notifications")}</div>
        {items === null ? (
          <div className="py-2 text-[12px] text-[var(--t3)]">…</div>
        ) : days.size === 0 ? (
          <div className="py-2 text-[12px] text-[var(--t3)]">{t(lang, "notifEmpty")}</div>
        ) : (
          <div className="flex max-h-[380px] flex-col gap-2 overflow-y-auto">
            {[...days.entries()].map(([day, list]) => {
              const loud = list.filter((i) => i.severity !== "info" || i.body.changes.count > 0);
              const quiet = list.length - loud.length;
              return (
                <div key={day}>
                  <div className="num text-[11px] font-semibold text-[var(--t3)]">{day}</div>
                  {loud.map((it) => <DigestLine key={it.id} item={it} lang={lang} />)}
                  {quiet > 0 && (
                    <div className="py-1 text-[12px] text-[var(--t3)]">✓ {quiet} {t(lang, "notifClientsQuiet")}</div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
