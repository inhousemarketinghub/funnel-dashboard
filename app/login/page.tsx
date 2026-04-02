"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/clients` },
    });
    setLoading(false);
    if (!error) setSent(true);
  }

  return (
    <div className="min-h-dvh flex items-center justify-center bg-[#FAFAF9]">
      <Card className="w-full max-w-md border-[rgba(214,211,209,0.5)]">
        <CardHeader className="text-center">
          <CardTitle className="font-[family-name:var(--font-geist-sans)] text-2xl font-bold tracking-tight text-[#1C1917]">Funnel Dashboard</CardTitle>
          <CardDescription className="text-[#78716C]">Marketing agency performance platform</CardDescription>
        </CardHeader>
        <CardContent>
          {sent ? (
            <p className="text-center text-sm text-[#78716C]">Check your email for the magic link.</p>
          ) : (
            <form onSubmit={handleLogin} className="space-y-4">
              <Input type="email" placeholder="your@email.com" value={email} onChange={(e) => setEmail(e.target.value)} required className="border-[rgba(214,211,209,0.5)] focus:ring-[#D97706]" />
              <Button type="submit" className="w-full bg-[#D97706] hover:bg-[#B45309] text-white" disabled={loading}>
                {loading ? "Sending..." : "Send Magic Link"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
