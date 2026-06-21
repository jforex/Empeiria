/**
 * Transcription Agent pricing — autonomous, from real signals:
 *   duration   : seconds of audio (core cost driver — Whisper bills per second)
 *   congestion : recent job load (busy agent charges more — supply/demand)
 *   reputation : track record (proven agent commands a premium)
 *   clarity    : applied AFTER transcription as a surcharge if the audio was hard
 *
 * The Fees Agent judges FAIRNESS: it computes what the job should reasonably
 * cost for this duration, and declines only if the quote is overcharging —
 * not merely because a long job costs a lot.
 */

export interface TranscriptionQuote {
  price: number;
  durationSec: number;
  durationFactor: number;
  congestionFactor: number;
  reputation: number;
  breakdown: string;
}

export interface FeesDecision {
  accept: boolean;
  fairValue: number;
  reason: string;
}

const BASE_PER_MINUTE = 0.006;   // base rate per minute of audio
const FLOOR = 0.004;             // minimum fee (10s-minimum billing reality)

/** The Transcription Agent quotes a price for a job. */
export function transcriptionQuote(
  agent: { base_rate: number; jobs_done: number },
  durationSec: number,
  recentJobs: number,
): TranscriptionQuote {
  const minutes = Math.max(0.17, durationSec / 60); // ~10s minimum
  const durationFactor = minutes; // linear in length — the honest core driver

  // congestion: more recent jobs => higher price (supply/demand). 0 jobs = 1.0, scales up.
  const congestionFactor = Math.min(1.8, 1 + recentJobs * 0.12);

  // reputation: proven agent (more jobs done) earns a modest premium, capped.
  const reputation = Math.min(1, agent.jobs_done / 20); // matures over 20 jobs
  const repMultiplier = 0.95 + reputation * 0.25;

  const raw = BASE_PER_MINUTE * durationFactor * congestionFactor * repMultiplier;
  const price = Number(Math.max(FLOOR, raw).toFixed(6));

  const breakdown =
    `${durationSec.toFixed(0)}s audio · congestion ×${congestionFactor.toFixed(2)} · ` +
    `reputation ${(reputation * 100).toFixed(0)}% (${agent.jobs_done} jobs)`;

  return { price, durationSec, durationFactor, congestionFactor, reputation, breakdown };
}

/**
 * The Fees Agent judges fairness. It independently estimates what the job
 * SHOULD cost for this duration (it can measure duration itself), allows a
 * reasonable band above that (accounting for congestion + the agent's standing),
 * and declines only genuine overcharging.
 */
export function feesAgentDecides(quote: TranscriptionQuote): FeesDecision {
  const minutes = Math.max(0.17, quote.durationSec / 60);
  // fair value = what a baseline agent at normal load would charge for this length
  const fairValue = Number(Math.max(FLOOR, BASE_PER_MINUTE * minutes).toFixed(6));

  // allow up to ~2x fair value (congestion + reputation can justify a premium).
  // a higher-reputation agent earns a wider acceptable band.
  const tolerance = 2.0 + quote.reputation * 0.5;
  const ceiling = Number((fairValue * tolerance).toFixed(6));

  if (quote.price <= ceiling) {
    return { accept: true, fairValue, reason: `quote ${quote.price.toFixed(6)} is fair for ${quote.durationSec.toFixed(0)}s of audio (fair value ~${fairValue.toFixed(6)})` };
  }
  return { accept: false, fairValue, reason: `quote ${quote.price.toFixed(6)} overcharges for ${quote.durationSec.toFixed(0)}s (fair value ~${fairValue.toFixed(6)}) — declined` };
}

/** Clarity surcharge, applied AFTER transcription based on how hard the audio was. */
export function claritySurcharge(transcript: string, durationSec: number): number {
  // heuristic for "hard audio": very low words-per-second suggests noise/unclear speech
  const words = transcript.trim().split(/\s+/).filter(Boolean).length;
  const wps = words / Math.max(1, durationSec);
  // normal speech ~2-3 wps. Below 1.0 suggests the agent worked harder (noise, pauses, accent).
  if (wps < 1.0 && durationSec > 5) return 0.002; // small honest surcharge
  return 0;
}
