import { createServerSupabase } from "@/lib/supabase/server";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default async function ClientsPage() {
  const supabase = await createServerSupabase();
  const { data: clients } = await supabase
    .from("clients")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <div className="min-h-dvh bg-[#FAFAF9] p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="font-[family-name:var(--font-geist-sans)] text-2xl font-bold tracking-tight text-[#1C1917]">Clients</h1>
          <Link href="/clients/new">
            <Button className="bg-[#D97706] hover:bg-[#B45309] text-white">+ Add Client</Button>
          </Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {clients?.map((client) => (
            <Link key={client.id} href={`/${client.id}`}>
              <Card className="border-[rgba(214,211,209,0.5)] hover:border-[#D97706]/30 cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
                <CardHeader>
                  <CardTitle className="font-[family-name:var(--font-geist-sans)] text-lg tracking-tight">{client.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-[#78716C] font-[family-name:var(--font-geist-mono)]">Sheet: {client.sheet_id.slice(0, 20)}...</p>
                  <p className="text-xs text-[#78716C] mt-1">Funnel: {client.funnel_type}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
          {(!clients || clients.length === 0) && (
            <p className="text-[#78716C] col-span-2 text-center py-12">No clients yet. Add your first client to get started.</p>
          )}
        </div>
      </div>
    </div>
  );
}
