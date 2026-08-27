"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { t, type Lang } from "@/lib/i18n";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

interface Props {
  clientId: string;
  /** Distinct Source values from the lead tab, most frequent first */
  availableSources: string[];
  /** Sources currently in effect server-side (URL selection OR profile default).
   *  Lets the checkmarks reflect a profile-applied default when the URL is bare. */
  activeSources?: string[];
  lang?: Lang;
}

/**
 * Multi-select source filter for the person-performance section. Selection
 * lives in the ?source= URL param (comma-joined) — same mechanism as the date
 * range and brand selector, so it survives refreshes and date changes and the
 * server recomputes the aggregation. Options come from the sheet's actual
 * Source values, so new sources (TikTok, Google…) appear with zero code.
 */
export function SourceFilter({ clientId, availableSources, activeSources, lang = "en" }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const raw = searchParams.get("source") || "";
  const isExplicitAll = raw === "all";
  // Optimistic selection: checkmarks must flip the instant the user clicks.
  // The URL only commits AFTER the server re-renders the whole page (sheet
  // fetches included — seconds), and a menu that shows nothing for seconds
  // reads as broken. `optimistic` is keyed to the raw param it was derived
  // from: the moment a navigation commits (raw changes), it self-invalidates
  // and the URL becomes the source of truth again. No effects needed.
  const [optimistic, setOptimistic] = useState<{ raw: string; sel: Set<string> } | null>(null);
  const urlSelected = new Set(
    isExplicitAll ? [] : raw.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean),
  );
  // Bare URL + profile default → checkmarks show the default in effect
  const baseSelected = !raw && activeSources?.length
    ? new Set(activeSources.map((s) => s.toLowerCase()))
    : urlSelected;
  const selected = optimistic && optimistic.raw === raw ? optimistic.sel : baseSelected;
  const allSelected = selected.size === 0;
  const hasProfileDefault = (activeSources?.length ?? 0) > 0;

  if (availableSources.length === 0) return null;

  function apply(next: Set<string>) {
    setOptimistic({ raw, sel: next }); // instant visual feedback
    const params = new URLSearchParams(searchParams.toString());
    // Selecting everything (or nothing) = unfiltered → drop the param entirely
    if (next.size === 0 || next.size >= availableSources.length) {
      // A client with a profile default needs an explicit "all" to escape it
      if (hasProfileDefault) params.set("source", "all");
      else params.delete("source");
    } else {
      const labels = availableSources.filter((s) => next.has(s.toLowerCase()));
      params.set("source", labels.join(","));
    }
    startTransition(() => {
      router.replace(`/${clientId}?${params.toString()}`, { scroll: false });
    });
  }

  function toggle(source: string) {
    const key = source.toLowerCase();
    const next = new Set(selected);
    if (allSelected) {
      // From "all" state, ticking one means "only this one"
      next.clear();
      next.add(key);
    } else if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    apply(next);
  }

  const label = allSelected
    ? t(lang, "allSources")
    : availableSources.filter((s) => selected.has(s.toLowerCase())).join(", ");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={`text-[12px] py-[5px] px-3 rounded-[6px] border border-[var(--border)] text-[var(--t3)] hover:text-[var(--t1)] hover:border-[var(--border-hover)] transition-all max-w-[220px] truncate ${isPending ? "opacity-60" : ""}`}
      >
        {t(lang, "source")}: {label} ▾
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[180px]">
        <DropdownMenuItem onClick={() => apply(new Set())} className="text-[13px]">
          {t(lang, "allSources")}
          {allSelected && <span className="ml-auto">✓</span>}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {availableSources.map((s) => (
          <DropdownMenuCheckboxItem
            key={s}
            className="text-[13px]"
            checked={!allSelected && selected.has(s.toLowerCase())}
            onCheckedChange={() => toggle(s)}
            closeOnClick={false} // keep the menu open while multi-selecting
          >
            {s}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
