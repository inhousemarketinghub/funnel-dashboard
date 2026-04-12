"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

interface Props {
  client: {
    id: string;
    name: string;
    sheet_id: string;
    logo_url: string | null;
    funnel_type: string;
  };
  isAdmin?: boolean;
}

export function ClientCard({ client, isAdmin = false }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(client.name);
  const [saving, setSaving] = useState(false);

  async function handleRename() {
    if (!name.trim() || name === client.name) {
      setEditing(false);
      setName(client.name);
      return;
    }
    setSaving(true);
    const supabase = createClient();
    await supabase.from("clients").update({ name: name.trim() }).eq("id", client.id);
    setSaving(false);
    setEditing(false);
    router.refresh();
  }

  async function handleDelete() {
    if (!window.confirm(`Delete "${client.name}"? This cannot be undone.`)) return;
    const supabase = createClient();
    await supabase.from("clients").delete().eq("id", client.id);
    router.refresh();
  }

  return (
    <div className="card-base relative group" style={{ cursor: "pointer" }}>
      {/* Main clickable area */}
      <div onClick={() => !editing && router.push(`/${client.id}`)}>
        <div className="flex items-center gap-3 mb-2">
          {client.logo_url && (
            <img src={client.logo_url} alt="" className="w-8 h-8 rounded-[6px] object-contain bg-white p-[1px]" />
          )}
          {editing ? (
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={handleRename}
              onKeyDown={(e) => { if (e.key === "Enter") handleRename(); if (e.key === "Escape") { setEditing(false); setName(client.name); } }}
              onClick={(e) => e.stopPropagation()}
              className="font-heading text-[18px] font-semibold tracking-tight text-[var(--t1)] bg-transparent border-b border-[var(--blue)] outline-none w-full"
              disabled={saving}
            />
          ) : (
            <span className="font-heading text-[18px] font-semibold tracking-tight text-[var(--t1)]">{client.name}</span>
          )}
        </div>
        <p className="text-[13px] text-[var(--t3)] num">Sheet: {client.sheet_id.slice(0, 20)}...</p>
        <p className="text-[12px] text-[var(--t4)] mt-1">Funnel: {client.funnel_type}</p>
      </div>

      {/* Action buttons — visible on hover */}
      {isAdmin && <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={(e) => { e.stopPropagation(); setEditing(true); }}
          className="text-[11px] text-[var(--t3)] hover:text-[var(--t1)] px-2 py-1 rounded-[4px] hover:bg-[var(--bg3)] transition-colors"
          title="Rename"
        >
          Rename
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); handleDelete(); }}
          className="text-[11px] text-[var(--red)] hover:text-white px-2 py-1 rounded-[4px] hover:bg-[var(--red)] transition-colors"
          title="Delete"
        >
          Delete
        </button>
      </div>}

      {/* Manage Access link for owners */}
      {isAdmin && (
        <div className="mt-2 pt-2 border-t border-[var(--border)]" onClick={(e) => e.stopPropagation()}>
          <Link
            href={`/projects/access?project=${client.id}&name=${encodeURIComponent(client.name)}`}
            className="text-[11px] text-[var(--t3)] hover:text-[var(--blue)] transition-colors"
          >
            Manage Access
          </Link>
        </div>
      )}
    </div>
  );
}
