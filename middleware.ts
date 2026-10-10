import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { createClient as createSupabaseClient } from "@/utils/supabase/middleware";

const JWT_SECRET = process.env.JWT_SECRET || "trackerthings_jwt_super_secret_key_32bytes_min!";
const key = new TextEncoder().encode(JWT_SECRET);

const protectedRoutes = [
  "/dashboard",
  "/matakuliah",
  "/ujian",
  "/history",
  "/profile",
  "/settings",
];

const authRoutes = ["/login", "/register", "/recovery"];

export async function middleware(request: NextRequest) {
  // 1. Refresh Supabase session cookies if present
  const { response: supabaseResponse } = createSupabaseClient(request);

  const { pathname } = request.nextUrl;
  const token = request.cookies.get("auth_session")?.value;

  let isAuthenticated = false;
  if (token) {
    try {
      await jwtVerify(token, key, { algorithms: ["HS256"] });
      isAuthenticated = true;
    } catch {
      isAuthenticated = false;
    }
  }

  // Handle root "/" path
  if (pathname === "/") {
    if (isAuthenticated) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    } else {
      return NextResponse.redirect(new URL("/login", request.url));
    }
  }

  // If user is accessing protected routes and NOT authenticated
  const isProtected = protectedRoutes.some((route) => pathname.startsWith(route));
  if (isProtected && !isAuthenticated) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // If user is accessing auth routes and ALREADY authenticated
  const isAuthRoute = authRoutes.some((route) => pathname.startsWith(route));
  if (isAuthRoute && isAuthenticated) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/",
    "/dashboard/:path*",
    "/matakuliah/:path*",
    "/ujian/:path*",
    "/history/:path*",
    "/profile/:path*",
    "/settings/:path*",
    "/login",
    "/register",
    "/recovery",
  ],
};
