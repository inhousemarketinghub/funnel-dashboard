import { createServerSupabase } from "@/lib/supabase/server";
import Link from "next/link";
import { ClientCard } from "@/components/dashboard/client-card";

export default async function ClientsPage() {
  const supabase = await createServerSupabase();
  const { data: clients } = await supabase
    .from("clients")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <div className="min-h-dvh bg-[var(--bg)]" style={{ transition: "background 500ms ease" }}>
      <div className="bauhaus-stripe"><div /><div /><div /><div /></div>
      <div className="max-w-4xl mx-auto p-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="font-heading text-[28px] font-semibold tracking-tight text-[var(--t1)]">Business Performance Tracker Dashboard</h1>
            <p className="text-[13px] text-[var(--t3)] mt-1">Select a client to view performance</p>
          </div>
          <Link href="/clients/new" className="topbar-btn" style={{ background: "var(--blue)", color: "white", borderColor: "var(--blue)" }}>
            + Add Client
          </Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-[10px]">
          {clients?.map((client) => (
            <ClientCard key={client.id} client={client} />
          ))}
          {(!clients || clients.length === 0) && (
            <p className="text-[var(--t3)] col-span-2 text-center py-12">No clients yet. Add your first client to get started.</p>
          )}
        </div>
      </div>
    </div>
  );
}
