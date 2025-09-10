"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { sbAdmin } from "./supabase-admin";
import bcrypt from "bcryptjs";
import crypto from "crypto";

const COOKIE_NAME = "wm_sess";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

type State = { ok: boolean; error?: string; next?: string };

function sign(payload: string) {
  const secret = process.env.SESSION_SECRET!;
  const h = crypto.createHmac("sha256", secret);
  h.update(payload);
  return h.digest("base64url");
}

function safeEqual(a: string, b: string) {
  const A = Buffer.from(a);
  const B = Buffer.from(b);
  if (A.length !== B.length) return false;
  return crypto.timingSafeEqual(A, B);
}

async function verifyPassword(input: string, hash?: string | null, legacyPlain?: string | null) {
  if (hash) {
    try { return await bcrypt.compare(input, hash); } catch { return false; }
  }
  if (legacyPlain) return safeEqual(input, legacyPlain);
  return false;
}

export async function login(prev: State, formData: FormData): Promise<State> {
  const username = String(formData.get("username") ?? "");
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/");

  if (!username || !password) return { ok: false, error: "Missing credentials", next };

  const { data, error } = await sbAdmin
    .from("passwords")
    .select('id, username, "User", password_hash, password')
    .eq("username", username)
    .maybeSingle();

  if (error || !data) return { ok: false, error: "Invalid username or password", next };

  const ok = await verifyPassword(password, data.password_hash, data.password);
  if (!ok) return { ok: false, error: "Invalid username or password", next };

  const exp = Math.floor(Date.now() / 1000) + COOKIE_MAX_AGE;
  const payload = `${data.id}.${exp}`;
  const sig = sign(payload);
  const token = `${payload}.${sig}`;

  (await cookies()).set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE
  });

  redirect(next || "/");
}

export async function logout() {
  (await cookies()).delete(COOKIE_NAME);
  redirect("/login");
}