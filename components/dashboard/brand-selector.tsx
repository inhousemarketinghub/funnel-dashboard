"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

interface Props {
  clientId: string;
  brands: string[];
}

export function BrandSelector({ clientId, brands }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const currentBrand = searchParams.get("brand") || brands[0] || "";

  function handleChange(brand: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("brand", brand);
    startTransition(() => {
      router.replace(`/${clientId}?${params.toString()}`);
    });
  }

  if (brands.length <= 1) return null;

  return (
    <div className="flex items-center gap-[6px]">
      {brands.map((b) => (
        <button
          key={b}
          onClick={() => handleChange(b)}
          className={`text-[12px] py-[5px] px-3 rounded-[6px] border transition-all ${
            currentBrand === b
              ? "border-[var(--blue)] bg-[var(--blue-bg)] text-[var(--blue)] font-medium"
              : "border-[var(--border)] text-[var(--t3)] hover:text-[var(--t1)] hover:border-[var(--border-hover)]"
          } ${isPending ? "opacity-60" : ""}`}
        >
          {b}
        </button>
      ))}
    </div>
  );
}
