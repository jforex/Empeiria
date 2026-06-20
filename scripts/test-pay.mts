import { GatewayClient } from "@circle-fin/x402-batching/client";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const g = new GatewayClient({
  chain: "arcTestnet",
  privateKey: process.env.BUYER_PRIVATE_KEY as `0x${string}`,
});

async function main() {
  const payTo = "0x15CA63910fbDF4f751C7C122ecF71d0b465a99Cb";
  const url = `${BASE_URL}/api/pay-contributor?payTo=${payTo}&amount=0.01`;
  try {
    const res = await g.pay(url, { method: "GET" });
    console.log("SUCCESS:", JSON.stringify(res, (_k, v) => typeof v === "bigint" ? v.toString() : v, 2));
  } catch (err) {
    console.log("FAILED:", (err as Error).message);
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
