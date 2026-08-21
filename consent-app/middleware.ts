import { NextResponse, type NextRequest } from "next/server";
import { userByToken } from "./lib/auth";

const publicPaths = [
  "/consent",
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

function isRichblackPath(pathname: string) {
  return pathname === "/richblack" || pathname.startsWith("/richblack/") || pathname === "/api/exports/richblack";
}

function isBusalaPath(pathname: string) {
  return pathname === "/busala" || pathname.startsWith("/busala/") || pathname === "/api/exports/busala";
}

function isUncdfPath(pathname: string) {
  return pathname === "/uncdf" || pathname.startsWith("/uncdf/") || pathname === "/api/exports/uncdf";
}

function forbidden(request: NextRequest, homePath: string) {
  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.redirect(new URL(homePath, request.url));
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const user = userByToken(request.cookies.get("consent_auth")?.value);
  const isAuthenticated = Boolean(user);

  if (user && pathname === "/login") {
    return NextResponse.redirect(new URL(user.homePath, request.url));
  }

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  if (user?.role === "partner") {
    if (user.partner === "richblack" && isRichblackPath(pathname)) return NextResponse.next();
    if (user.partner === "busala" && isBusalaPath(pathname)) return NextResponse.next();
    if (user.partner === "uncdf" && isUncdfPath(pathname)) return NextResponse.next();
    return forbidden(request, user.homePath);
  }

  if (isAuthenticated) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!.*\\..*).*)"],
};
