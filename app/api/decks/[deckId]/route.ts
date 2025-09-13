export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET(
  _req: NextRequest,
  { params }: { params: { deckId: string } }
) {
  const sb = createClient(SB_URL, SB_KEY);
  const { data, error } = await sb.from("decks").select("*").eq("id", params.deckId).maybeSingle();
  if (error) return new Response(error.message, { status: 500 });
  if (!data) return new Response(JSON.stringify({ id: params.deckId, doc: null, rev: 0 }), { status: 200 });
  return new Response(JSON.stringify(data), { status: 200, headers: { "Content-Type": "application/json" } });
}

export async function PUT(req: NextRequest, { params }: { params: { deckId: string } }) {
  try {
    const body = await req.json() as { doc: any; rev: number };
    const sb = createClient(SB_URL, SB_KEY);
    const { data: cur, error: e1 } = await sb.from("decks").select("rev").eq("id", params.deckId).maybeSingle();
    if (e1) return new Response(e1.message, { status: 500 });

    if (cur && body.rev < cur.rev) {
      return new Response("Revision conflict", { status: 409 });
    }

    const next = { id: params.deckId, doc: body.doc, rev: (cur?.rev ?? 0) + 1 };
    const { error: e2 } = await sb.from("decks").upsert(next, { onConflict: "id" });
    if (e2) return new Response(e2.message, { status: 500 });

    return new Response(JSON.stringify(next), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (e: any) {
    return new Response(e.message ?? "Bad request", { status: 400 });
  }
}