"use server";

import { headers } from "next/headers";
import { createClient } from "@supabase/supabase-js";

type State = { ok: boolean; message: string; project?: string };

export async function submitFeedback(prev: State, formData: FormData): Promise<State>{
  const project = String(formData.get("project") || prev.project || "");
  const email = String(formData.get("email") || "");
  const message = String(formData.get("message") || "");
  if (!message) return { ok:false, message:"Message is required", project };

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY){
    return { ok:false, message:"Server missing Supabase env vars. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.", project };
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const ua = (await headers()).get("user-agent") || "";
  const referer = (await headers()).get("referer") || "";

  const { error } = await supabase.from("workshop_feedback").insert({ project, email, message, user_agent: ua, url: referer });
  if (error) return { ok:false, message:`Failed to save: ${error.message}`, project };
  return { ok:true, message:"Thanks — received.", project };
}