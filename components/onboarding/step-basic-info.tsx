"use client";

import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { OnboardingState } from "@/lib/types";

const INDUSTRIES = ["Beauty", "Education", "Property", "F&B", "Health", "Other"];

interface Props {
  state: OnboardingState;
  setState: React.Dispatch<React.SetStateAction<OnboardingState>>;
  next: () => void;
}

export function StepBasicInfo({ state, setState, next }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  function toggleIndustry(ind: string) {
    setState((s) => ({ ...s, industry: s.industry === ind ? "" : ind }));
  }

  function handleFileDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.size <= 2 * 1024 * 1024) {
      setState((s) => ({ ...s, logoFile: file }));
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file && file.size <= 2 * 1024 * 1024) {
      setState((s) => ({ ...s, logoFile: file }));
    }
  }

  const logoPreview = state.logoFile
    ? URL.createObjectURL(state.logoFile)
    : null;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-heading text-[20px] font-semibold text-[var(--t1)] mb-1">
          Basic Info
        </h2>
        <p className="text-[13px] text-[var(--t3)]">
          Tell us about your new client.
        </p>
      </div>

      {/* Client Name */}
      <div className="space-y-1">
        <Label className="text-[var(--t2)] text-[13px] font-medium">
          Client Name <span className="text-[var(--red)]">*</span>
        </Label>
        <Input
          placeholder="e.g. Dream Crafter"
          value={state.name}
          onChange={(e) => setState((s) => ({ ...s, name: e.target.value }))}
          className="border-[var(--border)] focus-visible:ring-[var(--blue)]"
        />
      </div>

      {/* Industry */}
      <div className="space-y-2">
        <Label className="text-[var(--t2)] text-[13px] font-medium">Industry</Label>
        <div className="flex flex-wrap gap-2">
          {INDUSTRIES.map((ind) => {
            const active = state.industry === ind;
            return (
              <button
                key={ind}
                type="button"
                onClick={() => toggleIndustry(ind)}
                className="text-[12px] font-medium px-3 py-1.5 rounded-full border transition-all duration-150"
                style={{
                  background: active ? "var(--blue)" : "var(--bg3)",
                  color: active ? "#fff" : "var(--t2)",
                  borderColor: active ? "var(--blue)" : "var(--border)",
                }}
              >
                {ind}
              </button>
            );
          })}
        </div>
      </div>

      {/* Logo Upload */}
      <div className="space-y-2">
        <Label className="text-[var(--t2)] text-[13px] font-medium">
          Logo <span className="text-[var(--t4)] font-normal">(optional, max 2MB)</span>
        </Label>
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleFileDrop}
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed rounded-[10px] p-6 flex flex-col items-center justify-center cursor-pointer transition-all duration-150 hover:border-[var(--blue)] hover:bg-[var(--blue-bg)]"
          style={{ borderColor: "var(--border)", background: "var(--bg3)" }}
        >
          {logoPreview ? (
            <div className="flex flex-col items-center gap-2">
              <img
                src={logoPreview}
                alt="Logo preview"
                className="h-16 w-16 object-contain rounded-[6px]"
              />
              <span className="text-[12px] text-[var(--t3)]">
                {state.logoFile?.name}
              </span>
              <span className="text-[11px] text-[var(--blue)] font-medium">
                Click to replace
              </span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-1 text-center">
              <div className="text-[28px] mb-1" aria-hidden>
                &#128247;
              </div>
              <span className="text-[13px] text-[var(--t2)] font-medium">
                Drag & drop or click to upload
              </span>
              <span className="text-[11px] text-[var(--t4)]">
                PNG, JPG, SVG — max 2MB
              </span>
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>
      </div>

      <div className="flex justify-end pt-2">
        <Button
          onClick={next}
          disabled={!state.name.trim()}
          className="bg-[var(--blue)] hover:bg-[#153D7A] text-white px-6"
        >
          Next →
        </Button>
      </div>
    </div>
  );
}
