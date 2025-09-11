import { NextRequest } from "next/server";
import { Liveblocks } from "@liveblocks/node";

// Reuse your real session verification. Example assumes you have a shared util:
import { verifyWmSession } from "@/lib/auth";

const liveblocks = new Liveblocks({
  secret: process.env.LIVEBLOCKS_SECRET_KEY!,
});

// Clients POST { room: "wm:docs:vendor-advance" } to this route.
// We verify your cookie, then grant access to that room specifically.
export async function POST(req: NextRequest) {
  // Strict gate: must be signed in via your existing cookie
  const cookie = req.cookies.get("wm_sess")?.value;
  const user = await verifyWmSession(cookie);
  if (!user) return new Response("unauthorized", { status: 401 });

  const { room } = await req.json();

  // Build a Liveblocks session for this user and allow exactly this room
  const session = liveblocks.prepareSession(user.id, {
    userInfo: { name: user.name ?? "WM User", avatar: user.avatar },
  });

  // If you want to allow all docs, use a pattern like "wm:docs:*"
  // session.allow("wm:docs:*", session.FULL_ACCESS);
  // For strictness, only allow the requested room:
  session.allow(room, session.FULL_ACCESS);

  const { body, status } = await session.authorize();
  return new Response(body, { status });
}