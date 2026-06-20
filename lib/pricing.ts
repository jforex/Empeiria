/**
 * Specialist pricing — grounded in real signals:
 *   effort    : how many experiences the specialist must evaluate (more work = higher price)
 *   scarcity  : inverse to how much relevant material exists (rare expertise = higher price)
 *   reputation: the specialist's track record (good record justifies its price to the router)
 *
 * The specialist QUOTES a price. The router decides whether it's worth it,
 * comparing the quote to a reputation-derived value threshold.
 */
import { createClient } from "@supabase/supabase-js";

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export interface Quote {
  price: number;          // USDC the specialist asks
  effortFactor: number;   // >1 means more candidates than baseline
  scarcityFactor: number; // >1 means relevant material is scarce
  reputation: number;     // 0..1, specialist's track record
  candidates: number;     // how many experiences exist in this domain
  breakdown: string;      // human-readable line for the trace
}

export interface Decision {
  accept: boolean;
  threshold: number;
  reason: string;
}

const BASELINE_CANDIDATES = 8; // "normal" amount of material to read

/**
 * Specialist computes its quote for a domain.
 * `domainCount` = how many approved experiences exist in this domain (its supply).
 */
export async function quoteFor(specialist: {
  base_rate: number; jobs_done: number; avg_relevance: number;
}, domainCount: number): Promise<Quote> {
  const candidates = Math.max(1, domainCount);

  // Effort: more material to read than baseline costs more (capped).
  const effortFactor = Math.min(2.0, Math.max(0.6, candidates / BASELINE_CANDIDATES));

  // Scarcity: fewer relevant experiences = rarer expertise = pricier (inverse).
  // Abundant supply (many experiences) pushes price down.
  const scarcityFactor = Math.min(2.5, Math.max(0.7, BASELINE_CANDIDATES / candidates));

  const reputation = Math.min(1, Math.max(0, specialist.avg_relevance ?? 0.7));

  // Reputation lets a proven specialist charge a modest premium (up to +25%).
  const repMultiplier = 0.9 + reputation * 0.35;

  const price = Number(
    (specialist.base_rate * effortFactor * scarcityFactor * repMultiplier).toFixed(6),
  );

  const breakdown =
    `effort ×${effortFactor.toFixed(2)} · scarcity ×${scarcityFactor.toFixed(2)} · ` +
    `reputation ${(reputation * 100).toFixed(0)}% (${specialist.jobs_done} jobs)`;

  return { price, effortFactor, scarcityFactor, reputation, candidates, breakdown };
}

/**
 * Router decides whether the quote is worth paying.
 * Value threshold scales with the budget AND the specialist's reputation:
 * a trusted specialist is worth more of the budget.
 */
export function routerDecides(quote: Quote, budget: number): Decision {
  // Base willingness: up to 20% of budget for an average specialist,
  // stretching toward 30% for a highly-reputed one.
  const threshold = Number((budget * (0.20 + quote.reputation * 0.10)).toFixed(6));

  if (quote.price <= threshold) {
    return {
      accept: true, threshold,
      reason: `quote ${quote.price.toFixed(6)} ≤ worth ${threshold.toFixed(6)} — expertise is worth it`,
    };
  }
  return {
    accept: false, threshold,
    reason: `quote ${quote.price.toFixed(6)} > worth ${threshold.toFixed(6)} — too expensive for its track record; router will judge itself`,
  };
}

/** How many approved experiences exist in a domain (the specialist's supply). */
export async function domainSupply(domain: string): Promise<number> {
  const q = db.from("experiences").select("id", { count: "exact", head: true }).eq("status", "approved");
  const { count } = domain === "general" ? await q : await q.eq("domain", domain);
  return count ?? 0;
}
