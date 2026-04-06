"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (isSignUp) {
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
      <div className="card-base w-full max-w-md" style={{ borderRadius: 14, padding: 32 }}>
        <div className="text-center mb-6">
          <h1 className="font-heading text-[28px] font-semibold tracking-tight text-[var(--t1)]">Funnel</h1>
          <p className="text-[var(--t3)] text-[14px] mt-1">Marketing agency performance platform</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input type="email" placeholder="your@email.com" value={email} onChange={(e) => setEmail(e.target.value)} required className="border-[var(--border)] focus-visible:ring-[var(--blue)]" />
          <Input type="password" placeholder="Password (min 6 chars)" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} className="border-[var(--border)] focus-visible:ring-[var(--blue)]" />
          {error && <p className="text-sm text-[var(--red)]">{error}</p>}
          <Button type="submit" className="w-full bg-[var(--blue)] hover:bg-[#153D7A] text-white active:translate-y-px transition-transform" disabled={loading}>
            {loading ? "Loading..." : isSignUp ? "Sign Up" : "Sign In"}
          </Button>
          <button type="button" onClick={() => setIsSignUp(!isSignUp)} className="w-full text-sm text-[var(--t3)] hover:text-[var(--t1)] transition-colors">
            {isSignUp ? "Already have an account? Sign In" : "No account? Sign Up"}
          </button>
        </form>
      </div>
    </div>
  );
}
