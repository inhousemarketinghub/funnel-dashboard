"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const supabase = createClient();
  const router = useRouter();

  async function handleGoogleLogin() {
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) { setError(error.message); setLoading(false); }
  }

  async function handleEmailLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (mode === "signup") {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) { setError(error.message); setLoading(false); return; }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) { setError(error.message); setLoading(false); return; }
    }

    setLoading(false);
    router.push("/clients");
    router.refresh();
  }

  return (
    <div className="min-h-dvh flex items-center justify-center bg-[var(--bg)]">
      <div className="bauhaus-stripe" style={{ position: "fixed", top: 0, left: 0, right: 0 }}><div /><div /><div /><div /></div>
      <div className="card-base w-full max-w-sm" style={{ borderRadius: 14, padding: 32 }}>
        <div className="text-center mb-6">
          <h1 className="font-heading text-[28px] font-semibold tracking-tight text-[var(--t1)]">Business Performance</h1>
          <h1 className="font-heading text-[28px] font-semibold tracking-tight text-[var(--t1)]">Tracker</h1>
          <p className="text-[var(--t3)] text-[14px] mt-2">Sign in to access your dashboard</p>
        </div>

        {error && <p className="text-sm text-[var(--red)] mb-4 text-center">{error}</p>}

        {/* Google */}
        <Button
          onClick={handleGoogleLogin}
          disabled={loading}
          className="w-full bg-[var(--bg2)] hover:bg-[var(--bg3)] text-[var(--t1)] border border-[var(--border)] hover:border-[var(--border-hover)] transition-all h-11 mb-4"
          style={{ fontWeight: 500 }}
        >
          <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          {loading ? "Redirecting..." : "Sign in with Google"}
        </Button>

        {/* Divider */}
        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 h-px bg-[var(--border)]" />
          <span className="text-[11px] text-[var(--t4)]">or</span>
          <div className="flex-1 h-px bg-[var(--border)]" />
        </div>

        {/* Email */}
        <form onSubmit={handleEmailLogin} className="space-y-3">
          <Input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="border-[var(--border)] focus-visible:ring-[var(--blue)] h-10"
          />
          <Input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            className="border-[var(--border)] focus-visible:ring-[var(--blue)] h-10"
          />
          <Button
            type="submit"
            disabled={loading}
            className="w-full bg-[var(--t1)] hover:bg-[var(--t2)] text-[var(--bg)] h-10"
          >
            {loading ? "Loading..." : mode === "signup" ? "Sign Up" : "Sign In"}
          </Button>
        </form>

        <button
          type="button"
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          className="w-full text-[12px] text-[var(--t3)] hover:text-[var(--t1)] transition-colors mt-3 text-center"
        >
          {mode === "signin" ? "No account? Sign Up" : "Already have an account? Sign In"}
        </button>
      </div>
    </div>
  );
}
