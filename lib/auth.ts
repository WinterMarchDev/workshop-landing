import crypto from "crypto";
import { sbAdmin } from "@/app/server/supabase-admin";

const COOKIE_NAME = "wm_sess";

function b64urlToBuf(input: string) {
  // Pad and replace to standard base64
  const pad = input.length % 4 ? 4 - (input.length % 4) : 0;
  const s = input.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat(pad);
  const bin = atob(s);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
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