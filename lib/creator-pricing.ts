/**
 * Tiered pricing for creator-knowledge answers + @handle parsing.
 * The user picks a tier; that total is split across contributing creators
 * by contribution weight, minus a platform fee.
 */

export type Tier = "simple" | "detailed" | "analysis";

export const TIERS: Record<Tier, { price: number; label: string; words: number; desc: string }> = {
  simple:   { price: 0.01, label: "Simple",   words: 120, desc: "A quick, direct answer" },
  detailed: { price: 0.03, label: "Detailed", words: 280, desc: "A thorough, practical answer" },
  analysis: { price: 0.05, label: "Analysis", words: 500, desc: "Deep strategic analysis" },
};

export const PLATFORM_FEE_RATE = 0.1; // 10% to the platform

export function tierFor(t: string | null | undefined): Tier {
  return (t === "detailed" || t === "analysis") ? t : "simple";
}

/** Parse a leading @handle for direct mode. Returns the handle (no @) + the cleaned question. */
export function parseHandle(question: string): { handle: string | null; cleaned: string } {
 const m = question.trim().match(/^@([a-zA-Z0-9_-]+)\s+([\s\S]+)$/);
  if (m) return { handle: m[1].toLowerCase(), cleaned: m[2].trim() };
  return { handle: null, cleaned: question.trim() };
}
