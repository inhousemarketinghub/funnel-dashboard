import { createServerSupabase } from "@/lib/supabase/server";
import { fetchMonthlyTrends } from "@/lib/trends";
import { notFound } from "next/navigation";
import { TrendsClient } from "./trends-client";

export default async function TrendsPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  const supabase = await createServerSupabase();
  const { data: client } = await supabase.from("clients").select("*").eq("id", clientId).single();
  if (!client) notFound();

  const trendData = await fetchMonthlyTrends(client.sheet_id, 6, null);

  return <TrendsClient data={trendData} />;
}
