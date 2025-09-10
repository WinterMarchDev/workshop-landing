"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { sbAdmin } from "../server/supabase-admin";
import crypto from "crypto";

const COOKIE_NAME = "wm_sess";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7;

function sign(payload: string) {
  const h = crypto.createHmac("sha256", process.env.SESSION_SECRET!);
  h.update(payload);
  return h.digest("base64url");
}

type State = { ok: boolean; error?: string; next?: string };

export async function login(prev: State, formData: FormData): Promise<State> {
  const username = String(formData.get("username") ?? "");
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/");

  const { data, error } = await sbAdmin.rpc("auth_check_password", {
    p_username: username,
    p_password: password,
  });

  if (error || !data || data.length === 0) {
    return { ok: false, error: "Invalid username or password", next };
  }

  const user = data[0];
  const exp = Math.floor(Date.now() / 1000) + COOKIE_MAX_AGE;
  const payload = `${user.id}.${exp}`;
  const token = `${payload}.${sign(payload)}`;

  (await cookies()).set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });

  redirect(next || "/");
}

export async function logout() {
  (await cookies()).delete(COOKIE_NAME);
  redirect("/login");
}