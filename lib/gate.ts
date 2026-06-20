/**
 * Gate agent. Judges whether a submission is genuine lived experience
 * (not generic advice, spam, or AI slop), scores its quality, and assigns a domain.
 * This is the agent that protects the pool — another agent doing real work.
 */
import OpenAI from "openai";

const openai = new OpenAI({
  baseURL: process.env.LLM_BASE_URL ?? "http://127.0.0.1:11434/v1",
  apiKey: process.env.LLM_API_KEY ?? "ollama",
});
const CHAT_MODEL = process.env.CHAT_MODEL ?? "qwen2.5:3b";

export interface GateVerdict {
  accepted: boolean;
  quality: number;       // 0..1
  domain: string;        // career | relationships | general
  reason: string;        // human-readable explanation
  suggestedTitle: string;
}

export async function gateSubmission(title: string, body: string): Promise<GateVerdict> {
  const prompt = `You are the gatekeeper for a marketplace of real lived experiences. People share hard-won, first-person experience so others facing the same thing can learn. Contributors are paid when their experience helps someone.

Judge this submission. ACCEPT only if it is genuine, specific, FIRST-PERSON lived experience — something the person actually went through. REJECT generic advice, vague platitudes, second-hand stories, sales pitches, or AI-generated-sounding filler.

Submission title: "${title}"
Submission body: "${body}"

Score:
- quality 0.0-1.0 (specificity, honesty, usefulness of the lived detail)
- domain: career (work/business/burnout), relationships (love/family/conflict/loss), or general (everything else)
- A short reason for your verdict (one sentence, addressed to the contributor)
- A clear suggested title (<8 words) if theirs is weak; otherwise echo theirs

Accept if quality >= 0.5 AND it is truly first-person lived experience.

Return ONLY JSON: {"accepted": true/false, "quality": 0.0-1.0, "domain": "career|relationships|general", "reason": "...", "suggestedTitle": "..."}.`;

  try {
    const r = await openai.chat.completions.create({
      model: CHAT_MODEL,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
    });
    const p = JSON.parse(r.choices[0].message.content ?? "{}");
    const domain = ["career", "relationships", "general"].includes(p.domain) ? p.domain : "general";
    return {
      accepted: Boolean(p.accepted),
      quality: Math.min(1, Math.max(0, Number(p.quality ?? 0))),
      domain,
      reason: String(p.reason ?? "Could not assess this submission."),
      suggestedTitle: String(p.suggestedTitle ?? title).slice(0, 80),
    };
  } catch (err) {
    return { accepted: false, quality: 0, domain: "general", reason: "The gate agent could not process this submission. Please try again.", suggestedTitle: title };
  }
}
