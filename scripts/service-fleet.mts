/**
 * Create the shared service agents: Transcription Agent + Platform Fees Agent.
 * Run: node --experimental-transform-types --no-warnings --env-file=.env.local scripts/service-fleet.mts
 */
import { createClient } from "@supabase/supabase-js";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const agents = [
  { kind: "transcription", label: "Transcription Agent", base_rate: 0.01 },
  { kind: "fees", label: "Platform Fees Agent", base_rate: 0 },
];

async function main() {
  for (const a of agents) {
    const { data: existing } = await db.from("service_agents").select("id").eq("kind", a.kind).maybeSingle();
    if (existing) { console.log(`skip ${a.kind} (exists)`); continue; }
    const pk = generatePrivateKey();
    const address = privateKeyToAccount(pk).address;
    const { error } = await db.from("service_agents").insert({
      kind: a.kind, label: a.label, base_rate: a.base_rate, wallet_address: address, wallet_private_key: pk,
    });
    if (error) throw error;
    console.log(`${a.label} (${a.kind}) -> ${address}`);
  }
  console.log("Service agents ready.");
}
main().catch((e) => { console.error(e); process.exit(1); });
