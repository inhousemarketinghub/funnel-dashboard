// Forward KPI calculator for the Settings page "Derived Values".
//
// Mirrors the Google Sheet "KPI Indicator" stimulator EXACTLY: every step is
// chained at full precision and is NEVER rounded mid-calculation. Rounding is a
// display-only concern (see formatDerived in the Settings page). This is what
// keeps Settings, the Sheet, and the Dashboard showing the same numbers.

export interface SettingsDerived {
  // Indexable by key so the Settings UI can look values up dynamically (m.key)
  // and pass the whole object where a Record<string, number> is expected.
  [key: string]: number;
  orders: number;
  cpl: number;
  cp_acquisition: number;
  fb_leads: number;
  target_visit: number;
  cp_visit: number;
  target_showup: number;
  cp_showup: number;
  target_appt: number;
  cp_appointment: number;
  target_contact: number;
  cp_contact: number;
  monthly_ad_incl: number;
  monthly_ad_excl: number;
  daily_ad_targeted_incl: number;
  daily_ad_targeted_excl: number;
  daily_ad_actual_incl: number;
  daily_ad_current_excl: number;
  days_in_month: number;
}

export function computeSettingsDerived(
  form: Record<string, number>,
  funnelType: "appointment" | "walkin",
  daysInMonth: number,
): SettingsDerived {
  const sales = form.sales || 0;
  const aov = form.aov || 0;
  const cpaPct = (form.cpa_pct || 0) / 100;
  const convRate = (form.conv_rate || 0) / 100;
  const dailyExcl = form.daily_ad || 0;

  // Order = Sales / AOV  (sheet: I4 = E4/G4) — full precision
  const orders = aov > 0 ? sales / aov : 0;

  // Monthly Ad Spend Incl = Sales × CPA%  (sheet: E10 = E4*E5); Excl = ÷ 1.08
  const monthlyAdIncl = sales * cpaPct;
  const monthlyAdExcl = monthlyAdIncl / 1.08;

  // Targeted Daily Ad Spend — divided by the real days in month (choice B,
  // intentionally diverging from the sheet's hard-coded /30).
  const dailyAdTargetedIncl = daysInMonth > 0 ? monthlyAdIncl / daysInMonth : 0;
  const dailyAdTargetedExcl = daysInMonth > 0 ? monthlyAdExcl / daysInMonth : 0;

  // Actual Daily Ad Spend (Incl) from the editable current daily budget
  const dailyAdIncl = dailyExcl * 1.08;

  // Funnel pipeline: work backwards from orders, full precision throughout.
  let pipelineEnd = 0; // Visit (walk-in) or Show Up (appointment)
  let fbLeads = 0;
  let apptCount = 0;
  let contactCount = 0;

  if (funnelType === "walkin") {
    const visitRate = (form.respond_rate || 0) / 100;
    pipelineEnd = convRate > 0 ? orders / convRate : 0; // Visit = Order / ConvRate
    fbLeads = visitRate > 0 ? pipelineEnd / visitRate : 0; // FB Leads = Visit / VisitRate
  } else {
    const showupRate = (form.showup_rate || 0) / 100;
    const apptRate = (form.appt_rate || 0) / 100;
    const respondRate = (form.respond_rate || 0) / 100;
    const showups = convRate > 0 ? orders / convRate : 0;
    const appts = showupRate > 0 ? showups / showupRate : 0;
    const contacts = apptRate > 0 ? appts / apptRate : 0;
    fbLeads = respondRate > 0 ? contacts / respondRate : 0;
    pipelineEnd = showups;
    apptCount = appts;
    contactCount = contacts;
  }

  // Cost-per-X = Actual Ad Spend (Excl SST) / count at that funnel stage.
  const cpl = fbLeads > 0 ? monthlyAdExcl / fbLeads : 0;
  const cpAcquisition = orders > 0 ? monthlyAdExcl / orders : 0;
  const cpVisit = pipelineEnd > 0 ? monthlyAdExcl / pipelineEnd : 0;
  const cpShowup = pipelineEnd > 0 ? monthlyAdExcl / pipelineEnd : 0;
  const cpAppointment = apptCount > 0 ? monthlyAdExcl / apptCount : 0;
  const cpContact = contactCount > 0 ? monthlyAdExcl / contactCount : 0;

  return {
    orders,
    cpl,
    cp_acquisition: cpAcquisition,
    fb_leads: fbLeads,
    target_visit: funnelType === "walkin" ? pipelineEnd : 0,
    cp_visit: cpVisit,
    target_showup: funnelType === "appointment" ? pipelineEnd : 0,
    cp_showup: cpShowup,
    target_appt: apptCount,
    cp_appointment: cpAppointment,
    target_contact: contactCount,
    cp_contact: cpContact,
    monthly_ad_incl: monthlyAdIncl,
    monthly_ad_excl: monthlyAdExcl,
    daily_ad_targeted_incl: dailyAdTargetedIncl,
    daily_ad_targeted_excl: dailyAdTargetedExcl,
    daily_ad_actual_incl: dailyAdIncl,
    daily_ad_current_excl: dailyExcl,
    days_in_month: daysInMonth,
  };
}

// ── Inverse calculators (solve the funnel equation for a different unknown) ──
//
// Each calculator mode exposes a different field as the "unknown" and takes CPL
// as a given instead. completeInputs() solves that unknown and returns a COMPLETE
// base-input form, so computeSettingsDerived() can run on it unchanged. This keeps
// one source of truth for the forward math and guarantees round-trip consistency.

export type CalculatorMode = "cpl" | "visit_rate" | "cpa" | "appt_rate";

// Walk-in: solve Visit Rate (%) from a target CPL.
// FB Leads = AdSpendExcl / CPL, and FB Leads = Visit / VisitRate, so
// VisitRate = Visit / FB Leads.
function solveWalkinVisitRate(form: Record<string, number>): number {
  const sales = form.sales || 0;
  const aov = form.aov || 0;
  const cpaPct = (form.cpa_pct || 0) / 100;
  const convRate = (form.conv_rate || 0) / 100;
  const cpl = form.cpl || 0;
  if (cpl <= 0 || aov <= 0 || convRate <= 0) return 0;

  const monthlyAdExcl = (sales * cpaPct) / 1.08;
  const fbLeads = monthlyAdExcl / cpl;
  if (fbLeads <= 0) return 0;
  const visit = sales / aov / convRate;
  return (visit / fbLeads) * 100;
}

// Walk-in: solve CPA (%) from a target CPL.
// AdSpendExcl = CPL × FB Leads, AdSpendIncl = AdSpendExcl × 1.08, CPA = AdSpendIncl / Sales.
function solveWalkinCPA(form: Record<string, number>): number {
  const sales = form.sales || 0;
  const aov = form.aov || 0;
  const convRate = (form.conv_rate || 0) / 100;
  const visitRate = (form.respond_rate || 0) / 100;
  const cpl = form.cpl || 0;
  if (sales <= 0 || aov <= 0 || convRate <= 0 || visitRate <= 0) return 0;

  const fbLeads = sales / aov / convRate / visitRate;
  const monthlyAdIncl = cpl * fbLeads * 1.08;
  return (monthlyAdIncl / sales) * 100;
}

// Appointment: solve Appointment Rate (%) from a target CPL.
// Contacts = FB Leads × RespondRate; Appointments = Order / ConvRate / ShowUpRate;
// ApptRate = Appointments / Contacts.
function solveApptRate(form: Record<string, number>): number {
  const sales = form.sales || 0;
  const aov = form.aov || 0;
  const cpaPct = (form.cpa_pct || 0) / 100;
  const convRate = (form.conv_rate || 0) / 100;
  const showupRate = (form.showup_rate || 0) / 100;
  const respondRate = (form.respond_rate || 0) / 100;
  const cpl = form.cpl || 0;
  if (cpl <= 0 || aov <= 0 || convRate <= 0 || showupRate <= 0) return 0;

  const monthlyAdExcl = (sales * cpaPct) / 1.08;
  const fbLeads = monthlyAdExcl / cpl;
  const contacts = fbLeads * respondRate;
  if (contacts <= 0) return 0;
  const appts = sales / aov / convRate / showupRate;
  return (appts / contacts) * 100;
}

// Appointment: solve CPA (%) from a target CPL.
function solveApptCPA(form: Record<string, number>): number {
  const sales = form.sales || 0;
  const aov = form.aov || 0;
  const convRate = (form.conv_rate || 0) / 100;
  const showupRate = (form.showup_rate || 0) / 100;
  const apptRate = (form.appt_rate || 0) / 100;
  const respondRate = (form.respond_rate || 0) / 100;
  const cpl = form.cpl || 0;
  if (sales <= 0 || aov <= 0 || convRate <= 0 || showupRate <= 0 || apptRate <= 0 || respondRate <= 0) {
    return 0;
  }

  const fbLeads = sales / aov / convRate / showupRate / apptRate / respondRate;
  const monthlyAdIncl = cpl * fbLeads * 1.08;
  return (monthlyAdIncl / sales) * 100;
}

// Given the active calculator mode, fill in the solved unknown and return a
// complete base-input form { sales, aov, cpa_pct, conv_rate, rates... }.
export function completeInputs(
  mode: CalculatorMode,
  funnelType: "appointment" | "walkin",
  form: Record<string, number>,
): Record<string, number> {
  if (mode === "cpl") return { ...form };

  if (funnelType === "walkin") {
    if (mode === "visit_rate") return { ...form, respond_rate: solveWalkinVisitRate(form) };
    if (mode === "cpa") return { ...form, cpa_pct: solveWalkinCPA(form) };
  } else {
    if (mode === "appt_rate") return { ...form, appt_rate: solveApptRate(form) };
    if (mode === "cpa") return { ...form, cpa_pct: solveApptCPA(form) };
  }

  return { ...form };
}
