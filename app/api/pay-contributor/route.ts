/**
 * Protected endpoint: one nanopayment to one contributor.
 * payTo + amount come from query params so they're identical on the
 * 402-discovery request and the paid retry (stable requirements).
 */
import { BatchFacilitatorClient } from "@circle-fin/x402-batching/server";
import { NextRequest, NextResponse } from "next/server";

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
    extra: {
      name: "GatewayWalletBatched",
      version: "1",
      verifyingContract: ARC_TESTNET_GATEWAY_WALLET,
    },
  };
}

async function handle(req: NextRequest) {
  const url = new URL(req.url);
  const payTo = url.searchParams.get("payTo");
  const amount = url.searchParams.get("amount");

  if (!payTo || !amount) {
    return NextResponse.json({ error: "payTo and amount query params required" }, { status: 400 });
  }

  const requirements = buildRequirements(payTo, amount);
  const paymentSignature = req.headers.get("payment-signature");

  if (!paymentSignature) {
    const paymentRequired = {
      x402Version: 2,
      resource: {
        url: url.pathname + url.search,
        description: `Contributor payout (${amount} USDC)`,
        mimeType: "application/json",
      },
      accepts: [requirements],
    };
    return new NextResponse(JSON.stringify({}), {
      status: 402,
      headers: {
        "Content-Type": "application/json",
        "PAYMENT-REQUIRED": Buffer.from(JSON.stringify(paymentRequired)).toString("base64"),
      },
    });
  }

  try {
    const paymentPayload = JSON.parse(
      Buffer.from(paymentSignature, "base64").toString("utf-8"),
    );

   const verify = await facilitator.verify(paymentPayload, requirements);
    if (!verify.isValid) {
      console.error("[VERIFY FAILED]", JSON.stringify({
        invalidReason: verify.invalidReason,
        payer: verify.payer,
        requirements,
        payloadKeys: Object.keys(paymentPayload),
      }, null, 2));
      return NextResponse.json(
        { error: "verification failed", reason: verify.invalidReason },
        { status: 402 },
      );
    }

    const settle = await facilitator.settle(paymentPayload, requirements);
    if (!settle.success) {
      return NextResponse.json(
        { error: "settlement failed", reason: settle.errorReason },
        { status: 402 },
      );
    }

    const res = NextResponse.json({ ok: true, payTo, amount });
    res.headers.set(
      "PAYMENT-RESPONSE",
      Buffer.from(
        JSON.stringify({
          success: true,
          transaction: settle.transaction,
          network: requirements.network,
          payer: settle.payer ?? verify.payer ?? "unknown",
        }),
      ).toString("base64"),
    );
    return res;
  } catch (err) {
    return NextResponse.json(
      { error: "payment processing error", message: (err as Error).message },
      { status: 500 },
    );
  }
}

export const GET = handle;
export const POST = handle;
