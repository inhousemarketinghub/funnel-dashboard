import { fmtRM } from "./utils";

// A plain-language explanation of how one Derived Value is calculated, ready to
// render in a hover tooltip on the Settings page. `formula` names the inputs,
// `substituted` plugs in the current real numbers, `result` is the final value.
export interface FormulaExplanation {
  title: string;
  formula: string;
  substituted: string;
  result: string;
}

type Fmt = "rm" | "pct" | "count" | "raw";
type Operand = [value: number, format: Fmt];

// Operands keep up to 2 decimals so the arithmetic visibly works — the sheet
// chains full precision, so an intermediate like Visit is really 95.24, not 95.
function fmtOperand(value: number, format: Fmt): string {
  switch (format) {
    case "rm":
      return fmtRM(value);
    case "pct":
      return `${value}%`;
    case "count":
      return Number.isInteger(value) ? String(value) : value.toFixed(2);
    case "raw":
    default:
      return String(value);
  }
}

// The result mirrors the headline (rounded integer for counts) but, when the
// precise value has a fraction, shows it too — e.g. "634.92 ≈ 635" — so the
// rounding that makes Settings match the Sheet is explicit, not mysterious.
function fmtResult(value: number, format: Fmt): string {
  if (format === "rm") return fmtRM(value);
  if (format === "pct") return `${value}%`;
  if (format === "count") {
    const rounded = Math.round(value);
    return Math.abs(value - rounded) < 0.005 ? String(rounded) : `${value.toFixed(2)} ≈ ${rounded}`;
  }
  return String(value);
}

function make(
  title: string,
  formula: string,
  left: Operand,
  operator: string,
  right: Operand,
  resultValue: number,
  resultFormat: Fmt,
): FormulaExplanation {
  return {
    title,
    formula,
    substituted: `${fmtOperand(left[0], left[1])} ${operator} ${fmtOperand(right[0], right[1])}`,
    result: fmtResult(resultValue, resultFormat),
  };
}

/**
 * Describe how a single Derived Value on the Settings page is computed.
 * Mirrors the formula chain in app/[clientId]/settings/page.tsx — keep the two
 * in sync. Returns null for keys that have no formula to show.
 */
export function describeDerived(
  key: string,
  form: Record<string, number>,
  funnelType: "appointment" | "walkin",
  derived: Record<string, number>,
): FormulaExplanation | null {
  const f = form;
  const d = derived;

  switch (key) {
    // ── Shared across both funnel types ──────────────────────
    case "orders":
      return make("Targeted Order", "Targeted Sales ÷ Targeted AOV",
        [f.sales, "rm"], "÷", [f.aov, "rm"], d.orders, "count");

    case "monthly_ad_incl":
      return make("Monthly Ad Spend (Incl SST)", "Targeted Sales × Targeted CPA",
        [f.sales, "rm"], "×", [f.cpa_pct, "pct"], d.monthly_ad_incl, "rm");

    case "monthly_ad_excl":
      return make("Monthly Ad Spend (Excl SST)", "Monthly Ad Spend (Incl SST) ÷ 1.08",
        [d.monthly_ad_incl, "rm"], "÷", [1.08, "raw"], d.monthly_ad_excl, "rm");

    case "daily_ad_targeted_incl":
      return make("Targeted Daily Ad Spend (Incl SST)", "Monthly Ad Spend (Incl SST) ÷ Days in Month",
        [d.monthly_ad_incl, "rm"], "÷", [d.days_in_month, "count"], d.daily_ad_targeted_incl, "rm");

    case "daily_ad_targeted_excl":
      return make("Targeted Daily Ad Spend (Excl SST)", "Monthly Ad Spend (Excl SST) ÷ Days in Month",
        [d.monthly_ad_excl, "rm"], "÷", [d.days_in_month, "count"], d.daily_ad_targeted_excl, "rm");

    case "cpl":
      return make("CPL (Incl SST)", "Monthly Ad Spend (Excl SST) ÷ FB Leads Inquiry",
        [d.monthly_ad_excl, "rm"], "÷", [d.fb_leads, "count"], d.cpl, "rm");

    case "cp_acquisition":
      return make("CP.Acquisition (Incl SST)", "Monthly Ad Spend (Excl SST) ÷ Targeted Order",
        [d.monthly_ad_excl, "rm"], "÷", [d.orders, "count"], d.cp_acquisition, "rm");

    case "fb_leads":
      return funnelType === "walkin"
        ? make("FB Leads Inquiry", "Visit ÷ Targeted Visit Rate",
            [d.target_visit, "count"], "÷", [f.respond_rate, "pct"], d.fb_leads, "count")
        : make("FB Leads Inquiry", "Contact Given ÷ Targeted Respond Rate",
            [d.target_contact, "count"], "÷", [f.respond_rate, "pct"], d.fb_leads, "count");

    // ── Walk-in only ─────────────────────────────────────────
    case "target_visit":
      return make("Visit", "Targeted Order ÷ Targeted Conversion Rate",
        [d.orders, "count"], "÷", [f.conv_rate, "pct"], d.target_visit, "count");

    case "cp_visit":
      return make("CP.Visit (Incl SST)", "Monthly Ad Spend (Excl SST) ÷ Visit",
        [d.monthly_ad_excl, "rm"], "÷", [d.target_visit, "count"], d.cp_visit, "rm");

    // ── Appointment only ─────────────────────────────────────
    case "target_showup":
      return make("Show Up", "Targeted Order ÷ Targeted Conversion Rate",
        [d.orders, "count"], "÷", [f.conv_rate, "pct"], d.target_showup, "count");

    case "cp_showup":
      return make("CP.Show Up (Incl SST)", "Monthly Ad Spend (Excl SST) ÷ Show Up",
        [d.monthly_ad_excl, "rm"], "÷", [d.target_showup, "count"], d.cp_showup, "rm");

    case "target_appt":
      return make("Appointment", "Show Up ÷ Targeted Show Up Rate",
        [d.target_showup, "count"], "÷", [f.showup_rate, "pct"], d.target_appt, "count");

    case "cp_appointment":
      return make("CP.Appointment (Incl SST)", "Monthly Ad Spend (Excl SST) ÷ Appointment",
        [d.monthly_ad_excl, "rm"], "÷", [d.target_appt, "count"], d.cp_appointment, "rm");

    case "target_contact":
      return make("Contact Given", "Appointment ÷ Targeted Appointment Rate",
        [d.target_appt, "count"], "÷", [f.appt_rate, "pct"], d.target_contact, "count");

    case "cp_contact":
      return make("CP.Contact Given (Incl SST)", "Monthly Ad Spend (Excl SST) ÷ Contact Given",
        [d.monthly_ad_excl, "rm"], "÷", [d.target_contact, "count"], d.cp_contact, "rm");

    default:
      return null;
  }
}
