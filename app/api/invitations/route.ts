import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getUserRole } from "@/lib/auth";
import { generateToken, getExpiryDate } from "@/lib/invitations";

export async function POST(req: NextRequest) {
  try {
    const { role, agencyId } = await getUserRole();
    if (role !== "owner" || !agencyId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { email, role: inviteRole, client_ids } = body;

    if (!email || !inviteRole || !client_ids) {
      return NextResponse.json({ error: "email, role, and client_ids are required" }, { status: 400 });
    }

    const token = generateToken();
    const expiresAt = getExpiryDate(7);

    const supabase = await createServerSupabase();
    const { data, error } = await supabase
      .from("invitations")
      .insert({
        agency_id: agencyId,
        email,
        role: inviteRole,
        client_ids,
        token,
        expires_at: expiresAt,
        accepted: false,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create invitation";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET() {
  try {
    const { role, agencyId } = await getUserRole();
    if (role !== "owner" || !agencyId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const supabase = await createServerSupabase();
    const { data, error } = await supabase
      .from("invitations")
      .select("*")
      .eq("agency_id", agencyId)
      .eq("accepted", false)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data ?? []);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to list invitations";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
