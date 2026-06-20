import { BatchFacilitatorClient } from "@circle-fin/x402-batching/server";

const f = new BatchFacilitatorClient();
const r = await (f as any).getSupported?.() ?? await fetch("https://gateway-api-testnet.circle.com/v1/x402/supported").then(x => x.json());
console.log(JSON.stringify(r, (_k, v) => typeof v === "bigint" ? v.toString() : v, 2));
