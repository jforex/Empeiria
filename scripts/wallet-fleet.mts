/**
 * Give every contributor a real Arc keypair (developer-controlled fleet).
 * Stores address + private key. Platform custodies keys (testnet).
 * Run: node --experimental-transform-types --no-warnings --env-file=.env.local scripts/wallet-fleet.mts
 */
import { createClient } from "@supabase/supabase-js";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

async function main() {
  const { data: contributors, error } = await db
    .from("contributors")
    .select("id, handle, wallet_address");
  if (error) throw error;

  for (const c of contributors!) {
    // Only replace fake placeholder wallets.
    if (!/^0x(1111|2222|3333|4444)/.test(c.wallet_address)) {
      console.log(`skip ${c.handle} (already real: ${c.wallet_address})`);
      continue;
    }
    const pk = generatePrivateKey();
    const address = privateKeyToAccount(pk).address;
    const { error: uErr } = await db
      .from("contributors")
      .update({ wallet_address: address, wallet_private_key: pk })
      .eq("id", c.id);
    if (uErr) throw uErr;
    console.log(`${c.handle} -> ${address}`);
  }
  console.log("Fleet ready.");
}

main().catch((e) => { console.error(e); process.exit(1); });
