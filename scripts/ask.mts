/**
 * Fire one question through the loop. Payment stubbed — prints the decisions.
 * Run: node --experimental-transform-types --no-warnings --env-file=.env.local scripts/ask.mts "your question"
 */
import { createClient } from "@supabase/supabase-js";
import { embed, runLoop, type Candidate } from "../lib/agent-loop.ts";

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

async function main() {
  const question = process.argv[2] ?? "My startup is failing and I feel like a failure. How do I get through this?";
  const budget = 0.1; // searcher's cap, in USDC

  console.log(`\nQUESTION: ${question}`);
  console.log(`BUDGET: ${budget} USDC\n`);

  // Stage 1: retrieve
  const qEmbedding = await embed(question);
  const { data: candidates, error } = await db.rpc("match_experiences", {
    query_embedding: qEmbedding,
    match_count: 15,
  });
  if (error) throw error;

  // Run stages 2-4
  const result = await runLoop(question, candidates as Candidate[], budget);

  console.log("--- AGENT REASONING ---");
  for (const line of result.trace) console.log(line);

  console.log("\n--- ANSWER ---");
  console.log(result.answer);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});