/**
 * Transcription Agent — a paid external service that PRICES ITSELF (RFB 01 + 03).
 * The agent quotes from duration + congestion + reputation. The caller (Fees Agent)
 * pays the quoted amount via x402; on the paid retry the agent runs real Whisper.
 * The 'amount' passed must match the agent's quote (the Fees Agent already agreed).
 */
import { BatchFacilitatorClient } from "@circle-fin/x402-batching/server";
import { NextRequest, NextResponse } from "next/server";
import { transcribeFromUrl } from "@/lib/transcribe";

const ARC_TESTNET_NETWORK = "eip155:5042002";
const ARC_TESTNET_USDC = "0x3600000000000000000000000000000000000000";
const ARC_TESTNET_GATEWAY_WALLET = "0x0077777d7EBA4688BDeF3E311b846F25870A19B9";

const facilitator = new BatchFacilitatorClient();

function buildRequirements(payTo: string, amount: string) {
  const atomic = Math.round(parseFloat(amount) * 1_000_000);
  return {
    scheme: "exact" as const,
    network: ARC_TESTNET_NETWORK,
    asset: ARC_TESTNET_USDC,
    amount: atomic.toString(),
    payTo,
    maxTimeoutSeconds: 691200,
    extra: { name: "GatewayWalletBatched", version: "1", verifyingContract: ARC_TESTNET_GATEWAY_WALLET },
  };
}

async function handle(req: NextRequest) {
  const url = new URL(req.url);
  const payTo = url.searchParams.get("payTo");
  const amount = url.searchParams.get("amount");
  const audioUrl = url.searchParams.get("audioUrl");

  if (!payTo || !amount || !audioUrl) {
    return NextResponse.json({ error: "payTo, amount, audioUrl required" }, { status: 400 });
  }

  const requirements = buildRequirements(payTo, amount);
  const paymentSignature = req.headers.get("payment-signature");

  if (!paymentSignature) {
    const paymentRequired = {
      x402Version: 2,
      resource: { url: url.pathname + url.search, description: "Transcription (Whisper large-v3)", mimeType: "application/json" },
      accepts: [requirements],
    };
    return new NextResponse(JSON.stringify({}), {
      status: 402,
      headers: { "Content-Type": "application/json", "PAYMENT-REQUIRED": Buffer.from(JSON.stringify(paymentRequired)).toString("base64") },
    });
  }

  try {
    const paymentPayload = JSON.parse(Buffer.from(paymentSignature, "base64").toString("utf-8"));
    const verify = await facilitator.verify(paymentPayload, requirements);
    if (!verify.isValid) return NextResponse.json({ error: "verification failed", reason: verify.invalidReason }, { status: 402 });
    const settle = await facilitator.settle(paymentPayload, requirements);
    if (!settle.success) return NextResponse.json({ error: "settlement failed", reason: settle.errorReason }, { status: 402 });

    const transcript = await transcribeFromUrl(audioUrl);

    const res = NextResponse.json({ ok: true, transcript, transaction: settle.transaction });
    res.headers.set("PAYMENT-RESPONSE", Buffer.from(JSON.stringify({ success: true, transaction: settle.transaction, network: requirements.network })).toString("base64"));
    return res;
  } catch (err) {
    return NextResponse.json({ error: "transcription error", message: (err as Error).message }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
