import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { UserSession } from "@/types";

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
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(key);
}

export async function verifySessionToken(token: string): Promise<UserSession | null> {
  try {
    const key = getJwtSecretKey();
    const { payload } = await jwtVerify(token, key, {
      algorithms: ["HS256"],
    });
    return {
      userId: payload.userId as number,
      username: payload.username as string,
      email: payload.email as string,
      role: (payload.role as string) || undefined,
    };
  } catch {
    return null;
  }
}

export async function createSession(user: { id: number; username: string; email: string; role?: string }) {
  const token = await signSessionToken({
    userId: user.id,
    username: user.username,
    email: user.email,
    role: user.role || "user",
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
  return verifySessionToken(token);
}

export async function getAuthSession(req?: NextRequest | Request): Promise<UserSession | null> {
  // 1. Coba verifikasi dari header Authorization (Bearer <token>) untuk klien native
  if (req) {
    const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
    if (authHeader && authHeader.toLowerCase().startsWith("bearer ")) {
      const token = authHeader.slice(7).trim();
      if (token) {
        const session = await verifySessionToken(token);
        if (session) return session;
      }
    }
  }

  // 2. Fallback ke session cookie untuk klien web
  try {
    const cookieStore = cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;
    if (token) {
      return verifySessionToken(token);
    }
  } catch {
    // Abaikan jika dipanggil di luar konteks request cookies
  }

  return null;
}

export async function requireAdminSession(req?: NextRequest | Request): Promise<UserSession | null> {
  const session = await getAuthSession(req);
  if (!session || !session.userId) {
    return null;
  }

  try {
    const { prisma } = await import("@/lib/prisma");
    const dbUser = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { role: true },
    });

    if (!dbUser || dbUser.role !== "admin") {
      return null;
    }

    return {
      ...session,
      role: "admin",
    };
  } catch (err) {
    console.error("Database role verification failed in requireAdminSession:", err);
    return null;
  }
}

export async function destroySession() {
  const cookieStore = cookies();
  cookieStore.delete(COOKIE_NAME);
}

export { COOKIE_NAME };
