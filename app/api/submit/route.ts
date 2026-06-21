/**
 * Contributor submission. The gate agent judges the experience; if accepted,
 * an anonymous contributor wallet + claim key are generated, the experience
 * is embedded (Gemini) and stored in the pool. Returns the claim key.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { randomBytes } from "crypto";
import { gateSubmission } from "@/lib/gate";
import { embed } from "@/lib/agent-loop";
import { anchorContribution } from "@/lib/anchor";

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

function makeClaimKey(): string {
  // human-friendly, anonymous: e.g. EMP-7F3A-9C2D
  const hex = randomBytes(4).toString("hex").toUpperCase();
  return `EMP-${hex.slice(0, 4)}-${hex.slice(4, 8)}`;
}

export async function POST(req: NextRequest) {
  try {
    const { title, body } = await req.json();
    if (!title?.trim() || !body?.trim()) {
      return NextResponse.json({ error: "title and body required" }, { status: 400 });
    }
    if (body.trim().length < 120) {
      return NextResponse.json({ accepted: false, reason: "Please share a bit more detail — real experience usually needs a few sentences to be useful to someone." }, { status: 200 });
    }

    // 1. gate agent judges
    const verdict = await gateSubmission(title, body);
    if (!verdict.accepted) {
      return NextResponse.json({ accepted: false, reason: verdict.reason }, { status: 200 });
    }

    // 2. anonymous contributor wallet + claim key
    const pk = generatePrivateKey();
    const address = privateKeyToAccount(pk).address;
    const claimKey = makeClaimKey();
    const handle = `anon-${address.slice(2, 8).toLowerCase()}`;

    // assign a Con (representative agent) at random
    const { data: cons } = await db.from("cons").select("id, label, fee_rate");
    const con = cons && cons.length ? cons[Math.floor(Math.random() * cons.length)] : null;

    const { data: contributor, error: cErr } = await db.from("contributors").insert({
      handle, wallet_address: address, wallet_private_key: pk, claim_key: claimKey,
      con_id: con?.id ?? null,
    }).select().single();
    if (cErr) throw cErr;

    if (con) {
      await db.rpc("increment_con_contributors", { con_id_in: con.id }).then(() => {}, () => {});
    }

    // 3. embed + store the experience
const embedding = await embed(`${verdict.suggestedTitle}\n${body}`);
    const { data: exp, error: eErr } = await db.from("experiences").insert({
      contributor_id: contributor.id,
      title: verdict.suggestedTitle,
      body: body.trim(),
      source_format: "text",
      quality_score: verdict.quality,
      domain: verdict.domain,
      status: "approved",
      embedding,
    }).select().single();
    if (eErr) throw eErr;

    // anchor provenance on-chain (platform attests contributor + content hash)
    let anchor: { storyHash: string; txHash: string } | null = null;
    try {
      const a = await anchorContribution(body.trim(), address);
      anchor = { storyHash: a.storyHash, txHash: a.txHash };
      await db.from("experiences").update({
        story_hash: a.storyHash, anchor_tx: a.txHash, anchored_contributor: address,
      }).eq("id", exp.id);
    } catch { /* anchoring is best-effort; submission still succeeds */ }

  return NextResponse.json({
      accepted: true,
      claimKey,
      domain: verdict.domain,
      quality: verdict.quality,
      title: verdict.suggestedTitle,
      reason: verdict.reason,
      con: con ? { label: con.label, feeRate: con.fee_rate } : null,
      anchor,
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
