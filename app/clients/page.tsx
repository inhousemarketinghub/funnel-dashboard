import { createServerSupabase } from "@/lib/supabase/server";
import { getUserRole } from "@/lib/auth";
import Link from "next/link";
import { ClientCard } from "@/components/dashboard/client-card";
import { LogoutButton } from "@/components/dashboard/logout-button";

export default async function ClientsPage() {
  const supabase = await createServerSupabase();
  const { role, email } = await getUserRole();
  const isOwner = role === "owner";


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
            <p className="text-[13px] text-[var(--t3)] mt-1">Select a project to view performance</p>
          </div>
          <div className="flex items-center gap-3">
            {isOwner && (
              <Link href="/clients/new" className="topbar-btn" style={{ background: "var(--blue)", color: "white", borderColor: "var(--blue)" }}>
                + Add Project
              </Link>
            )}
            <span className="text-[11px] text-[var(--t4)] num">{email}</span>
            <LogoutButton />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-[10px]">
          {clients?.map((client) => (
            <ClientCard key={client.id} client={client} isAdmin={isOwner} />
          ))}
          {(!clients || clients.length === 0) && (
            <div className="col-span-2 text-center py-16">
              <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-[var(--sand)] flex items-center justify-center text-[22px] text-[var(--t4)]">+</div>
              {isOwner ? (
                <>
                  <p className="text-[var(--t2)] text-[15px] font-medium mb-1">No projects yet</p>
                  <p className="text-[var(--t4)] text-[13px] mb-4">Create your first project to start tracking performance</p>
                  <Link href="/clients/new" className="topbar-btn inline-flex" style={{ background: "var(--blue)", color: "white", borderColor: "var(--blue)" }}>
                    + Add Project
                  </Link>
                </>
              ) : (
                <>
                  <p className="text-[var(--t2)] text-[15px] font-medium mb-1">No projects assigned</p>
                  <p className="text-[var(--t4)] text-[13px]">Contact your admin to get access to a project</p>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
