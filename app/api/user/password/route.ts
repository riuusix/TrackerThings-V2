import { NextRequest } from "next/server";
import { getSupabaseServerClient } from "@/utils/supabase/server";
import { getAuthSession, verifyPassword, hashPassword } from "@/lib/auth";
import { apiSuccess, apiError } from "@/lib/apiResponse";

export async function PUT(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    if (!session) {
      return apiError("Sesi login telah berakhir. Silakan masuk kembali.", 401);
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return apiError("Payload permintaan tidak valid.", 400);
    }

    const currentPassword = typeof body.current_password === "string" 
      ? body.current_password 
      : (typeof body.currentPassword === "string" ? body.currentPassword : "");

    const newPassword = typeof body.new_password === "string" 
      ? body.new_password 
      : (typeof body.newPassword === "string" ? body.newPassword : "");

    const confirmPassword = typeof body.confirm_password === "string"
      ? body.confirm_password
      : (typeof body.confirmPassword === "string" ? body.confirmPassword : null);

    if (!currentPassword) {
      return apiError("Kata sandi lama wajib diisi.", 400);
    }

    if (!newPassword) {
      return apiError("Kata sandi baru wajib diisi.", 400);
    }

    if (newPassword.length < 6) {
      return apiError("Kata sandi baru minimal harus 6 karakter.", 400);
    }

    if (confirmPassword !== null && newPassword !== confirmPassword) {
      return apiError("Konfirmasi kata sandi baru tidak cocok.", 400);
    }

    if (currentPassword === newPassword) {
      return apiError("Kata sandi baru tidak boleh sama dengan kata sandi lama.", 400);
    }

    const supabase = await getSupabaseServerClient();
    const { data: user, error: userErr } = await supabase
      .from("users")
      .select("id, password")
      .eq("id", session.userId)
      .maybeSingle();

    if (userErr || !user) {
      console.error("Fetch user for password change error:", userErr);
      return apiError("Pengguna tidak ditemukan.", 404);
    }

    const isCurrentValid = await verifyPassword(currentPassword, user.password);
    if (!isCurrentValid) {
      return apiError("Kata sandi lama Anda salah.", 400);
    }

    const hashedNew = await hashPassword(newPassword);

    const { error: updateErr } = await supabase
      .from("users")
      .update({
        password: hashedNew,
        password_changed_at: new Date().toISOString(),
      })
      .eq("id", session.userId);

    if (updateErr) {
      console.error("Update password DB error:", updateErr);
      return apiError("Gagal memperbarui kata sandi di database.", 500);
    }

    return apiSuccess("Kata sandi berhasil diperbarui! Silakan gunakan kata sandi baru untuk masuk berikutnya.", null, 200);
  } catch (err: any) {
    console.error("PUT /api/user/password error:", err);
    return apiError("Terjadi kesalahan internal pada server.", 500);
  }
}

