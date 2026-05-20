import { NextResponse, type NextRequest } from "next/server";

// PIB é PT-only — não usa next-intl middleware.
// Redirect legado /pt/* → /* (links externos de campanhas antigas).
export function middleware(request: NextRequest) {
  const url = request.nextUrl;
  if (url.pathname.startsWith("/pt/") || url.pathname === "/pt") {
    const redirectUrl = url.clone();
    redirectUrl.pathname = url.pathname.replace(/^\/pt(\/|$)/, "/");
    return NextResponse.redirect(redirectUrl, 308);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
