/**
 * Seed a tiny pool of experiences into Supabase, with real embeddings.
 * Run: node --experimental-transform-types --no-warnings --env-file=.env.local scripts/seed.mts
 */
import { createClient } from "@supabase/supabase-js";
import { embed } from "../lib/agent-loop.ts";

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const contributors = [
  { handle: "anon-rebuilt", wallet_address: "0x1111111111111111111111111111111111111111" },
  { handle: "anon-climbed", wallet_address: "0x2222222222222222222222222222222222222222" },
  { handle: "anon-burnedout", wallet_address: "0x3333333333333333333333333333333333333333" },
  { handle: "anon-pivoted", wallet_address: "0x4444444444444444444444444444444444444444" },
];

const experiences = [
  {
    who: "anon-rebuilt",
    title: "Closing my first startup without losing myself",
    quality: 0.9,
    body: "My startup ran out of money in month 18. I'd hired four people and had to let them all go in one afternoon. What got me through: I gave myself exactly two weeks to grieve it, told no one I was 'pivoting' when I wasn't, and took a boring contract job to rebuild savings. The shame was the hardest part, not the money. I wrote down every decision that led to the failure — not to punish myself but so I'd recognize the pattern next time. Eighteen months later I started again, smaller, and that one worked.",
  },
  {
    who: "anon-climbed",
    title: "From warehouse floor to engineering lead in six years",
    quality: 0.85,
    body: "I started packing boxes at 19 with no degree. I taught myself to code on night shifts using free resources, building tiny tools that automated parts of my own job. My manager noticed the tools, not my resume. The leap was internal — I moved to a junior dev role inside the same company because they already trusted me. Six years later I lead a team. The lesson: solve a visible problem where people already see you, instead of applying cold into places where you're a stranger.",
  },
  {
    who: "anon-burnedout",
    title: "Recovering from burnout that I ignored for a year",
    quality: 0.8,
    body: "I ignored burnout for a year and it ended with me unable to open my laptop without a panic response. Recovery wasn't a vacation. It was three months of deliberately under-working, therapy, and renegotiating what I owed people. I had to accept my output would drop and let some opportunities pass. The thing nobody tells you: the recovery itself feels like failure while you're in it. It wasn't. I work sustainably now and produce more than I did while burning out.",
  },
  {
    who: "anon-pivoted",
    title: "The sourdough starter that finally worked",
    quality: 0.7,
    body: "After dozens of dense bricks, my sourdough finally rose. The fix was temperature: my kitchen was too cold, so the starter was sluggish. I started keeping it in the oven with just the light on. Patience and warmth, that was the whole secret.",
  },
];

async function main() {
  const { data: cs, error: cErr } = await db
    .from("contributors")
    .upsert(contributors, { onConflict: "handle" })
    .select();
  if (cErr) throw cErr;
  const byHandle = Object.fromEntries(cs!.map((c) => [c.handle, c.id]));
  console.log(`Contributors: ${cs!.length}`);

  for (const e of experiences) {
    const embedding = await embed(`${e.title}\n${e.body}`);
    const { error } = await db.from("experiences").insert({
      contributor_id: byHandle[e.who],
      title: e.title,
      body: e.body,
      quality_score: e.quality,
      status: "approved",
      embedding,
    });
    if (error) throw error;
    console.log(`  embedded + stored: ${e.title}`);
  }
  console.log("Seed complete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});