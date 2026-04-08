"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { OnboardingState, MemberRole } from "@/lib/types";

interface Props {
  state: OnboardingState;
  setState: React.Dispatch<React.SetStateAction<OnboardingState>>;
  back: () => void;
  onComplete: (state: OnboardingState) => Promise<void>;
  completing: boolean;
}

export function StepInviteTeam({
  state,
  setState,
  back,
  onComplete,
  completing,
}: Props) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<MemberRole>("viewer");
  const [emailError, setEmailError] = useState<string | null>(null);

  function validateEmail(val: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val.trim());
  }

  function handleAdd() {
    const trimmed = email.trim();
    if (!validateEmail(trimmed)) {
      setEmailError("Please enter a valid email address.");
      return;
    }
    if (state.invites.some((i) => i.email === trimmed)) {
      setEmailError("This email is already in the invite list.");
      return;
    }
    setState((s) => ({
      ...s,
      invites: [...s.invites, { email: trimmed, role }],
    }));
    setEmail("");
    setEmailError(null);
  }

  function handleRemove(idx: number) {
    setState((s) => ({
      ...s,
      invites: s.invites.filter((_, i) => i !== idx),
    }));
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAdd();
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-heading text-[20px] font-semibold text-[var(--t1)] mb-1">
          Invite Team
        </h2>
        <p className="text-[13px] text-[var(--t3)]">
          Add team members who need access to this client. You can do this later too.
        </p>
      </div>

      {/* Add invite form */}
      <div className="space-y-2">
        <Label className="text-[var(--t2)] text-[13px] font-medium">
          Email address
        </Label>
        <div className="flex gap-2">
          <Input
            type="email"
            placeholder="team@example.com"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setEmailError(null);
            }}
            onKeyDown={handleKeyDown}
            className="border-[var(--border)] focus-visible:ring-[var(--blue)] flex-1"
          />
          {/* Role selector */}
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as MemberRole)}
            className="border rounded-[6px] px-2 text-[13px] bg-[var(--bg2)] text-[var(--t1)] focus:outline-none focus:ring-2 focus:ring-[var(--blue)] transition-colors"
            style={{ borderColor: "var(--border)", minWidth: 110 }}
          >
            <option value="viewer">Viewer</option>
            <option value="manager">Manager</option>
          </select>
          <Button
            onClick={handleAdd}
            disabled={!email.trim()}
            className="bg-[var(--blue)] hover:bg-[#153D7A] text-white px-4 shrink-0"
          >
            Add
          </Button>
        </div>
        {emailError && (
          <p className="text-[11px]" style={{ color: "var(--red)" }}>
            {emailError}
          </p>
        )}
      </div>

      {/* Invite list */}
      <div>
        {state.invites.length === 0 ? (
          <div
            className="py-8 text-center rounded-[10px] border-2 border-dashed"
            style={{ borderColor: "var(--border)", color: "var(--t4)" }}
          >
            <p className="text-[13px]">No invites added yet.</p>
            <p className="text-[11px] mt-1">
              Add email addresses above to invite teammates.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <div
              className="font-label text-[10px] uppercase tracking-widest mb-2"
              style={{ color: "var(--t4)" }}
            >
              Pending Invites ({state.invites.length})
            </div>
            {state.invites.map((invite, idx) => (
              <div
                key={invite.email}
                className="flex items-center justify-between px-3 py-2 rounded-[8px] border"
                style={{
                  borderColor: "var(--border)",
                  background: "var(--bg3)",
                }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold shrink-0"
                    style={{ background: "var(--sand)", color: "var(--t2)" }}
                  >
                    {invite.email.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="text-[13px] font-medium text-[var(--t1)]">
                      {invite.email}
                    </div>
                    <div
                      className="font-label text-[10px] uppercase tracking-wide"
                      style={{ color: "var(--t4)" }}
                    >
                      {invite.role}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemove(idx)}
                  className="text-[12px] px-2 py-1 rounded transition-colors hover:bg-[var(--red-bg)] hover:text-[var(--red)]"
                  style={{ color: "var(--t4)" }}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Nav */}
      <div className="flex justify-between pt-2">
        <button type="button" onClick={back} className="topbar-btn">
          ← Back
        </button>
        <Button
          onClick={() => onComplete(state)}
          disabled={completing}
          className="px-6 font-medium"
          style={{
            background: completing ? "var(--border)" : "var(--green)",
            color: "#fff",
          }}
        >
          {completing ? (
            <span className="flex items-center gap-2">
              <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Creating...
            </span>
          ) : (
            "Complete Onboarding ✓"
          )}
        </Button>
      </div>
    </div>
  );
}
