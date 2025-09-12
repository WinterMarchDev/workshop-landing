import { NextRequest, NextResponse } from "next/server";
import { Liveblocks } from "@liveblocks/node";
import { verifyWmSession } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const secret = process.env.LIVEBLOCKS_SECRET_KEY;
  if (!secret) {
    return NextResponse.json(
      { error: "Server misconfigured: LIVEBLOCKS_SECRET_KEY missing." },
      { status: 500 }
    );
  }

  const cookie = req.cookies.get("wm_sess")?.value ?? null;
  const user = await verifyWmSession(cookie);
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let roomId: string | undefined;
  try {
    const body = await req.json();
    roomId = body?.room;
  } catch {
    // no body provided
  }

  const liveblocks = new Liveblocks({ secret });
  const session = liveblocks.prepareSession(user.id, {
    userInfo: { name: user.name ?? "WM User", avatar: user.avatar },
  });

  if (roomId) {
    session.allow(roomId, session.FULL_ACCESS);
  } else {
    session.allow("wm:*", session.FULL_ACCESS);      // allow both docs and slides namespaces
  }

  const { body, status } = await session.authorize();
  return new NextResponse(body, {
    status,
    headers: { "Content-Type": "application/json" },
  });
}