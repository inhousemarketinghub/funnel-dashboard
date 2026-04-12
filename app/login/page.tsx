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
  const [success, setSuccess] = useState<string | null>(null);
  const [mode, setMode] = useState<"signin" | "signup" | "reset">("signin");
  const supabase = createClient();
  const router = useRouter();

  async function handleGoogleLogin() {
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) { setError(error.message); setLoading(false); }
  }

  async function handleEmailLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    if (mode === "reset") {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/login`,
      });
      setLoading(false);
      if (error) { setError(error.message); return; }
      setSuccess("Password reset link sent to your email.");
      return;
    }

    if (mode === "signup") {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) { setError(error.message); setLoading(false); return; }
      setLoading(false);
      setSuccess("Account created! You can now sign in.");
      setMode("signin");
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) { setError(error.message); setLoading(false); return; }
    setLoading(false);
    router.push("/projects");
    router.refresh();
  }

  return (
    <div className="min-h-dvh flex items-center justify-center bg-[var(--bg)]">
      <div className="w-full max-w-[420px] px-6">
        {/* Brand */}
        <div className="text-center mb-12">
          <div className="font-label text-[11px] uppercase text-[var(--t4)] mb-4" style={{ letterSpacing: "0.2em" }}>
            PERFORMANCE TRACKER
          </div>
          <h1 className="font-heading text-[36px] font-semibold tracking-tight text-[var(--t1)] leading-tight">
            {mode === "reset" ? "Reset Password" : mode === "signup" ? "Create Account" : "Welcome Back"}
          </h1>
          <p className="text-[var(--t3)] text-[14px] mt-3 font-light">
            {mode === "reset"
              ? "Enter your email to receive a reset link"
              : mode === "signup"
              ? "Sign up to get started"
              : "Sign in to access your dashboard"}
          </p>
        </div>

        {error && <div className="text-[13px] text-[var(--red)] mb-6 text-center p-3 rounded-xl bg-[var(--red-bg)]">{error}</div>}
        {success && <div className="text-[13px] text-[var(--green)] mb-6 text-center p-3 rounded-xl bg-[var(--green-bg)]">{success}</div>}

        {/* Google — hide in reset mode */}
        {mode !== "reset" && (
          <>
            <button
              onClick={handleGoogleLogin}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 bg-[var(--bg2)] hover:bg-[var(--bg3)] text-[var(--t1)] rounded-xl h-12 text-[13px] font-medium mb-6 transition-colors duration-200"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              {loading ? "Redirecting..." : "Continue with Google"}
            </button>
            <div className="flex items-center gap-4 mb-6">
              <div className="flex-1 h-px bg-[var(--border)]" />
              <span className="text-[11px] text-[var(--t4)] uppercase" style={{ letterSpacing: "0.1em" }}>or</span>
              <div className="flex-1 h-px bg-[var(--border)]" />
            </div>
          </>
        )}

        {/* Email form */}
        <form onSubmit={handleEmailLogin} className="space-y-4">
          <div>
            <label className="font-label text-[11px] uppercase text-[var(--t4)] mb-1.5 block" style={{ letterSpacing: "0.1em" }}>Email</label>
            <Input type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required className="border-[var(--border)] focus-visible:ring-[var(--blue)] h-11 rounded-xl" />
          </div>
          {mode !== "reset" && (
            <div>
              <label className="font-label text-[11px] uppercase text-[var(--t4)] mb-1.5 block" style={{ letterSpacing: "0.1em" }}>Password</label>
              <Input type="password" placeholder="Min 6 characters" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} className="border-[var(--border)] focus-visible:ring-[var(--blue)] h-11 rounded-xl" />
            </div>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full h-12 rounded-xl text-[13px] font-medium transition-colors duration-200"
            style={{ background: "var(--t1)", color: "var(--bg)" }}
          >
            {loading ? "Loading..." : mode === "reset" ? "Send Reset Link" : mode === "signup" ? "Create Account" : "Sign In"}
          </button>
        </form>

        <div className="flex justify-between mt-6">
          {mode === "reset" ? (
            <button type="button" onClick={() => { setMode("signin"); setError(null); setSuccess(null); }} className="text-[12px] text-[var(--t3)] hover:text-[var(--t1)] transition-colors">
              Back to Sign In
            </button>
          ) : (
            <>
              <button type="button" onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setError(null); setSuccess(null); }} className="text-[12px] text-[var(--t3)] hover:text-[var(--t1)] transition-colors">
                {mode === "signin" ? "No account? Sign Up" : "Have an account? Sign In"}
              </button>
              <button type="button" onClick={() => { setMode("reset"); setError(null); setSuccess(null); }} className="text-[12px] text-[var(--t3)] hover:text-[var(--t1)] transition-colors">
                Forgot Password?
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
