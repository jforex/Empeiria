/**
 * Creator signup — creates a named creator with a platform-custodied wallet
 * and their knowledge agent identity. Returns the creator id + a private key
 * the creator saves to manage their account (anonymous-but-owned, like the
 * contributor claim key, but tied to a public profile).
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function POST(req: NextRequest) {
  try {
    const { name, handle, category, bio, agentLabel, agentTagline, avatarUrl } = await req.json();

    if (!name?.trim() || !handle?.trim()) {
      return NextResponse.json({ error: "name and handle required" }, { status: 400 });
    }

    const cleanHandle = handle.trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
    if (cleanHandle.length < 3) {
      return NextResponse.json({ error: "handle must be at least 3 characters (letters, numbers, underscore)" }, { status: 400 });
    }

    // handle must be unique
    const { data: existing } = await db.from("creators").select("id").eq("handle", cleanHandle).maybeSingle();
    if (existing) {
      return NextResponse.json({ error: `@${cleanHandle} is taken — pick another handle` }, { status: 409 });
    }

   const pk = generatePrivateKey();
    const address = privateKeyToAccount(pk).address;
    const rand = () => Math.random().toString(16).slice(2, 6).toUpperCase();
    const accessKey = `EMP-${rand()}-${rand()}`;
    const { data: creator, error } = await db.from("creators").insert({
      handle: cleanHandle,
      name: name.trim(),
      category: category?.trim() || "general",
      bio: bio?.trim() || null,
      agent_label: agentLabel?.trim() || `${name.trim()}'s Agent`,
      agent_tagline: agentTagline?.trim() || null,
      avatar_url: avatarUrl?.trim() || null,
      wallet_address: address,
      wallet_private_key: pk,
      access_key: accessKey,
    }).select("id, handle, name, agent_label").single();
    if (error) throw error;

 return NextResponse.json({
      ok: true,
      creatorId: creator.id,
      handle: creator.handle,
      name: creator.name,
      agentLabel: creator.agent_label,
      walletAddress: address,
      accessKey,
    });
  } catch (err) {
    return NextResponse.json({ error: "signup failed", message: (err as Error).message }, { status: 500 });
  }
}
