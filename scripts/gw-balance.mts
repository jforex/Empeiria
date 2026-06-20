import { GatewayClient } from "@circle-fin/x402-batching/client";

const g = new GatewayClient({
  chain: "arcTestnet",
  privateKey: process.env.BUYER_PRIVATE_KEY as `0x${string}`,
});

async function main() {
  const balances = await g.getBalances();
  console.log(
    JSON.stringify(
      balances,
      (_k, v) => (typeof v === "bigint" ? v.toString() : v),
      2,
    ),
  );
}

main().catch((e) => { console.error(e); process.exit(1); });
