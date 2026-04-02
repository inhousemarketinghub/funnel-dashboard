"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

export default function NewClientPage() {
  const [name, setName] = useState("");
  const [sheetId, setSheetId] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    let { data: agency } = await supabase.from("agencies").select("id").eq("email", user.email).single();
    if (!agency) {
      const { data } = await supabase.from("agencies").insert({ email: user.email!, name: user.email!.split("@")[0] }).select("id").single();
      agency = data;
    }
    if (!agency) { setLoading(false); return; }

    const { data: client } = await supabase.from("clients").insert({
      agency_id: agency.id, name, sheet_id: sheetId,
    }).select("id").single();

    if (client) {
      const now = new Date();
      const month = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
      await supabase.from("kpi_configs").insert({ client_id: client.id, month });
      router.push(`/${client.id}`);
    }
    setLoading(false);
  }

  return (
    <div className="min-h-dvh bg-[#FAFAF9] p-8 flex justify-center">
      <Card className="w-full max-w-lg border-[rgba(214,211,209,0.5)] h-fit mt-12">
        <CardHeader>
          <CardTitle className="font-[family-name:var(--font-geist-sans)] tracking-tight">Add New Client</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label className="text-[#78716C] text-sm">Brand Name</Label>
              <Input placeholder="Dream Crafter" value={name} onChange={(e) => setName(e.target.value)} required className="border-[rgba(214,211,209,0.5)] focus-visible:ring-[#D97706]" />
            </div>
            <div>
              <Label className="text-[#78716C] text-sm">Google Sheet ID</Label>
              <Input placeholder="1cmT6hRKa5USiFv2GoiF57cp_D5x..." value={sheetId} onChange={(e) => setSheetId(e.target.value)} required className="border-[rgba(214,211,209,0.5)] focus-visible:ring-[#D97706] font-[family-name:var(--font-geist-mono)] text-sm" />
              <p className="text-xs text-[#78716C] mt-1">The long ID from your Google Sheet URL</p>
            </div>
            <Button type="submit" className="w-full bg-[#D97706] hover:bg-[#B45309] text-white active:translate-y-px transition-transform" disabled={loading}>
              {loading ? "Creating..." : "Create Client"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
