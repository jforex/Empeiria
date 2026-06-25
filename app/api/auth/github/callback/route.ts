/**
 * GitHub OAuth callback — exchange code → fetch user → find/create dev account → set session.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { createSessionCookie } from "@/lib/session";

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const cookieState = req.cookies.get("oauth_state")?.value;
    if (!code) return NextResponse.redirect(new URL("/create?auth=error", req.url));
    if (!state || state !== cookieState) return NextResponse.redirect(new URL("/create?auth=state", req.url));

    // exchange code for access token
    const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        client_id: process.env.GITHUB_OAUTH_CLIENT_ID,
        client_secret: process.env.GITHUB_OAUTH_CLIENT_SECRET,
        code, redirect_uri: process.env.GITHUB_OAUTH_REDIRECT,
      }),
    });
    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;
    if (!accessToken) return NextResponse.redirect(new URL("/create?auth=token", req.url));

    // fetch the GitHub user
    const userRes = await fetch("https://api.github.com/user", {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/vnd.github+json" },
    });
    const gh = await userRes.json();
    const owner = (gh.login || "").toLowerCase();
    if (!owner) return NextResponse.redirect(new URL("/create?auth=user", req.url));

    // find or create the dev account for this GitHub owner
    let { data: account } = await db.from("dev_accounts").select("id, account_key").eq("github_owner", owner).maybeSingle();
    if (!account) {
      const pk = generatePrivateKey();
      const addr = privateKeyToAccount(pk).address;
      const rand = () => Math.random().toString(16).slice(2, 6).toUpperCase();
      const { data: created, error } = await db.from("dev_accounts").insert({
        github_owner: owner, account_key: `EMP-${rand()}-${rand()}`,
        wallet_address: addr, wallet_private_key: pk,
      }).select("id, account_key").single();
      if (error) throw error;
      account = created;
    }

    // set the session cookie, clear the oauth state, send to dashboard
    const res = NextResponse.redirect(new URL("/create?auth=ok", req.url));
    res.headers.append("Set-Cookie", createSessionCookie({ accountId: account.id, githubOwner: owner, avatar: gh.avatar_url }));
    res.headers.append("Set-Cookie", `oauth_state=; Path=/; HttpOnly; Max-Age=0`);
    return res;
  } catch (err) {
    return NextResponse.redirect(new URL(`/create?auth=error`, req.url));
  }
}
