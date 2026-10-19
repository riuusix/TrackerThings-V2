import { createClient } from "@supabase/supabase-js";

export const MAX_AVATAR_FILE_SIZE = 2 * 1024 * 1024; // 2 MB
export const AVATAR_BUCKET_NAME = "avatars";

export interface MagicByteCheck {
  mime: string;
  ext: string;
  check: (buf: Buffer) => boolean;
}

export const SUPPORTED_AVATAR_TYPES: MagicByteCheck[] = [
  {
    mime: "image/jpeg",
    ext: "jpg",
    check: (b) => b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  },
  {
    mime: "image/png",
    ext: "png",
    check: (b) =>
      b.length >= 8 &&
      b[0] === 0x89 &&
      b[1] === 0x50 &&
      b[2] === 0x4e &&
      b[3] === 0x47 &&
      b[4] === 0x0d &&
      b[5] === 0x0a &&
      b[6] === 0x1a &&
      b[7] === 0x0a,
  },
  {
    mime: "image/webp",
    ext: "webp",
    check: (b) =>
      b.length >= 12 &&
      b.subarray(0, 4).toString("ascii") === "RIFF" &&
      b.subarray(8, 12).toString("ascii") === "WEBP",
  },
];

export interface FileValidationResult {
  valid: boolean;
  mime?: string;
  ext?: string;
  error?: string;
}

/**
 * Validates avatar image buffer against magic byte signatures, empty buffers, and maximum size.
 */
export function validateAvatarFile(buffer: Buffer, size: number): FileValidationResult {
  if (!buffer || buffer.length === 0 || size === 0) {
    return {
      valid: false,
      error: "File gambar profil tidak boleh kosong.",
    };
  }

  if (size > MAX_AVATAR_FILE_SIZE || buffer.length > MAX_AVATAR_FILE_SIZE) {
    return {
      valid: false,
      error: "Ukuran file melebihi batas maksimal 2 MB.",
    };
  }

  const detected = SUPPORTED_AVATAR_TYPES.find((t) => t.check(buffer));
  if (!detected) {
    return {
      valid: false,
      error: "Format gambar tidak didukung. Harap unggah file JPEG, PNG, atau WebP yang valid.",
    };
  }

  return {
    valid: true,
    mime: detected.mime,
    ext: detected.ext,
  };
}

/**
 * Generates an isolated, server-controlled storage path for a user's avatar.
 * Strictly prevents path traversal and cross-user overwriting.
 */
export function generateAvatarStoragePath(userId: number, ext: string): string {
  const safeUserId = Math.floor(Math.abs(userId));
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).substring(2, 8);
  const cleanExt = ext.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
  return `users/${safeUserId}/avatar-${timestamp}-${randomSuffix}.${cleanExt}`;
}

/**
 * Validates that an avatar storage path strictly belongs to the specified user
 * and does not contain path traversal elements.
 */
export function validateAvatarPathOwnership(path: string | null | undefined, userId: number): boolean {
  if (!path || typeof path !== "string") return false;
  if (path.includes("..") || path.includes("\\") || path.startsWith("/")) return false;
  const expectedPrefix = `users/${userId}/`;
  return path.startsWith(expectedPrefix);
}

/**
 * Appends a cache-busting timestamp query parameter to a public avatar URL
 * to prevent stale caching after an avatar replacement.
 */
export function sanitizeAvatarPublicUrl(rawUrl: string, timestamp?: number): string {
  if (!rawUrl) return "";
  const ts = timestamp || Date.now();
  const separator = rawUrl.includes("?") ? "&" : "?";
  return `${rawUrl}${separator}v=${ts}`;
}

// Storage Provider Interface for Mocking and Dependency Injection
export interface AvatarStorageClient {
  upload: (
    path: string,
    buffer: Buffer,
    options: { contentType: string; upsert?: boolean }
  ) => Promise<{ error: Error | null }>;
  getPublicUrl: (path: string) => { data: { publicUrl: string } };
  remove: (paths: string[]) => Promise<{ error: Error | null }>;
}

let storageClientOverride: AvatarStorageClient | null = null;

export function setStorageClientOverride(client: AvatarStorageClient | null) {
  storageClientOverride = client;
}

/**
 * Resolves the Supabase Storage client using server-only credentials.
 * Fails closed if SUPABASE_SERVICE_ROLE_KEY is not configured.
 */
export function getStorageClient(): AvatarStorageClient | null {
  if (storageClientOverride) {
    return storageClientOverride;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://uflnrwethcwkxjvsngqv.supabase.co";
  // Strict security: Server-side storage mutations require SUPABASE_SERVICE_ROLE_KEY.
  // We NEVER treat client-side anon keys as an authorization bypass on the server.
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return null;
  }

  const client = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return {
    upload: async (path, buffer, options) => {
      const res = await client.storage.from(AVATAR_BUCKET_NAME).upload(path, buffer, options);
      return { error: res.error as Error | null };
    },
    getPublicUrl: (path) => {
      return client.storage.from(AVATAR_BUCKET_NAME).getPublicUrl(path);
    },
    remove: async (paths) => {
      const res = await client.storage.from(AVATAR_BUCKET_NAME).remove(paths);
      return { error: res.error as Error | null };
    },
  };
}
