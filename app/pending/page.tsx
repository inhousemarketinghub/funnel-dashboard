"use client";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function PendingPage() {
  const supabase = createClient();
  const router = useRouter();

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <div className="min-h-dvh flex items-center justify-center bg-[var(--bg)]">
      <div className="bauhaus-stripe" style={{ position: "fixed", top: 0, left: 0, right: 0 }}><div /><div /><div /><div /></div>
      <div className="card-base w-full max-w-sm text-center" style={{ borderRadius: 14, padding: 32 }}>
        <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-[var(--yellow-bg)] flex items-center justify-center">
          <span className="text-[24px]" style={{ color: "var(--yellow)" }}>!</span>
        </div>
        <h1 className="font-heading text-[22px] font-semibold tracking-tight text-[var(--t1)] mb-2">Pending Approval</h1>
        <p className="text-[14px] text-[var(--t3)] mb-6">
          Your account is awaiting admin approval. You&apos;ll be able to access the dashboard once approved.
        </p>
        <button
          onClick={handleSignOut}
          className="topbar-btn mx-auto"
        >
          Sign Out
        </button>
      </div>
    </div>
  );
}
