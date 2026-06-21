/**
 * Audio submission. The contributor's audio is already uploaded to Supabase Storage.
 * This route runs the RFB 01 loop:
 *   1. Platform Fees Agent pays the Transcription Agent (x402, real Arc settlement)
 *   2. Transcription Agent returns the real Whisper transcript
 *   3. The gate agent judges the transcript (same bar as text)
 *   4. If accepted: embed, assign a Con, store with source_format 'audio', return claim key
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { randomBytes } from "crypto";
import { GatewayClient } from "@circle-fin/x402-batching/client";
import { gateSubmission } from "@/lib/gate";
import { embed } from "@/lib/agent-loop";
import { transcriptionQuote, feesAgentDecides, claritySurcharge } from "@/lib/transcribe-pricing";

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";

function makeClaimKey(): string {
  const hex = randomBytes(4).toString("hex").toUpperCase();
  return `EMP-${hex.slice(0, 4)}-${hex.slice(4, 8)}`;
}

let gateway: GatewayClient | null = null;
function getGateway() {
  if (!gateway) gateway = new GatewayClient({ chain: "arcTestnet", privateKey: process.env.BUYER_PRIVATE_KEY as `0x${string}` });
  return gateway;
}

export async function POST(req: NextRequest) {
  try {
    const { audioUrl, title, durationSec } = await req.json();
    if (!audioUrl?.trim()) return NextResponse.json({ error: "audioUrl required" }, { status: 400 });

    // look up the two service agents
    const { data: trans } = await db.from("service_agents").select("*").eq("kind", "transcription").single();
    const { data: fees } = await db.from("service_agents").select("*").eq("kind", "fees").single();
    if (!trans || !fees) return NextResponse.json({ error: "service agents not configured" }, { status: 500 });

   // recent congestion: jobs done in the last hour
    const sinceIso = new Date(Date.now() - 3600_000).toISOString();
    const { count: recentJobs } = await db.from("experiences")
      .select("id", { count: "exact", head: true })
      .eq("source_format", "audio").gte("created_at", sinceIso);

    // 1. Transcription Agent QUOTES its price (duration + congestion + reputation)
    const quote = transcriptionQuote(
      { base_rate: trans.base_rate, jobs_done: trans.jobs_done ?? 0 },
      Number(durationSec ?? 30),
      recentJobs ?? 0,
    );

    // 2. Fees Agent judges FAIRNESS — declines only overcharging, not bigness
    const decision = feesAgentDecides(quote);
    if (!decision.accept) {
      return NextResponse.json({ accepted: false, declined: true, reason: `The platform's Fees Agent declined the transcription quote: ${decision.reason}. Try again shortly.` }, { status: 200 });
    }

    const fee = quote.price;

    // 3. Fees Agent pays the Transcription Agent the quoted price via x402
    const g = getGateway();
    const bal = await g.getBalances();
    const avail = Number(bal.gateway.formattedAvailable ?? "0");
    if (avail < fee + 0.05) await g.deposit((fee + 0.5).toFixed(6));

    const tUrl = `${BASE_URL}/api/transcribe?payTo=${trans.wallet_address}&amount=${fee.toFixed(6)}&audioUrl=${encodeURIComponent(audioUrl)}`;
    const payRes = await g.pay(tUrl, { method: "GET" });
    const body = (payRes as { data?: { transcript?: string; transaction?: string } }).data;
    const transcript = body?.transcript ?? "";
    const transcriptionTx = body?.transaction ?? (payRes as { transaction?: string }).transaction ?? null;

    if (!transcript.trim()) {
      return NextResponse.json({ error: "transcription returned empty" }, { status: 500 });
    }

    // 4. clarity surcharge if the audio was genuinely hard (post-transcription)
    const surcharge = claritySurcharge(transcript, quote.durationSec);
    const totalFee = Number((fee + surcharge).toFixed(6));

    await db.rpc("increment_service_agent", { kind_in: "transcription", jobs_inc: 1, amount: totalFee }).then(() => {}, () => {});
    // 2. gate agent judges the transcript
    const titleForGate = title?.trim() || transcript.slice(0, 40);
    const verdict = await gateSubmission(titleForGate, transcript);
    if (!verdict.accepted) {
      return NextResponse.json({ accepted: false, transcript, reason: verdict.reason, transcriptionTx }, { status: 200 });
    }

    // 3. anonymous contributor + Con + store
    const pk = generatePrivateKey();
    const address = privateKeyToAccount(pk).address;
    const claimKey = makeClaimKey();
    const handle = `anon-${address.slice(2, 8).toLowerCase()}`;

    const { data: consList } = await db.from("cons").select("id, label, fee_rate");
    const con = consList && consList.length ? consList[Math.floor(Math.random() * consList.length)] : null;

    const { data: contributor, error: cErr } = await db.from("contributors").insert({
      handle, wallet_address: address, wallet_private_key: pk, claim_key: claimKey, con_id: con?.id ?? null,
    }).select().single();
    if (cErr) throw cErr;
    if (con) await db.rpc("increment_con_contributors", { con_id_in: con.id }).then(() => {}, () => {});

    const embedding = await embed(`${verdict.suggestedTitle}\n${transcript}`);
    const { error: eErr } = await db.from("experiences").insert({
      contributor_id: contributor.id, title: verdict.suggestedTitle, body: transcript.trim(),
      source_format: "audio", quality_score: verdict.quality, domain: verdict.domain,
      status: "approved", embedding,
    });
    if (eErr) throw eErr;

    return NextResponse.json({
      accepted: true, claimKey, transcript, domain: verdict.domain, quality: verdict.quality,
      title: verdict.suggestedTitle, reason: verdict.reason, transcriptionTx,
      quote: { price: quote.price, breakdown: quote.breakdown }, surcharge, totalFee,
      con: con ? { label: con.label, feeRate: con.fee_rate } : null,
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
