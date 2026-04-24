import { createServerSupabase } from "@/lib/supabase/server";
import { fetchTrends } from "@/lib/trends";
import { detectBrandsOrdered } from "@/lib/sheets";
import {
  parseDateParam,
  snapToGranularity,
  getDefaultRange,
  type Granularity,
  type DateRangeObj,
} from "@/lib/dates";
import { notFound } from "next/navigation";
import { TrendsClient } from "./trends-client";

function resolveTrendParams(sp: { [k: string]: string | string[] | undefined }): {
  granularity: Granularity;
  range: DateRangeObj;
  brand: string | null;
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

  return { granularity, range, brand };
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
  const { granularity, range, brand } = resolveTrendParams(sp);

  const trendData = await fetchTrends({
    sheetId: client.sheet_id,
    granularity,
    from: range.from,
    to: range.to,
    brandName: brand,
  });

  return (
    <TrendsClient
      data={trendData}
      brands={brands}
      selectedBrand={brand}
      clientId={clientId}
      granularity={granularity}
      range={range}
    />
  );
}
