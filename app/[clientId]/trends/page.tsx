import { createServerSupabase } from "@/lib/supabase/server";
import { fetchMonthlyTrends } from "@/lib/trends";
import { detectBrandsOrdered } from "@/lib/sheets";
import { notFound } from "next/navigation";
import { TrendsClient } from "./trends-client";

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
  const brandParam = sp.brand as string | undefined;
  const selectedBrand = brandParam && brandParam !== "Overall" ? brandParam : null;

  const trendData = await fetchMonthlyTrends(client.sheet_id, 6, selectedBrand);

  return (
    <TrendsClient
      data={trendData}
      brands={brands}
      selectedBrand={selectedBrand}
      clientId={clientId}
    />
  );
}
