/**
 * Create the three specialist agents, each with a real Arc wallet.
 * Run: node --experimental-transform-types --no-warnings --env-file=.env.local scripts/specialist-fleet.mts
 */
import { createClient } from "@supabase/supabase-js";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const specialists = [
  { domain: "career", label: "Career & Work" },
  { domain: "relationships", label: "Relationships & Family" },
  { domain: "general", label: "General Life" },
];

async function main() {
  for (const s of specialists) {
    const { data: existing } = await db
      .from("specialists").select("id").eq("domain", s.domain).maybeSingle();
    if (existing) { console.log(`skip ${s.domain} (exists)`); continue; }

    const pk = generatePrivateKey();
    const address = privateKeyToAccount(pk).address;
    const { error } = await db.from("specialists").insert({
      domain: s.domain, label: s.label,
      wallet_address: address, wallet_private_key: pk,
    });
    if (error) throw error;
    console.log(`${s.domain} (${s.label}) -> ${address}`);
  }
  console.log("Specialists ready.");
}

main().catch((e) => { console.error(e); process.exit(1); });
