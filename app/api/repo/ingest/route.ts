/**
 * Connect a GitHub repo → create its knowledge agent → ingest docs + source.
 * The repo becomes a creator row (is_repo=true) so the whole ask/pay/withdraw
 * engine works unchanged. The maintainer earns when the agent is used.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { parseRepo, fetchRepoMeta, ingestRepo, registerWebhook } from "@/lib/github-ingest";

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function POST(req: NextRequest) {
  try {
    const { repo } = await req.json();
    if (!repo?.trim()) return NextResponse.json({ error: "repo url or owner/name required" }, { status: 400 });

    const parsed = parseRepo(repo);
    if (!parsed) return NextResponse.json({ error: "couldn't parse that as a GitHub repo" }, { status: 400 });

    // fetch repo metadata
    const meta = await fetchRepoMeta(parsed.owner, parsed.name);

   // find or create the dev account for this GitHub owner (one account per owner)
    const rand4 = () => Math.random().toString(16).slice(2, 6).toUpperCase();
    let { data: devAccount } = await db.from("dev_accounts").select("id, account_key").eq("github_owner", parsed.owner.toLowerCase()).maybeSingle();
    if (!devAccount) {
      const apk = generatePrivateKey();
      const aaddr = privateKeyToAccount(apk).address;
      const accountKey = `EMP-${rand4()}-${rand4()}`;
      const { data: newAcct, error: acctErr } = await db.from("dev_accounts").insert({
        github_owner: parsed.owner.toLowerCase(), account_key: accountKey,
        wallet_address: aaddr, wallet_private_key: apk,
      }).select("id, account_key").single();
      if (acctErr) throw acctErr;
      devAccount = newAcct;
    }

    // already connected?
    const { data: existing } = await db.from("creators").select("id, handle, access_key").eq("repo_full_name", meta.fullName).maybeSingle();
    let creatorId: string, handle: string, accessKey: string;

    if (existing) {
      creatorId = existing.id; handle = existing.handle; accessKey = existing.access_key;
      // ensure it's linked to the dev account
      await db.from("creators").update({ owner_account_id: devAccount.id }).eq("id", creatorId);
      // clear old chunks so re-ingest is fresh
      await db.from("creator_chunks").delete().eq("creator_id", creatorId);
      await db.from("creator_content").delete().eq("creator_id", creatorId);
    } else {
      const pk = generatePrivateKey();
      const address = privateKeyToAccount(pk).address;
      const rand = () => Math.random().toString(16).slice(2, 6).toUpperCase();
      accessKey = `EMP-${rand()}-${rand()}`;
      handle = `${parsed.owner}-${parsed.name}`.toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 39);

      // ensure handle unique
      const { data: clash } = await db.from("creators").select("id").eq("handle", handle).maybeSingle();
      if (clash) handle = `${handle}-${rand().toLowerCase()}`;

      const { data: created, error } = await db.from("creators").insert({
        handle, name: meta.fullName, category: "code",
        agent_label: `${parsed.name} Agent`,
        agent_tagline: meta.description || `Ask anything about ${meta.fullName}`,
        avatar_url: meta.ownerAvatar,
        wallet_address: address, wallet_private_key: pk, access_key: accessKey,
       is_repo: true, repo_full_name: meta.fullName, repo_url: `https://github.com/${meta.fullName}`,
        repo_stars: meta.stars, repo_branch: meta.defaultBranch,
        owner_account_id: devAccount.id,
      }).select("id").single();
      if (error) throw error;
      creatorId = created.id;
    }

    // ingest the repo files
  const result = await ingestRepo(creatorId, parsed.owner, parsed.name, meta.defaultBranch);

    // try to auto-register a push webhook so the repo stays in sync
    let autoSync = false;
    let webhookError: string | null = null;
    const { data: cur } = await db.from("creators").select("webhook_id").eq("id", creatorId).maybeSingle();
    if (cur?.webhook_id) {
      autoSync = true; // already has a webhook
    } else {
      const hook = await registerWebhook(parsed.owner, parsed.name);
      if (hook.id) {
        autoSync = true;
        await db.from("creators").update({ webhook_id: hook.id, auto_sync: true }).eq("id", creatorId);
      } else {
        webhookError = hook.error ?? "could not register webhook";
      }
    }
    await db.from("creators").update({ last_synced_at: new Date().toISOString() }).eq("id", creatorId);

    return NextResponse.json({
      ok: true,
      autoSync,
      webhookError,
      handle, accessKey,
      accountKey: devAccount.account_key,
      owner: parsed.owner,
      repo: meta.fullName,
      agentLabel: `${parsed.name} Agent`,
      filesIngested: result.filesIngested,
      chunks: result.chunks,
      stars: meta.stars,
    });
  } catch (err) {
    return NextResponse.json({ error: "ingestion failed", message: (err as Error).message }, { status: 500 });
  }
}
