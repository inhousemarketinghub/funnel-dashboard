"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Input } from "@/components/ui/input";

// The tail end of the "forgot password" flow. The recovery link lands on
// /auth/callback (which exchanges the code and sets a session cookie) and then
// redirects here, so by this point the visitor holds a short-lived recovery
// session and can set a new password. Without that session we tell them to
// request a fresh link rather than silently failing.
export default function ResetPasswordPage() {
  const supabase = createClient();
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [checking, setChecking] = useState(true);
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setHasSession(!!data.user);
      setChecking(false);
    });
  }, [supabase]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 6) { setError("Password must be at least 6 characters"); return; }
    if (password !== confirm) { setError("The two passwords do not match"); return; }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) { setError(error.message); return; }
    setDone(true);
    setTimeout(() => { router.push("/projects"); router.refresh(); }, 1200);
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-[var(--bg)]">
      <div className="w-full max-w-[420px] px-6">
        <div className="mb-12 text-center">
          <div className="font-label mb-4 text-[11px] uppercase text-[var(--t4)]" style={{ letterSpacing: "0.2em" }}>
            PERFORMANCE TRACKER
          </div>
          <h1 className="font-heading text-[36px] font-semibold leading-tight tracking-tight text-[var(--t1)]">
            Set a New Password
          </h1>
          <p className="mt-3 text-[14px] font-light text-[var(--t3)]">Choose a new password for your account</p>
        </div>

        {error && <div className="mb-6 rounded-xl bg-[var(--red-bg)] p-3 text-center text-[13px] text-[var(--red)]">{error}</div>}

        {done ? (
          <div className="rounded-xl bg-[var(--green-bg)] p-3 text-center text-[13px] text-[var(--green)]">
            Password updated — signing you in…
          </div>
        ) : checking ? (
          <p className="text-center text-[13px] text-[var(--t4)]">Loading…</p>
        ) : !hasSession ? (
          <div className="text-center">
            <div className="mb-6 rounded-xl bg-[var(--red-bg)] p-3 text-[13px] text-[var(--red)]">
              This reset link is invalid or has expired.
            </div>
            <Link href="/login" className="text-[13px] text-[var(--t3)] transition-colors hover:text-[var(--t1)]">
              Request a new link
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="font-label mb-1.5 block text-[11px] uppercase text-[var(--t4)]" style={{ letterSpacing: "0.1em" }}>New password</label>
              <Input type="password" placeholder="Min 6 characters" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} className="h-11 rounded-xl border-[var(--border)] focus-visible:ring-[var(--blue)]" />
            </div>
            <div>
              <label className="font-label mb-1.5 block text-[11px] uppercase text-[var(--t4)]" style={{ letterSpacing: "0.1em" }}>Confirm new password</label>
              <Input type="password" placeholder="Re-enter password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={6} className="h-11 rounded-xl border-[var(--border)] focus-visible:ring-[var(--blue)]" />
            </div>
            <button type="submit" disabled={loading} className="h-12 w-full rounded-xl text-[13px] font-medium transition-colors" style={{ background: "var(--t1)", color: "var(--bg)" }}>
              {loading ? "Saving…" : "Update Password"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
