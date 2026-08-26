import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { isTokenExpired } from "@/lib/invitations";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const supabase = await createServerSupabase();

    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Find invitation by token
    const { data: invitation, error: inviteError } = await supabase
      .from("invitations")
      .select("*")
      .eq("token", token)
      .eq("accepted", false)
      .single();

    if (inviteError || !invitation) {
      return NextResponse.json({ error: "Invalid or already accepted invitation" }, { status: 404 });
    }

    // Check expiry
    if (isTokenExpired(invitation.expires_at)) {
      return NextResponse.json({ error: "Invitation has expired" }, { status: 410 });
    }

    // Get or create agency record for invited user
    const { data: existingAgency } = await supabase
      .from("agencies")
      .select("id")
      .eq("email", user.email)
      .single();

    let agencyId: string;

    if (existingAgency?.id) {
      agencyId = existingAgency.id;
    } else {
      const { data: newAgency, error: agencyError } = await supabase
        .from("agencies")
        .insert({ email: user.email, role: "user" })
        .select("id")
        .single();

      if (agencyError || !newAgency) {
        return NextResponse.json({ error: "Failed to create agency record" }, { status: 500 });
      }
      agencyId = newAgency.id;
    }

    // Resolve the invited role from the roles table (invitation.role stores
    // the role NAME). Legacy invitations ("manager"/"viewer") match built-ins
    // case-insensitively; unknown names fall back to Viewer-equivalent.
    const { data: roleRow } = await supabase
      .from("roles")
      .select("id, permissions")
      .ilike("name", invitation.role)
      .maybeSingle();
    const rolePerms: string[] = Array.isArray(roleRow?.permissions) ? roleRow.permissions : [];
    const permissions = ["view_dashboard", ...["view_report", "edit_settings", "manage_access"].filter((k) => rolePerms.includes(k))];

    // Create project_access records for each client_id
    const clientIds: string[] = invitation.client_ids ?? [];
    if (clientIds.length > 0) {
      const accessRecords = clientIds.map((clientId: string) => ({
        client_id: clientId,
        agency_id: agencyId,
        role: invitation.role,
        role_id: roleRow?.id ?? null,
        permissions,
      }));

      const { error: accessError } = await supabase
        .from("project_access")
        .upsert(accessRecords, { onConflict: "client_id,agency_id" });

      if (accessError) {
        return NextResponse.json({ error: "Failed to create project access" }, { status: 500 });
      }
    }

    // Mark invitation as accepted
    const { error: updateError } = await supabase
      .from("invitations")
      .update({ accepted: true })
      .eq("id", invitation.id);

    if (updateError) {
      return NextResponse.json({ error: "Failed to mark invitation as accepted" }, { status: 500 });
    }

    return NextResponse.json({ success: true, client_ids: clientIds });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to accept invitation";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
