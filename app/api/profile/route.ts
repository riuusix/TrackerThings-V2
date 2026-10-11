import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/utils/supabase/server";
import { getAuthSession } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const session = await getAuthSession(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = await getSupabaseServerClient();
    const { data: user, error } = await supabase
      .from("users")
      .select("id, username, email, full_name, phone_number, profile_picture_url, security_prompt, created_at, profile_updated_at, password_changed_at")
      .eq("id", session.userId)
      .maybeSingle();

    if (error || !user) {
      return NextResponse.json({ error: "User profile tidak ditemukan" }, { status: 404 });
    }

    return NextResponse.json({
      id: user.id,
      username: user.username,
      email: user.email,
      fullName: user.full_name,
      phoneNumber: user.phone_number,
      profilePictureUrl: user.profile_picture_url,
      securityPrompt: user.security_prompt,
      createdAt: user.created_at,
      profileUpdatedAt: user.profile_updated_at,
      passwordChangedAt: user.password_changed_at,
    });
  } catch (error) {
    console.error("GET /api/profile exception:", error);
    return NextResponse.json({ error: "Gagal mengambil profil" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const session = await getAuthSession(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Payload tidak valid" }, { status: 400 });
    }

    const updateData: any = {
      profile_updated_at: new Date().toISOString(),
    };

    if (body.email) updateData.email = body.email;
    if (body.full_name !== undefined) updateData.full_name = body.full_name;
    if (body.phone_number !== undefined) updateData.phone_number = body.phone_number;
    if (body.profile_picture_url !== undefined) updateData.profile_picture_url = body.profile_picture_url;

    const supabase = await getSupabaseServerClient();
    const { error } = await supabase
      .from("users")
      .update(updateData)
      .eq("id", session.userId);

    if (error) {
      console.error("Supabase update profile error:", error);
      return NextResponse.json({ error: "Gagal memperbarui profil: " + error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: "Profil berhasil diperbarui" });
  } catch (error) {
    console.error("PUT /api/profile exception:", error);
    return NextResponse.json({ error: "Gagal memperbarui profil" }, { status: 500 });
  }
}

