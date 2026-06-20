/**
 * Create a few Con agents — contributor representatives, each with a wallet
 * and its own commission rate. Contributors are assigned one at submission.
 * Run: node --experimental-transform-types --no-warnings --env-file=.env.local scripts/con-fleet.mts
 */
import { createClient } from "@supabase/supabase-js";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const cons = [
  { label: "Atlas", fee_rate: 0.08 },
  { label: "Mercer", fee_rate: 0.12 },
  { label: "Vale", fee_rate: 0.15 },
];

async function main() {
  for (const c of cons) {
    const { data: existing } = await db.from("cons").select("id").eq("label", c.label).maybeSingle();
    if (existing) { console.log(`skip ${c.label} (exists)`); continue; }
    const pk = generatePrivateKey();
    const address = privateKeyToAccount(pk).address;
    const { error } = await db.from("cons").insert({
      label: c.label, fee_rate: c.fee_rate, wallet_address: address, wallet_private_key: pk,
    });
    if (error) throw error;
    console.log(`${c.label} (${(c.fee_rate * 100).toFixed(0)}% commission) -> ${address}`);
  }
  console.log("Cons ready.");
}
main().catch((e) => { console.error(e); process.exit(1); });
