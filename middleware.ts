import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { createClient as createSupabaseClient } from "@/utils/supabase/middleware";

function getMiddlewareJwtKey(): Uint8Array | null {
  const secret = process.env.JWT_SECRET;
  if (process.env.NODE_ENV === "production") {
    if (!secret || secret.trim().length < 32) {
      return null;
    }
    return new TextEncoder().encode(secret);
  }
  const fallbackSecret =
    secret && secret.trim().length >= 32
      ? secret
      : "trackerthings_jwt_super_secret_key_32bytes_min!";
  return new TextEncoder().encode(fallbackSecret);
}

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
  // 1. Refresh Supabase session cookies only if Supabase cookie is present
  const hasSupabaseCookie = request.cookies.getAll().some((c) => c.name.startsWith("sb-"));
  const fallbackResponse = hasSupabaseCookie
    ? createSupabaseClient(request).response
    : NextResponse.next();

  const { pathname } = request.nextUrl;
  const token = request.cookies.get("auth_session")?.value;

  let isAuthenticated = false;
  const key = getMiddlewareJwtKey();

  if (token) {
    if (key) {
      try {
        await jwtVerify(token, key, { algorithms: ["HS256"] });
        isAuthenticated = true;
      } catch {
        isAuthenticated = false;
      }
    } else {
      console.error(
        "[Middleware] JWT_SECRET is not configured or shorter than 32 characters in production. Denying access."
      );
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

  return fallbackResponse;
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
