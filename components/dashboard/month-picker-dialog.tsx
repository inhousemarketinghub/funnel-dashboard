"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function MonthPickerDialog({ clientId }: { clientId: string }) {
  const router = useRouter();
  const now = new Date();
  const [month, setMonth] = useState(String(now.getMonth() + 1));
  const [year, setYear] = useState(String(now.getFullYear()));
  const [open, setOpen] = useState(false);

  const years = Array.from({ length: 3 }, (_, i) => String(now.getFullYear() - 1 + i));

  function handleGenerate() {
    const m = month.padStart(2, "0");
    window.open(`/${clientId}/report?month=${year}-${m}`, "_blank");
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className="topbar-btn">
        Monthly Performance Overview
      </DialogTrigger>
      <DialogContent className="sm:max-w-[360px]">
        <DialogHeader>
          <DialogTitle className="font-heading text-[20px] font-semibold tracking-tight">
            Select Report Month
          </DialogTitle>
        </DialogHeader>
        <div className="flex gap-3 mt-4">
          <div className="flex-1">
            <label className="text-[11px] text-[var(--t3)] font-label uppercase tracking-wider mb-1 block">Month</label>
            <Select value={month} onValueChange={(v) => v && setMonth(v)}>
              <SelectTrigger className="border-[var(--border)]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MONTHS.map((m, i) => (
                  <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-[100px]">
            <label className="text-[11px] text-[var(--t3)] font-label uppercase tracking-wider mb-1 block">Year</label>
            <Select value={year} onValueChange={(v) => v && setYear(v)}>
              <SelectTrigger className="border-[var(--border)]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {years.map((y) => (
                  <SelectItem key={y} value={y}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <Button
          onClick={handleGenerate}
          className="w-full mt-4 bg-[var(--blue)] hover:bg-[#153D7A] text-white"
        >
          Generate Report
        </Button>
      </DialogContent>
    </Dialog>
  );
}
