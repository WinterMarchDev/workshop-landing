import { NextRequest, NextResponse } from "next/server";

const COOKIE_NAME = "wm_sess";
const PUBLIC_PATHS = [
  "/login",
  "/favicon.ico",
  "/robots.txt",
  "/manifest.webmanifest",
  "/apple-touch-icon.png",
  "/icon.svg",
  "/_next",
  "/static",
  "/images",
  "/fonts",
];

function isPublic(pathname: string) {
  return PUBLIC_PATHS.some(p => pathname === p || pathname.startsWith(p + "/"));
}

function b64urlToBuf(input: string) {
  // Pad and replace to standard base64
  const pad = input.length % 4 ? 4 - (input.length % 4) : 0;
  const s = input.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat(pad);
  const bin = atob(s);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  if (isPublic(pathname)) return NextResponse.next();

  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (token) {
    const parts = token.split(".");
    if (parts.length === 3) {
      const [id, exp, sig] = parts;
      const expNum = Number(exp);
      if (Number.isFinite(expNum) && expNum * 1000 > Date.now()) {
        const secret = process.env.SESSION_SECRET!;
        const key = await crypto.subtle.importKey(
          "raw",
          new TextEncoder().encode(secret),
          { name: "HMAC", hash: "SHA-256" },
          false,
          ["verify"]
        );
        const ok = await crypto.subtle.verify(
          "HMAC",
          key,
          b64urlToBuf(sig),
          new TextEncoder().encode(`${id}.${exp}`)
        );
        if (ok) return NextResponse.next();
      }
    }
  }

  const url = req.nextUrl.clone();
  url.pathname = "/login";
  if (pathname !== "/") url.searchParams.set("next", pathname + search);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt|manifest.webmanifest|images/|fonts/).*)"]
};