import crypto from "crypto";
import { sbAdmin } from "@/app/server/supabase-admin";

const COOKIE_NAME = "wm_sess";

function b64urlToBuf(input: string) {
  const s = input.replace(/-/g, '+').replace(/_/g, '/');
  const pad = s.length % 4 ? 4 - (s.length % 4) : 0;
  const b64 = s + '='.repeat(pad);
  return Uint8Array.from(Buffer.from(b64, 'base64'));
}

export async function verifyWmSession(token: string | undefined) {
  if (!token) return null;

  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const [id, exp, sig] = parts;
  const expNum = Number(exp);
  
  // Check if token is expired
  if (!Number.isFinite(expNum) || expNum * 1000 <= Date.now()) {
    return null;
  }

  // Verify signature
  const secret = process.env.SESSION_SECRET!;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"]
  );
  
  const ok = await crypto.subtle.verify(
    "HMAC",
    key,
    b64urlToBuf(sig),
    new TextEncoder().encode(`${id}.${exp}`)
  );
  
  if (!ok) return null;

  // Fetch user info from database
  const { data: user } = await sbAdmin
    .from("passwords")
    .select("id, username, User")
    .eq("id", id)
    .single();

  if (!user) return null;

  return {
    id: String(user.id),
    name: user.User || user.username,
    avatar: undefined,
  };
}