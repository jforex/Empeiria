/**
 * Re-embed all experiences with the current embed() model (Gemini).
 * Run: node --experimental-transform-types --no-warnings --env-file=.env.local scripts/reembed.mts
 */
import { createClient } from "@supabase/supabase-js";
import { embed } from "../lib/agent-loop.ts";

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
  const { data: exps, error } = await db.from("experiences").select("id, title, body");
  if (error) throw error;
  for (const e of exps!) {
    const v = await embed(`${e.title}\n${e.body}`);
    const { error: uErr } = await db.from("experiences").update({ embedding: v }).eq("id", e.id);
    if (uErr) throw uErr;
    console.log(`re-embedded: ${e.title}`);
  }
  console.log("Done.");
}
main().catch((e) => { console.error(e); process.exit(1); });
