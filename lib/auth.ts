import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers.js";
import type { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import type { UserSession } from "@/types";

const COOKIE_NAME = "auth_session";

function getJwtSecretKey(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (process.env.NODE_ENV === "production") {
    if (!secret || secret.trim().length < 32) {
      throw new Error(
        "CRITICAL_SECURITY_ERROR: JWT_SECRET environment variable is missing or shorter than 32 characters in production."
      );
    }
    return new TextEncoder().encode(secret);
  }
  const fallbackSecret =
    secret && secret.trim().length >= 32
      ? secret
      : "trackerthings_jwt_super_secret_key_32bytes_min!";
  return new TextEncoder().encode(fallbackSecret);
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function signSessionToken(payload: UserSession): Promise<string> {
  const key = getJwtSecretKey();
  const nowMs = typeof payload.tokenTimeMs === "number" ? payload.tokenTimeMs : Date.now();
  return new SignJWT({ ...payload, iatMs: nowMs })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt(Math.floor(nowMs / 1000))
    .setExpirationTime("7d")
    .sign(key);
}

export async function verifySessionToken(token: string): Promise<UserSession | null> {
  try {
    const key = getJwtSecretKey();
    const { payload } = await jwtVerify(token, key, {
      algorithms: ["HS256"],
    });

    const tokenTimeMs =
      typeof payload.iatMs === "number"
        ? payload.iatMs
        : typeof payload.iat === "number"
          ? payload.iat * 1000
          : 0;

    return {
      userId: payload.userId as number,
      username: payload.username as string,
      email: payload.email as string,
      role: (payload.role as string) || undefined,
      tokenTimeMs,
    };
  } catch {
    return null;
  }
}

export async function validateSessionUser(session: UserSession): Promise<UserSession | null> {
  if (!session || !session.userId) return null;

  try {
    const globalPrisma = (globalThis as unknown as { prisma?: any }).prisma;
    const db = globalPrisma ?? (await import("@/lib/prisma")).prisma;
    const dbUser = await db.user.findUnique({
      where: { id: session.userId },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        passwordChangedAt: true,
      },
    });

    if (!dbUser) {
      return null;
    }

    // 1. Precise password change validation (exact millisecond comparison)
    // If password was changed after the token was issued, invalidate token immediately
    if (dbUser.passwordChangedAt && typeof session.tokenTimeMs === "number") {
      const pwdChangedMs = dbUser.passwordChangedAt.getTime();
      if (session.tokenTimeMs < pwdChangedMs) {
        return null;
      }
    }

    // 2. Real-time role synchronization directly from database
    const freshRole = (dbUser.role || "user").trim().toLowerCase();

    return {
      userId: dbUser.id,
      username: dbUser.username,
      email: dbUser.email,
      role: freshRole,
      tokenTimeMs: session.tokenTimeMs,
    };
  } catch (err) {
    console.error("Database user verification failed in validateSessionUser:", err);
    return null;
  }
}

export async function createSession(user: { id: number; username: string; email: string; role?: string }) {
  const nowMs = Date.now();
  const token = await signSessionToken({
    userId: user.id,
    username: user.username,
    email: user.email,
    role: user.role || "user",
    tokenTimeMs: nowMs,
  });

  const cookieStore = cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });
}

export async function getSession(): Promise<UserSession | null> {
  const cookieStore = cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const raw = await verifySessionToken(token);
  if (!raw) {
    await destroySession();
    return null;
  }

  const validated = await validateSessionUser(raw);
  if (!validated) {
    await destroySession();
    return null;
  }

  return validated;
}

export async function getAuthSession(req?: NextRequest | Request): Promise<UserSession | null> {
  let token: string | undefined;

  // 1. Coba verifikasi dari header Authorization (Bearer <token>) untuk klien native
  if (req) {
    const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
    if (authHeader && authHeader.toLowerCase().startsWith("bearer ")) {
      token = authHeader.slice(7).trim();
    }
  }

  // 2. Fallback ke session cookie untuk klien web
  if (!token) {
    try {
      const cookieStore = cookies();
      token = cookieStore.get(COOKIE_NAME)?.value;
    } catch {
      // Abaikan jika dipanggil di luar konteks request cookies
    }
  }

  if (!token) return null;

  const raw = await verifySessionToken(token);
  if (!raw) return null;

  const validated = await validateSessionUser(raw);
  if (!validated) {
    try {
      const cookieStore = cookies();
      cookieStore.set(COOKIE_NAME, "", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 0,
        expires: new Date(0),
      });
      cookieStore.delete(COOKIE_NAME);
    } catch {
      // Abaikan jika bukan konteks cookie
    }
    return null;
  }

  return validated;
}

export async function requireAdminSession(req?: NextRequest | Request): Promise<UserSession | null> {
  const session = await getAuthSession(req);
  if (!session || !session.userId) {
    return null;
  }

  // session.role is strictly synchronized from database in validateSessionUser
  if (session.role !== "admin") {
    return null;
  }

  return session;
}

export async function destroySession() {
  const cookieStore = cookies();
  cookieStore.set(COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
    expires: new Date(0),
  });
  try {
    cookieStore.delete(COOKIE_NAME);
  } catch {
    // Abaikan jika sudah terhapus
  }
}

export { COOKIE_NAME };
