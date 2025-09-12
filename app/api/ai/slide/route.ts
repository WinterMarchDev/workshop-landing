// app/api/ai/slide/route.ts
import { NextRequest, NextResponse } from "next/server";

type Layout = {
  bg: "light" | "dark";
  elements: Array<
    | { type: "title"; text: string; x: number; y: number; w: number; h: number }
    | { type: "subtitle"; text: string; x: number; y: number; w: number; h: number }
    | { type: "bullets"; items: string[]; x: number; y: number; w: number; h: number }
    | { type: "callout"; text: string; x: number; y: number; w: number; h: number }
  >;
};

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Missing ANTHROPIC_API_KEY" }, { status: 500 });
  }

  const { text, theme } = await req.json();

  const prompt = [
    "You are a slide layout engine. Output ONLY JSON. No prose. Canvas is 1920x1080.",
    'Schema: {"bg":"light|dark","elements":[{"type":"title","text", "x","y","w","h"},{"type":"subtitle","text","x","y","w","h"},{"type":"bullets","items":[...],"x","y","w","h"},{"type":"callout","text","x","y","w","h"}]}',
    "Constraints: use a 12-column grid; generous margins; never overlap; keep readable line lengths; return at least a title or bullets if source text is sparse.",
    "Theme (JSON):",
    JSON.stringify(
      theme ?? {
        palette: {
          bgLight: "#FFFFFF",
          bgDark: "#0F172A",
          text: "#0B1F2E",
          accent: "#6B849D",
          brandBg: "#EDF1F4"
        },
        fontScale: { title: 56, subtitle: 36, body: 28, callout: 30 }
      }
    ),
    "Source text:",
    text ?? ""
  ].join("\n");

  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json"
    },
    body: JSON.stringify({
      model: "claude-3-5-sonnet-20240620",
      max_tokens: 1200,
      system: "Respond with valid JSON only. Do not wrap in code fences.",
      messages: [{ role: "user", content: prompt }]
    })
  });

  if (!r.ok) {
    const err = await r.text();
    return NextResponse.json({ error: err }, { status: r.status });
  }

  const data = await r.json();
  const raw = data?.content?.[0]?.text ?? "{}";
  // strip accidental fences or junk
  const cleaned = raw.trim().replace(/^```json\s*|\s*```$/g, "");
  let parsed: Layout;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    return NextResponse.json({ error: "Model returned non-JSON." }, { status: 502 });
  }
  return NextResponse.json(parsed);
}