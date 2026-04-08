"use client";

import { useState } from "react";
import type { MemberRole } from "@/lib/types";

interface InviteDialogProps {
  clients: { id: string; name: string }[];
  open: boolean;
  onClose: () => void;
  onInvite: (email: string, role: MemberRole, clientIds: string[]) => Promise<void>;
}

export function InviteDialog({ clients, open, onClose, onInvite }: InviteDialogProps) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<MemberRole>("viewer");
  const [selectedClients, setSelectedClients] = useState<string[]>([]);
  const [sending, setSending] = useState(false);

  if (!open) return null;

  function toggleClient(clientId: string) {
    setSelectedClients((prev) =>
      prev.includes(clientId) ? prev.filter((id) => id !== clientId) : [...prev, clientId]
    );
  }

  async function handleSubmit() {
    if (!email || selectedClients.length === 0 || sending) return;
    setSending(true);
    try {
      await onInvite(email, role, selectedClients);
      setEmail("");
      setRole("viewer");
      setSelectedClients([]);
      onClose();
    } finally {
      setSending(false);
    }
  }

  const canSubmit = email.trim().length > 0 && selectedClients.length > 0 && !sending;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.30)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl p-6 flex flex-col gap-5 shadow-xl"
        style={{ background: "var(--bg2)", border: "1px solid var(--border)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div>
          <h2 className="font-heading text-[18px] font-semibold text-[var(--t1)]">
            Invite Team Member
          </h2>
          <p className="text-[13px] text-[var(--t3)] mt-0.5">
            Send an email invitation to grant dashboard access.
          </p>
        </div>

        {/* Email input */}
        <div className="flex flex-col gap-1.5">
          <label className="font-label text-[11px] text-[var(--t3)] uppercase tracking-wider">
            Email address
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@example.com"
            className="w-full text-[14px] px-3 py-2 rounded-lg outline-none transition-colors"
            style={{
              background: "var(--bg)",
              border: "1px solid var(--border)",
              color: "var(--t1)",
            }}
          />
        </div>

        {/* Role selection */}
        <div className="flex flex-col gap-1.5">
          <label className="font-label text-[11px] text-[var(--t3)] uppercase tracking-wider">
            Role
          </label>
          <div className="grid grid-cols-2 gap-2">
            {(["manager", "viewer"] as const).map((r) => (
              <button
                key={r}
                onClick={() => setRole(r)}
                className="flex flex-col gap-0.5 p-3 rounded-xl text-left transition-all"
                style={{
                  border: role === r ? "1.5px solid var(--blue)" : "1.5px solid var(--border)",
                  background: role === r ? "var(--blue-bg)" : "var(--bg)",
                }}
              >
                <span
                  className="font-label text-[12px] font-semibold capitalize"
                  style={{ color: role === r ? "var(--blue)" : "var(--t1)" }}
                >
                  {r}
                </span>
                <span className="text-[11px]" style={{ color: "var(--t3)" }}>
                  {r === "manager"
                    ? "Can view dashboards, reports, and edit settings"
                    : "Can view dashboards and reports only"}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Client assignment */}
        {clients.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <label className="font-label text-[11px] text-[var(--t3)] uppercase tracking-wider">
              Assign clients
            </label>
            <div className="flex flex-wrap gap-2">
              {clients.map((client) => {
                const selected = selectedClients.includes(client.id);
                return (
                  <button
                    key={client.id}
                    onClick={() => toggleClient(client.id)}
                    className="text-[12px] px-3 py-1.5 rounded-full transition-all font-label"
                    style={{
                      border: selected ? "1.5px solid var(--blue)" : "1.5px solid var(--border)",
                      background: selected ? "var(--blue-bg)" : "var(--bg)",
                      color: selected ? "var(--blue)" : "var(--t2)",
                    }}
                  >
                    {client.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-1">
          <button
            onClick={onClose}
            className="text-[13px] px-4 py-2 rounded-lg transition-colors"
            style={{ color: "var(--t3)" }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="text-[13px] px-4 py-2 rounded-lg font-medium transition-all"
            style={{
              background: canSubmit ? "var(--blue)" : "var(--border)",
              color: canSubmit ? "white" : "var(--t4)",
              cursor: canSubmit ? "pointer" : "not-allowed",
            }}
          >
            {sending ? "Sending..." : "Send Invite"}
          </button>
        </div>
      </div>
    </div>
  );
}
