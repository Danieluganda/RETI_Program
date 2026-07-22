import { NextResponse, type NextRequest } from "next/server";

const publicPaths = [
  "/consent/sample",
  "/consent/thank-you",
  "/api/auth",
  "/api/consents",
  "/api/esos",
  "/api/participants",
  "/api/uploads",
];

function isPublicPath(pathname: string) {
  return (
    pathname.startsWith("/_next/") ||
    pathname === "/favicon.ico" ||
    pathname === "/login" ||
    publicPaths.some((path) => pathname === path || pathname.startsWith(`${path}/`))
  );
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isAuthenticated = request.cookies.get("consent_auth")?.value === "demo-token-usr-demo";

  if (isAuthenticated && pathname === "/login") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (isPublicPath(pathname) || isAuthenticated) {
    return NextResponse.next();
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!.*\\..*).*)"],
};
