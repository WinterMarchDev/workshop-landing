"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import crypto from "crypto";

type State = { ok: boolean; error?: string; next?: string };

export async function authenticate(prevState: State, formData: FormData): Promise<State>{
  const pw = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/");
  const expected = process.env.WORKSHOP_PASSWORD_HASH;
  const hash = crypto.createHash("sha256").update(pw).digest("hex");
  if (!expected) return { ok:false, error:"Server misconfigured: missing WORKSHOP_PASSWORD_HASH", next };
  if (hash !== expected) return { ok:false, error:"Invalid password", next };
  (await cookies()).set("workshop_auth", hash, { httpOnly:true, secure:true, sameSite:"lax", path:"/", maxAge: 60*60*24*30 });
  redirect(next || "/");
}

export async function logout(){
  "use server";
  (await cookies()).delete("workshop_auth");
  redirect("/login");
}