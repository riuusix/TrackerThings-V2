"use server";

import { getSupabaseServerClient } from "@/utils/supabase/server";
import { createSession, destroySession, hashPassword, verifyPassword, getSession } from "@/lib/auth";
import { redirect } from "next/navigation";

export interface ActionResult {
  success: boolean;
  message?: string;
  error?: string;
}

export async function loginAction(formData: FormData): Promise<ActionResult> {
  const username = (formData.get("username") as string)?.trim();
  const password = formData.get("password") as string;

  if (!username || !password) {
    return { success: false, error: "Username dan password wajib diisi." };
  }

  try {
    const supabase = await getSupabaseServerClient();
    const { data: user, error } = await supabase
      .from("users")
      .select("*")
      .eq("username", username)
      .maybeSingle();

    if (error) {
      console.error("Supabase user fetch error:", error);
    }

    if (!user) {
      return { success: false, error: "Username atau password salah." };
    }

    const isValid = await verifyPassword(password, user.password);
    if (!isValid) {
      return { success: false, error: "Username atau password salah." };
    }

    await createSession({
      id: user.id,
      username: user.username,
      email: user.email,
    });

    return { success: true };
  } catch (error) {
    console.error("Login error:", error);
    return { success: false, error: "Terjadi kesalahan server saat login." };
  }
}

export async function registerAction(formData: FormData): Promise<ActionResult> {
  const username = (formData.get("username") as string)?.trim();
  const fullName = (formData.get("full_name") as string)?.trim() || null;
  const email = (formData.get("email") as string)?.trim().toLowerCase();
  const phoneNumber = (formData.get("phone_number") as string)?.trim() || null;
  const password = formData.get("password") as string;

  if (!username || !email || !password) {
    return { success: false, error: "Username, email, dan password wajib diisi." };
  }

  try {
    const supabase = await getSupabaseServerClient();
    const { data: existingUser } = await supabase
      .from("users")
      .select("username, email")
      .or(`username.eq.${username},email.eq.${email}`)
      .maybeSingle();

    if (existingUser) {
      if (existingUser.username === username) {
        return { success: false, error: "Username sudah digunakan, silakan pilih yang lain." };
      }
      return { success: false, error: "Email sudah terdaftar, silakan gunakan email lain." };
    }

    const hashedPassword = await hashPassword(password);

    const { error: insertErr } = await supabase.from("users").insert([
      {
        username,
        full_name: fullName,
        email,
        phone_number: phoneNumber,
        password: hashedPassword,
      },
    ]);

    if (insertErr) {
      console.error("Supabase register error:", insertErr);
      return { success: false, error: "Gagal membuat akun di Supabase: " + insertErr.message };
    }

    return { success: true, message: "Akun berhasil dibuat! Silakan login." };
  } catch (error) {
    console.error("Register error:", error);
    return { success: false, error: "Terjadi kesalahan saat pendaftaran akun." };
  }
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}

export async function updatePasswordAction(formData: FormData): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { success: false, error: "Unauthorized" };

  const currentPassword = formData.get("current_password") as string;
  const newPassword = formData.get("new_password") as string;
  const confirmPassword = formData.get("confirm_password") as string;

  if (!currentPassword || !newPassword || !confirmPassword) {
    return { success: false, error: "Semua kolom password wajib diisi." };
  }

  if (newPassword !== confirmPassword) {
    return { success: false, error: "Konfirmasi kata sandi baru tidak cocok." };
  }

  if (newPassword.length < 6) {
    return { success: false, error: "Kata sandi baru minimal 6 karakter." };
  }

  try {
    const supabase = await getSupabaseServerClient();
    const { data: user } = await supabase
      .from("users")
      .select("*")
      .eq("id", session.userId)
      .single();

    if (!user) return { success: false, error: "Pengguna tidak ditemukan." };

    const isCurrentValid = await verifyPassword(currentPassword, user.password);
    if (!isCurrentValid) {
      return { success: false, error: "Kata sandi lama Anda salah." };
    }

    const hashedNew = await hashPassword(newPassword);

    await supabase
      .from("users")
      .update({
        password: hashedNew,
        password_changed_at: new Date().toISOString(),
      })
      .eq("id", session.userId);

    return { success: true, message: "Kata sandi berhasil diperbarui!" };
  } catch (error) {
    console.error("Update password error:", error);
    return { success: false, error: "Gagal memperbarui kata sandi." };
  }
}

export async function updateSecurityPromptAction(formData: FormData): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { success: false, error: "Unauthorized" };

  const securityPrompt = (formData.get("security_prompt") as string)?.trim();
  const securityAnswer = (formData.get("security_answer") as string)?.trim().toLowerCase();
  const currentPassword = formData.get("current_password") as string;

  if (!securityPrompt || !securityAnswer || !currentPassword) {
    return { success: false, error: "Pertanyaan, jawaban, dan kata sandi saat ini wajib diisi." };
  }

  try {
    const supabase = await getSupabaseServerClient();
    const { data: user } = await supabase
      .from("users")
      .select("*")
      .eq("id", session.userId)
      .single();

    if (!user) return { success: false, error: "Pengguna tidak ditemukan." };

    const isCurrentValid = await verifyPassword(currentPassword, user.password);
    if (!isCurrentValid) {
      return { success: false, error: "Kata sandi saat ini salah." };
    }

    const hashedAnswer = await hashPassword(securityAnswer);

    await supabase
      .from("users")
      .update({
        security_prompt: securityPrompt,
        security_answer_hash: hashedAnswer,
        profile_updated_at: new Date().toISOString(),
      })
      .eq("id", session.userId);

    return { success: true, message: "Pertanyaan keamanan berhasil disimpan!" };
  } catch (error) {
    console.error("Update security prompt error:", error);
    return { success: false, error: "Gagal menyimpan pertanyaan keamanan." };
  }
}

export async function getRecoveryPromptAction(username: string) {
  try {
    const supabase = await getSupabaseServerClient();
    const { data: user } = await supabase
      .from("users")
      .select("id, security_prompt")
      .eq("username", username)
      .maybeSingle();

    if (!user || !user.security_prompt) {
      return { success: false, error: "Pengguna tidak ditemukan atau belum mengatur pertanyaan keamanan." };
    }

    return { success: true, prompt: user.security_prompt };
  } catch (error) {
    console.error("Get recovery prompt error:", error);
    return { success: false, error: "Gagal memeriksa akun." };
  }
}

export async function recoverAccountAction(formData: FormData): Promise<ActionResult> {
  const username = (formData.get("username") as string)?.trim();
  const securityAnswer = (formData.get("security_answer") as string)?.trim().toLowerCase();
  const newPassword = formData.get("new_password") as string;

  if (!username || !securityAnswer || !newPassword) {
    return { success: false, error: "Semua kolom wajib diisi." };
  }

  if (newPassword.length < 6) {
    return { success: false, error: "Kata sandi baru minimal 6 karakter." };
  }

  try {
    const supabase = await getSupabaseServerClient();
    const { data: user } = await supabase
      .from("users")
      .select("*")
      .eq("username", username)
      .maybeSingle();

    if (!user || !user.security_answer_hash) {
      return { success: false, error: "Akun tidak ditemukan atau belum ada pertanyaan keamanan." };
    }

    const isAnswerCorrect = await verifyPassword(securityAnswer, user.security_answer_hash);
    if (!isAnswerCorrect) {
      return { success: false, error: "Jawaban keamanan salah!" };
    }

    const hashedNew = await hashPassword(newPassword);

    await supabase
      .from("users")
      .update({
        password: hashedNew,
        password_changed_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    return { success: true, message: "Kata sandi berhasil direset! Silakan login." };
  } catch (error) {
    console.error("Recover account error:", error);
    return { success: false, error: "Terjadi kesalahan saat mereset kata sandi." };
  }
}
