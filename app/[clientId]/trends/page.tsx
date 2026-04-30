import { createServerSupabase } from "@/lib/supabase/server";
import { fetchTrends } from "@/lib/trends";
import { detectBrandsOrdered } from "@/lib/sheets";
import {
  parseDateParam,
  snapToGranularity,
  getDefaultRange,
  getPreviousPeriodByGranularity,
  type Granularity,
  type DateRangeObj,
} from "@/lib/dates";
import { notFound } from "next/navigation";
import { TrendsClient } from "./trends-client";

function resolveTrendParams(sp: { [k: string]: string | string[] | undefined }): {
  granularity: Granularity;
  range: DateRangeObj;
  brand: string | null;
  compare: boolean;
  comparisonRange: DateRangeObj | null;
} {
  const gRaw = Array.isArray(sp.granularity) ? sp.granularity[0] : sp.granularity;
  const granularity: Granularity = gRaw === "monthly" ? "monthly" : "weekly";

  const parsedFrom = parseDateParam(Array.isArray(sp.from) ? sp.from[0] : sp.from);
  const parsedTo = parseDateParam(Array.isArray(sp.to) ? sp.to[0] : sp.to);
  const validCustom = parsedFrom && parsedTo && parsedFrom.getTime() <= parsedTo.getTime();

  const range = validCustom
    ? snapToGranularity({ from: parsedFrom!, to: parsedTo! }, granularity)
    : getDefaultRange(granularity);

  const brandRaw = Array.isArray(sp.brand) ? sp.brand[0] : sp.brand;
  const brand = brandRaw && brandRaw !== "Overall" ? brandRaw : null;

  const compareRaw = Array.isArray(sp.compare) ? sp.compare[0] : sp.compare;
  const compare = compareRaw === "1" || compareRaw === "true";

  let comparisonRange: DateRangeObj | null = null;
  if (compare) {
    const parsedPrevFrom = parseDateParam(Array.isArray(sp.prevFrom) ? sp.prevFrom[0] : sp.prevFrom);
    const parsedPrevTo = parseDateParam(Array.isArray(sp.prevTo) ? sp.prevTo[0] : sp.prevTo);
    const validPrev = parsedPrevFrom && parsedPrevTo && parsedPrevFrom.getTime() <= parsedPrevTo.getTime();
    comparisonRange = validPrev
      ? snapToGranularity({ from: parsedPrevFrom!, to: parsedPrevTo! }, granularity)
      : getPreviousPeriodByGranularity(range.from, range.to, granularity);
  }

  return { granularity, range, brand, compare, comparisonRange };
}

export default async function TrendsPage({
  params,
  searchParams,
}: {
  params: Promise<{ clientId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { clientId } = await params;
  const sp = await searchParams;
  const supabase = await createServerSupabase();
  const { data: client } = await supabase.from("clients").select("*").eq("id", clientId).single();
  if (!client) notFound();

  const brands = await detectBrandsOrdered(client.sheet_id);
  const { granularity, range, brand, compare, comparisonRange } = resolveTrendParams(sp);

  const bundle = await fetchTrends({
    sheetId: client.sheet_id,
    granularity,
    from: range.from,
    to: range.to,
    comparisonFrom: comparisonRange?.from,
    comparisonTo: comparisonRange?.to,
    brandName: brand,
    funnelType: client.funnel_type,
  });

  return (
    <TrendsClient
      bundle={bundle}
      brands={brands}
      selectedBrand={brand}
      clientId={clientId}
      granularity={granularity}
      range={range}
      compare={compare}
      comparisonRange={comparisonRange}
      funnelType={client.funnel_type ?? "appointment"}
    />
  );
}
