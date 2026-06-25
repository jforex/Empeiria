/**
 * Minimal signed-cookie sessions (no external deps).
 * Cookie value = base64(payload).signature, signed with SESSION_SECRET.
 */
import crypto from "crypto";

const SECRET = process.env.SESSION_SECRET || "dev-insecure-secret";
const COOKIE = "emp_session";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export type Session = { accountId: string; githubOwner: string; avatar?: string };

function sign(data: string): string {
  return crypto.createHmac("sha256", SECRET).update(data).digest("base64url");
}

export function createSessionCookie(session: Session): string {
  const payload = Buffer.from(JSON.stringify(session)).toString("base64url");
  const sig = sign(payload);
  const value = `${payload}.${sig}`;
  return `${COOKIE}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${MAX_AGE}`;
}

export function clearSessionCookie(): string {
  return `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

export function readSession(cookieHeader: string | null): Session | null {
  if (!cookieHeader) return null;
  const match = cookieHeader.split(";").map((c) => c.trim()).find((c) => c.startsWith(`${COOKIE}=`));
  if (!match) return null;
  const value = match.slice(COOKIE.length + 1);
  const dot = value.lastIndexOf(".");
  if (dot === -1) return null;
  const payload = value.slice(0, dot), sig = value.slice(dot + 1);
  if (sign(payload) !== sig) return null; // tampered
  try { return JSON.parse(Buffer.from(payload, "base64url").toString()); } catch { return null; }
}
