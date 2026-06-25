/**
 * Start GitHub OAuth — redirect the user to GitHub's consent screen.
 */
import { NextResponse } from "next/server";
import crypto from "crypto";

export async function GET() {
  const state = crypto.randomBytes(16).toString("hex");
  const params = new URLSearchParams({
    client_id: process.env.GITHUB_OAUTH_CLIENT_ID!,
    redirect_uri: process.env.GITHUB_OAUTH_REDIRECT!,
    scope: "read:user",
    state,
  });
  const res = NextResponse.redirect(`https://github.com/login/oauth/authorize?${params}`);
  res.headers.append("Set-Cookie", `oauth_state=${state}; Path=/; HttpOnly; SameSite=Lax; Max-Age=600`);
  return res;
}
