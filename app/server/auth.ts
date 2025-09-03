"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const COOKIE_NAME = 'workshop_auth';
const DEMO_USERNAME = 'WinterMarch';
const DEMO_PASSWORD = 'WinterMarch';

type State = { ok: boolean; error?: string; next?: string };

export async function authenticate(prevState: State, formData: FormData): Promise<State>{
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/");
  
  if (username === DEMO_USERNAME && password === DEMO_PASSWORD) {
    (await cookies()).set(COOKIE_NAME, 'demo-ok', { 
      httpOnly: true, 
      secure: true, 
      sameSite: "lax", 
      path: "/", 
      maxAge: 60 * 60 // 1 hour
    });
    redirect(next || "/");
  }
  
  return { ok: false, error: "Invalid username or password", next };
}

export async function logout(){
  "use server";
  (await cookies()).delete(COOKIE_NAME);
  redirect("/login");
}