import { NextResponse, type NextRequest } from "next/server";

// Cheap gate only: the cookie is verified, and the role checked, in each page/action (lib/auth.ts).
export function middleware(req: NextRequest) {
  if (!req.cookies.get("__session")) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ["/admin/:path*", "/rate/:path*"] };
