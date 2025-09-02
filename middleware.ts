import { NextRequest, NextResponse } from "next/server";

const PUBLIC_PATHS = ["/login", "/api/public", "/favicon.ico", "/robots.txt", "/manifest.webmanifest", "/apple-touch-icon.png", "/icon.svg", "/opengraph-image", "/_next", "/static", "/images", "/fonts"];

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  for (const p of PUBLIC_PATHS) {
    if (pathname === p || pathname.startsWith(p + "/")) {
      return NextResponse.next();
    }
  }
  const cookie = req.cookies.get("workshop_auth")?.value;
  const expected = process.env.WORKSHOP_PASSWORD_HASH;
  if (cookie && expected && cookie === expected) return NextResponse.next();
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  if (pathname !== "/") url.searchParams.set("next", pathname + search);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt|manifest.webmanifest|images/|fonts/).*)"],
};