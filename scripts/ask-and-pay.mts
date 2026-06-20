/**
 * Full flow: retrieve -> judge -> synthesize -> weight -> SETTLE on Arc.
 * Records a query row + payout rows with real tx hashes.
 * Run: node --experimental-transform-types --no-warnings --env-file=.env.local scripts/ask-and-pay.mts "question"
 */
import { createClient } from "@supabase/supabase-js";
import { embed, runLoop, type Candidate } from "../lib/agent-loop.ts";
import { settleSplit } from "../lib/pay.ts";

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

async function main() {
  const question = process.argv[2] ?? "My startup is failing and I feel like a failure. How do I get through this?";
  const budget = 0.1;

  console.log(`\nQUESTION: ${question}`);
  console.log(`BUDGET: ${budget} USDC\n`);

  // Record the query
  const { data: q, error: qErr } = await db
    .from("queries")
    .insert({ question, budget_usdc: budget })
    .select()
    .single();
  if (qErr) throw qErr;

  // Stage 1: retrieve
  const qEmbedding = await embed(question);
  const { data: candidates, error } = await db.rpc("match_experiences", {
    query_embedding: qEmbedding,
    match_count: 15,
  });
  if (error) throw error;

  // Stages 2-4
  const result = await runLoop(question, candidates as Candidate[], budget);

  console.log("--- AGENT REASONING ---");
  for (const line of result.trace) console.log(line);

  if (result.scored.length === 0) {
    console.log("\nNothing to pay.");
    return;
  }

  // Stage 5: SETTLE on Arc
  console.log("\n--- SETTLING ON ARC ---");
  const paid = await settleSplit(q.id, result.scored);

  // Update the query row with outcome
  await db
    .from("queries")
    .update({
      spent_usdc: result.spent,
      refunded_usdc: result.refunded,
      platform_fee_usdc: result.platform_fee,
      answer: result.answer,
    })
    .eq("id", q.id);

  console.log("\n--- RESULT ---");
  for (const p of paid) {
    console.log(
      `${p.paid ? "✓" : "✗"} ${p.title} — ${p.amount_usdc.toFixed(6)} USDC ${p.gateway_tx ? `(tx ${p.gateway_tx.slice(0, 12)}...)` : "(FAILED)"}`,
    );
  }
  console.log(`\nAnswer:\n${result.answer}`);
}

main().catch((err) => { console.error(err); process.exit(1); });