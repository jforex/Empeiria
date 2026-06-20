/**
 * Specialist judging — domain-aware, one experience at a time so each
 * verdict can stream live. Each call judges a single experience.
 */
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";
import { embed, type Candidate, type Judged } from "./agent-loop";

const openai = new OpenAI({
  baseURL: process.env.LLM_BASE_URL ?? "http://127.0.0.1:11434/v1",
  apiKey: process.env.LLM_API_KEY ?? "ollama",
});
const CHAT_MODEL = process.env.CHAT_MODEL ?? "qwen2.5:3b";

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const DOMAIN_LENS: Record<string, string> = {
  career:
    "You are a specialist in careers, work, business, burnout, and professional setbacks. You know what genuine, hard-won work experience sounds like versus generic advice.",
  relationships:
    "You are a specialist in relationships, family, love, conflict, and loss. You know what authentic relational experience sounds like versus platitudes.",
  general:
    "You are a generalist in everyday life experience.",
};

/** Retrieve the specialist's domain slice (no judging yet). */
export async function specialistRetrieve(domain: string, question: string): Promise<Candidate[]> {
  const qEmbedding = await embed(question);
  const { data, error } = await db.rpc("match_experiences", {
    query_embedding: qEmbedding,
    match_count: 15,
    filter_domain: domain === "general" ? null : domain,
  });
  if (error) throw error;
  return (data ?? []) as Candidate[];
}

/** Judge ONE experience through the domain lens. */
export async function judgeOne(domain: string, question: string, c: Candidate): Promise<Judged> {
  const lens = DOMAIN_LENS[domain] ?? DOMAIN_LENS.general;
  const prompt = `${lens}

A person asked: "${question}"

Judge how genuinely relevant THIS lived experience is to their situation (0.0-1.0):

"${c.title}"
${c.body.slice(0, 700)}

Return ONLY JSON: {"relevance": 0.0-1.0, "reason": "<10 words"}.`;

  try {
    const r = await openai.chat.completions.create({
      model: CHAT_MODEL,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
    });
    const parsed = JSON.parse(r.choices[0].message.content ?? "{}");
    return {
      ...c,
      relevance: Number(parsed.relevance ?? 0),
      judge_reason: String(parsed.reason ?? ""),
    };
  } catch {
    return { ...c, relevance: 0, judge_reason: "could not judge" };
  }
}
