import Link from "next/link";

/**
 * The visible "you" entry point into /account. An avatar + name pill reads as a
 * profile affordance far better than a bare email string did — the old email
 * link was easy to miss. Server-safe (no client hooks): just a styled Link.
 */
export function ProfileButton({
  name,
  email,
  avatarUrl,
  label = "Account",
}: {
  name?: string | null;
  email?: string | null;
  avatarUrl?: string | null;
  label?: string;
}) {
  const display = name || email?.split("@")[0] || label;
  const initial = display.charAt(0).toUpperCase();
  return (
    <Link
      href="/account"
      title={email || label}
      className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--bg2)] py-1 pl-1 pr-3 text-[12px] font-medium text-[var(--t1)] no-underline transition-colors hover:bg-[var(--bg3)]"
    >
      {avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={avatarUrl} alt="" className="h-6 w-6 rounded-full object-cover" />
      ) : (
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--sand)] text-[11px] font-semibold text-[var(--t2)]">
          {initial}
        </span>
      )}
      <span className="max-w-[140px] truncate">{display}</span>
    </Link>
  );
}
