import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getUserRole } from "@/lib/auth";
import type { MemberInfo, MemberRole } from "@/lib/types";

export async function GET() {
  try {
    const { role, agencyId, email } = await getUserRole();
    if (role !== "owner" || !agencyId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const supabase = await createServerSupabase();

    // Fetch all clients owned by this agency
    const { data: clients, error: clientsError } = await supabase
      .from("clients")
      .select("id, name")
      .eq("agency_id", agencyId);

    if (clientsError) {
      return NextResponse.json({ error: clientsError.message }, { status: 500 });
    }

    const clientList = clients ?? [];
    const clientIds = clientList.map((c) => c.id);

    // Fetch all project_access records for those clients
    const { data: accessRecords, error: accessError } = await supabase
      .from("project_access")
      .select("client_id, agency_id, role, permissions")
      .in("client_id", clientIds.length > 0 ? clientIds : ["__none__"]);

    if (accessError) {
      return NextResponse.json({ error: accessError.message }, { status: 500 });
    }

    const records = accessRecords ?? [];

    // Get unique agency_ids from access records (excluding the owner's own agencyId)
    const memberAgencyIds = [...new Set(records.map((r) => r.agency_id))].filter(
      (id) => id !== agencyId
    );

    // Fetch agency info for each member
    const agencyInfoMap: Record<string, { email: string }> = {};
    if (memberAgencyIds.length > 0) {
      const { data: agencies } = await supabase
        .from("agencies")
        .select("id, email")
        .in("id", memberAgencyIds);

      for (const agency of agencies ?? []) {
        agencyInfoMap[agency.id] = { email: agency.email };
      }
    }

    // Build member list: owner first (all clients), then each member with their assigned clients
    const ownerMember: MemberInfo = {
      id: agencyId,
      email: email ?? "",
      name: null,
      role: "owner" as MemberRole,
      clients: clientList,
      invited_at: null,
    };

    const memberMap: Record<string, MemberInfo> = {};
    for (const record of records) {
      if (record.agency_id === agencyId) continue; // skip owner's own records

      if (!memberMap[record.agency_id]) {
        const agencyInfo = agencyInfoMap[record.agency_id];
        memberMap[record.agency_id] = {
          id: record.agency_id,
          email: agencyInfo?.email ?? "",
          name: null,
          role: record.role as MemberRole,
          clients: [],
          invited_at: null,
        };
      }

      const client = clientList.find((c) => c.id === record.client_id);
      if (client) {
        memberMap[record.agency_id].clients.push(client);
      }
    }

    const members: MemberInfo[] = [ownerMember, ...Object.values(memberMap)];

    return NextResponse.json(members);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to list team";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { role, agencyId } = await getUserRole();
    if (role !== "owner" || !agencyId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { memberId, newRole, clientIds } = body;

    if (!memberId) {
      return NextResponse.json({ error: "memberId is required" }, { status: 400 });
    }

    const supabase = await createServerSupabase();

    // Update role if provided
    if (newRole) {
      const permissions =
        newRole === "manager"
          ? ["view_dashboard", "view_report", "edit_settings"]
          : ["view_dashboard", "view_report"];

      const { error } = await supabase
        .from("project_access")
        .update({ role: newRole, permissions })
        .eq("agency_id", memberId);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }

    // Update client assignments if provided
    if (clientIds && Array.isArray(clientIds)) {
      // Get current role for this member
      const { data: existing } = await supabase
        .from("project_access")
        .select("client_id, role, permissions")
        .eq("agency_id", memberId);

      const currentClientIds = (existing || []).map((r) => r.client_id);
      const memberRole = existing?.[0]?.role || "viewer";
      const memberPerms = existing?.[0]?.permissions || ["view_dashboard", "view_report"];

      // Remove clients no longer assigned
      const toRemove = currentClientIds.filter((id: string) => !clientIds.includes(id));
      if (toRemove.length > 0) {
        await supabase
          .from("project_access")
          .delete()
          .eq("agency_id", memberId)
          .in("client_id", toRemove);
      }

      // Add newly assigned clients
      const toAdd = clientIds.filter((id: string) => !currentClientIds.includes(id));
      if (toAdd.length > 0) {
        const records = toAdd.map((clientId: string) => ({
          agency_id: memberId,
          client_id: clientId,
          role: memberRole,
          permissions: memberPerms,
        }));
        await supabase.from("project_access").insert(records);
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update role";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { role, agencyId } = await getUserRole();
    if (role !== "owner" || !agencyId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { memberId } = body;

    if (!memberId) {
      return NextResponse.json({ error: "memberId is required" }, { status: 400 });
    }

    const supabase = await createServerSupabase();
    const { error } = await supabase
      .from("project_access")
      .delete()
      .eq("agency_id", memberId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to remove member";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
