import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: NextRequest) {
  const { dataUrl, key } = await req.json();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase environment variables:", {
      hasUrl: !!supabaseUrl,
      hasKey: !!supabaseKey
    });
    return NextResponse.json({ error: "Supabase env missing" }, { status: 500 });
  }
  const sb = createClient(supabaseUrl, supabaseKey);
  const match = /^data:(.+);base64,(.*)$/.exec(dataUrl || "");
  if (!match) return NextResponse.json({ error: "bad dataUrl" }, { status: 400 });
  const contentType = match[1];
  const bytes = Buffer.from(match[2], "base64");
  const filename = key || `vendor-advance/slide-${Date.now()}.png`;

  const { error } = await sb.storage.from("slides").upload(filename, bytes, {
    contentType,
    upsert: true,
  });
  if (error) {
    console.error("Supabase storage upload failed:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data } = sb.storage.from("slides").getPublicUrl(filename);
  return NextResponse.json({ url: data.publicUrl });
}