"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { WizardShell } from "@/components/onboarding/wizard-shell";
import { StepBasicInfo } from "@/components/onboarding/step-basic-info";
import { StepConnectSheet } from "@/components/onboarding/step-connect-sheet";
import { StepVerifyMapping } from "@/components/onboarding/step-verify-mapping";
import { StepSetKPI } from "@/components/onboarding/step-set-kpi";
import { StepInviteTeam } from "@/components/onboarding/step-invite-team";
import type { OnboardingState } from "@/lib/types";

export default function NewClientPage() {
  const [completing, setCompleting] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleComplete(state: OnboardingState) {
    if (!state.scanResult) return;
    setCompleting(true);

    try {
      // 1. Get current user
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      // 2. Get or create agency
      let { data: agency } = await supabase
        .from("agencies")
        .select("id")
        .eq("email", user.email)
        .single();

      if (!agency) {
        const { data } = await supabase
          .from("agencies")
          .insert({
            email: user.email!,
            name: user.email!.split("@")[0],
          })
          .select("id")
          .single();
        agency = data;
      }

      if (!agency) return;

      // 3. Insert client
      const { data: client } = await supabase
        .from("clients")
        .insert({
          agency_id: agency.id,
          name: state.name.trim(),
          sheet_id: state.sheetId,
          funnel_type: state.scanResult.funnelType,
          status: "active",
          onboarded_at: new Date().toISOString(),
          industry: state.industry || null,
          column_mapping: state.columnMapping ?? null,
        })
        .select("id")
        .single();

      if (!client) return;

      // 4. Upload logo if provided
      if (state.logoFile) {
        const ext = state.logoFile.name.split(".").pop() ?? "png";
        const path = `${client.id}/logo.${ext}`;
        const { data: uploadData } = await supabase.storage
          .from("logos")
          .upload(path, state.logoFile, { upsert: true });

        if (uploadData) {
          const { data: urlData } = supabase.storage
            .from("logos")
            .getPublicUrl(path);
          await supabase
            .from("clients")
            .update({ logo_url: urlData.publicUrl })
            .eq("id", client.id);
        }
      }

      // 5. Upsert KPI config for current month
      const now = new Date();
      const month = new Date(now.getFullYear(), now.getMonth(), 1)
        .toISOString()
        .split("T")[0];

      const kpiEntries = Object.entries(state.kpiConfig).filter(
        ([, v]) => v !== undefined
      );

      if (kpiEntries.length > 0) {
        await supabase.from("kpi_configs").upsert({
          client_id: client.id,
          month,
          ...Object.fromEntries(kpiEntries),
        });
      } else {
        await supabase.from("kpi_configs").insert({
          client_id: client.id,
          month,
        });
      }

      // 6. Send invitations
      for (const invite of state.invites) {
        await fetch("/api/invitations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: invite.email,
            role: invite.role,
            client_id: client.id,
          }),
        });
      }

      // 7. Redirect to client dashboard
      router.push(`/${client.id}`);
    } finally {
      setCompleting(false);
    }
  }

  return (
    <WizardShell>
      {({ state, setState, next, back }) => {
        switch (state.step) {
          case 1:
            return (
              <StepBasicInfo state={state} setState={setState} next={next} />
            );
          case 2:
            return (
              <StepConnectSheet
                state={state}
                setState={setState}
                next={next}
                back={back}
              />
            );
          case 3:
            return (
              <StepVerifyMapping
                state={state}
                setState={setState}
                next={next}
                back={back}
              />
            );
          case 4:
            return (
              <StepSetKPI
                state={state}
                setState={setState}
                next={next}
                back={back}
              />
            );
          case 5:
            return (
              <StepInviteTeam
                state={state}
                setState={setState}
                back={back}
                onComplete={handleComplete}
                completing={completing}
              />
            );
          default:
            return null;
        }
      }}
    </WizardShell>
  );
}
