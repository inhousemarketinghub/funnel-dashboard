// ── Client Profile（项目档案）───────────────────────────────────
//
// Per-client structured config stored in clients.profile (JSONB). This is the
// single place client-specific rules will live — replacing header inference
// and hardcoded special cases as Phase 2 wires consumers in.
// The parser is tolerant: garbage in → defaults out, unknown keys dropped —
// a hand-edited bad value must never crash a dashboard render.

/** Metrics whose sheet column may carry a client-specific header name. */
export const ALIAS_METRICS = [
  "inquiry", "contact", "appointment", "estShowup", "showup", "orders", "sales",
] as const;
export type AliasMetric = (typeof ALIAS_METRICS)[number];

export interface ClientProfile {
  /** Explicit funnel type; absent = infer from headers (current behavior). */
  funnel_type?: "appointment" | "walkin";
  /** Source values counted as Paid Ads (e.g. Facebook, Instagram, WhatsApp). */
  paid_sources?: string[];
  /** Extra header keywords per metric (e.g. orders → "signed up"). */
  column_aliases?: Partial<Record<AliasMetric, string[]>>;
  /** Which pipeline the dashboard reads. Default "sheets"; flipped per client
   *  during the Phase 3 gradual rollout. */
  data_source?: "sheets" | "db";
}

export function parseProfile(raw: unknown): ClientProfile {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return {};
  const o = raw as Record<string, unknown>;
  const out: ClientProfile = {};

  if (o.funnel_type === "appointment" || o.funnel_type === "walkin") {
    out.funnel_type = o.funnel_type;
  }
  if (Array.isArray(o.paid_sources)) {
    const list = o.paid_sources.filter((s): s is string => typeof s === "string" && s.trim() !== "").map((s) => s.trim());
    if (list.length > 0) out.paid_sources = list;
  }
  if (typeof o.column_aliases === "object" && o.column_aliases !== null && !Array.isArray(o.column_aliases)) {
    const aliases: Partial<Record<AliasMetric, string[]>> = {};
    for (const m of ALIAS_METRICS) {
      const v = (o.column_aliases as Record<string, unknown>)[m];
      if (Array.isArray(v)) {
        const list = v.filter((s): s is string => typeof s === "string" && s.trim() !== "").map((s) => s.trim().toLowerCase());
        if (list.length > 0) aliases[m] = list;
      }
    }
    if (Object.keys(aliases).length > 0) out.column_aliases = aliases;
  }
  if (o.data_source === "sheets" || o.data_source === "db") {
    out.data_source = o.data_source;
  }
  return out;
}

export function dataSourceOf(profile: ClientProfile): "sheets" | "db" {
  return profile.data_source ?? "sheets";
}
