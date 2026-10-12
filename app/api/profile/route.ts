import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const session = await getAuthSession(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        fullName: true,
        phoneNumber: true,
        profilePictureUrl: true,
        securityPrompt: true,
        createdAt: true,
        profileUpdatedAt: true,
        passwordChangedAt: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User profile tidak ditemukan" }, { status: 404 });
    }

    const role = user.role || "user";

    return NextResponse.json({
      id: user.id,
      username: user.username,
      email: user.email,
      role,
      fullName: user.fullName,
      phoneNumber: user.phoneNumber,
      profilePictureUrl: user.profilePictureUrl,
      securityPrompt: user.securityPrompt,
      createdAt: user.createdAt,
      profileUpdatedAt: user.profileUpdatedAt,
      passwordChangedAt: user.passwordChangedAt,
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
      profileUpdatedAt: new Date(),
    };

    if (body.email) updateData.email = body.email.trim().toLowerCase();
    if (body.full_name !== undefined) updateData.fullName = body.full_name;
    if (body.fullName !== undefined) updateData.fullName = body.fullName;
    if (body.phone_number !== undefined) updateData.phoneNumber = body.phone_number;
    if (body.phoneNumber !== undefined) updateData.phoneNumber = body.phoneNumber;
    if (body.profile_picture_url !== undefined) updateData.profilePictureUrl = body.profile_picture_url;
    if (body.profilePictureUrl !== undefined) updateData.profilePictureUrl = body.profilePictureUrl;

    await prisma.user.update({
      where: { id: session.userId },
      data: updateData,
    });

    return NextResponse.json({ success: true, message: "Profil berhasil diperbarui" });
  } catch (error) {
    console.error("PUT /api/profile exception:", error);
    return NextResponse.json({ error: "Gagal memperbarui profil" }, { status: 500 });
  }
}

