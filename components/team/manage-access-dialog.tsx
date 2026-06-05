"use client";

import { useState } from "react";

interface ManageAccessDialogProps {
  memberLabel: string;
  allClients: { id: string; name: string }[];
  initialSelected: string[];
  onClose: () => void;
  onSave: (clientIds: string[]) => Promise<void> | void;
}

// A focused client-access picker: search + select all/clear + a scrollable
// checklist. Replaces the inline "wall of toggle chips" so it scales to many
// clients. Mounted conditionally by the parent, so it opens with fresh state.
export function ManageAccessDialog({
  memberLabel,
  allClients,
  initialSelected,
  onClose,
  onSave,
}: ManageAccessDialogProps) {
  const [selected, setSelected] = useState<string[]>(initialSelected);
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);

  const filtered = allClients.filter((c) =>
    c.name.toLowerCase().includes(query.toLowerCase()),
  );

  function toggle(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function handleSave() {
    setSaving(true);
    try {
      await onSave(selected);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.30)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl p-6 flex flex-col gap-4 shadow-xl"
        style={{ background: "var(--bg2)", border: "1px solid var(--border)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <h2 className="font-heading text-[18px] font-semibold text-[var(--t1)]">Manage client access</h2>
          <p className="text-[13px] text-[var(--t3)] mt-0.5 truncate">{memberLabel}</p>
        </div>

        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search clients…"
          className="w-full text-[13px] px-3 py-2 rounded-lg border outline-none"
          style={{ background: "var(--bg)", borderColor: "var(--border)", color: "var(--t1)" }}
        />

        <div className="flex items-center justify-between">
          <span className="text-[12px] text-[var(--t4)]">
            {selected.length} of {allClients.length} selected
          </span>
          <div className="flex gap-3">
            <button type="button" onClick={() => setSelected(allClients.map((c) => c.id))} className="text-[12px] text-[var(--blue)] hover:underline">
              Select all
            </button>
            <button type="button" onClick={() => setSelected([])} className="text-[12px] text-[var(--t3)] hover:underline">
              Clear
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-0.5 max-h-[280px] overflow-y-auto -mx-1 px-1">
          {filtered.length === 0 ? (
            <div className="text-[13px] text-[var(--t4)] py-6 text-center">No clients match your search.</div>
          ) : (
            filtered.map((c) => {
              const on = selected.includes(c.id);
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => toggle(c.id)}
                  className="flex items-center gap-2.5 px-2 py-2 rounded-lg text-left transition-colors"
                  style={{ background: on ? "var(--blue-bg)" : "transparent" }}
                >
                  <span
                    className="w-4 h-4 rounded-[5px] flex items-center justify-center flex-shrink-0 text-[10px] font-bold text-white"
                    style={{
                      background: on ? "var(--blue)" : "transparent",
                      border: on ? "1px solid var(--blue)" : "1.5px solid var(--border)",
                    }}
                  >
                    {on ? "✓" : ""}
                  </span>
                  <span className="text-[13px]" style={{ color: on ? "var(--blue)" : "var(--t2)" }}>{c.name}</span>
                </button>
              );
            })
          )}
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="text-[13px] text-[var(--t3)] hover:text-[var(--t1)] px-4 py-2">
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="text-[13px] font-medium px-5 py-2 rounded-full"
            style={{ background: "var(--blue)", color: "white" }}
          >
            {saving ? "Saving…" : "Save access"}
          </button>
        </div>
      </div>
    </div>
  );
}
