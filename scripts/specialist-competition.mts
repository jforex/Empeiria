/**
 * Add competing specialists to existing domains so the router has providers
 * to choose between. Each gets its own wallet and a different base_rate,
 * creating real price competition. Reputation accrues from jobs over time.
 * Run: node --experimental-transform-types --no-warnings --env-file=.env.local scripts/specialist-competition.mts
 */
import { createClient } from "@supabase/supabase-js";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

// extra competitors per domain. label is distinct; base_rate varies for real price competition.
const competitors = [
  { domain: "career", label: "Career Desk · Vega", base_rate: 0.011 },
  { domain: "career", label: "Career Desk · Orion", base_rate: 0.018 },
  { domain: "relationships", label: "Relations Desk · Lyra", base_rate: 0.012 },
  { domain: "general", label: "General Desk · Nova", base_rate: 0.013 },
];

async function main() {
  for (const c of competitors) {
    const { data: existing } = await db.from("specialists").select("id").eq("label", c.label).maybeSingle();
    if (existing) { console.log(`skip ${c.label} (exists)`); continue; }
    const pk = generatePrivateKey();
    const address = privateKeyToAccount(pk).address;
    const { error } = await db.from("specialists").insert({
      domain: c.domain, label: c.label, base_rate: c.base_rate,
      wallet_address: address, wallet_private_key: pk,
    });
    if (error) throw error;
    console.log(`${c.label} (${c.domain}, base ${c.base_rate}) -> ${address}`);
  }
  console.log("Competing specialists ready.");
}
main().catch((e) => { console.error(e); process.exit(1); });
