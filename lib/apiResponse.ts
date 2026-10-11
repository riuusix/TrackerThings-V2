import { NextResponse } from "next/server";

export interface StandardApiResponse<T = any> {
  success: boolean;
  message: string;
  code: number;
  data?: T;
  error?: string;
  [key: string]: any;
}

/**
 * Standardized JSON API response for Next.js Route Handlers.
 * Ensures consistent response format across frontend (iOS SwiftUI) and web clients.
 */
export function apiResponse<T = any>(options: {
  success: boolean;
  message: string;
  code: number;
  data?: T;
  error?: string;
  extra?: Record<string, any>;
}) {
  const { success, message, code, data, error, extra = {} } = options;

  const payload: StandardApiResponse<T> = {
    success,
    message,
    code,
    ...extra,
  };

  if (data !== undefined) {
    payload.data = data;
  }

  if (!success) {
    payload.error = error || message;
  }

  return NextResponse.json(payload, { status: code });
}

/**
 * Convenience helper for successful responses (2xx).
 */
export function apiSuccess<T = any>(
  message = "Berhasil",
  data?: T,
  code = 200,
  extra?: Record<string, any>
) {
  return apiResponse<T>({
    success: true,
    message,
    code,
    data,
    extra,
  });
}

/**
 * Convenience helper for error responses (4xx / 5xx).
 */
export function apiError(
  message = "Terjadi kesalahan",
  code = 400,
  error?: string,
  extra?: Record<string, any>
) {
  return apiResponse({
    success: false,
    message,
    code,
    error: error || message,
    extra,
  });
}

