import { createServerSupabase } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";

export default async function ClientLayout({ children, params }: { children: React.ReactNode; params: Promise<{ clientId: string }> }) {
  const { clientId } = await params;
  const supabase = await createServerSupabase();
  const { data: client } = await supabase.from("clients").select("*").eq("id", clientId).single();
  if (!client) notFound();

  return (
    <div className="min-h-dvh bg-[#FAFAF9]">
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-sm border-b border-[rgba(214,211,209,0.5)] px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/clients" className="text-[#78716C] hover:text-[#D97706] text-sm transition-colors">← Clients</Link>
          <h1 className="font-[family-name:var(--font-geist-sans)] font-bold text-lg text-[#1C1917] tracking-tight">{client.name}</h1>
        </div>
        <div className="flex items-center gap-3">
          <Link href={`/${clientId}/settings`} className="text-sm text-[#78716C] hover:text-[#D97706] transition-colors">Settings</Link>
        </div>
      </header>
      <main className="max-w-[1200px] mx-auto p-6">{children}</main>
    </div>
  );
}
