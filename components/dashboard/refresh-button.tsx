"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { refreshSheet } from "@/app/[clientId]/actions";

interface Props {
  sheetId: string;
  /**
   * Pre-formatted "last pulled from Google" time (Malaysia time), or null when
   * unknown. Formatted on the server so there is no client/server timezone
   * mismatch — this component just renders the string.
   */
  fetchedAtLabel: string | null;
}

export function RefreshButton({ sheetId, fetchedAtLabel }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleRefresh() {
    startTransition(async () => {
      await refreshSheet(sheetId);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-end gap-0.5">
      <button
        onClick={handleRefresh}
        disabled={isPending}
        title="立即刷新数据"
        aria-label="立即刷新数据"
        className={`
          inline-flex items-center gap-2 px-4 py-2
          bg-[var(--bg2)] border border-[var(--border)] rounded-[10px]
          text-sm text-[var(--t1)]
          hover:border-[var(--border-hover)] transition-all cursor-pointer
          disabled:cursor-not-allowed ${isPending ? "opacity-60" : ""}
        `}
      >
        <RefreshCw className={`w-4 h-4 text-[var(--t3)] ${isPending ? "animate-spin" : ""}`} />
        {isPending ? "刷新中…" : "刷新"}
      </button>
      {fetchedAtLabel && (
        <span className="text-[11px] text-[var(--t3)] num">数据更新于 {fetchedAtLabel}</span>
      )}
    </div>
  );
}
