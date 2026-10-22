import { NextRequest } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { apiSuccess, apiError } from "@/lib/apiResponse";
import {
  getScheduleDraft,
  updateScheduleDraft,
  discardScheduleDraft,
} from "@/lib/scheduleDraftStore";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuthSession(req);
    if (!session) {
      return apiError("Sesi login telah berakhir. Silakan masuk kembali.", 401);
    }

    const { id: draftId } = await params;
    const draft = await getScheduleDraft(session.userId, draftId);

    if (!draft) {
      return apiError("Draf jadwal tidak ditemukan atau telah kedaluwarsa.", 404);
    }

    return apiSuccess("Draf jadwal berhasil dimuat.", { draft });
  } catch (err: any) {
    console.error("GET /api/jadwal/import/drafts/[id] error:", err);
    return apiError("Gagal memuat draf jadwal.", 500);
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuthSession(req);
    if (!session) {
      return apiError("Sesi login telah berakhir. Silakan masuk kembali.", 401);
    }

    const { id: draftId } = await params;
    const body = await req.json().catch(() => null);

    if (!body || !Array.isArray(body.items)) {
      return apiError("Payload pembaruan draf tidak valid. Diperlukan array items.", 400);
    }

    const updated = await updateScheduleDraft({
      userId: session.userId,
      draftId,
      items: body.items,
      expectedVersion: typeof body.expectedVersion === "number" ? body.expectedVersion : undefined,
    });

    return apiSuccess("Draf jadwal berhasil diperbarui.", { draft: updated });
  } catch (err: any) {
    if (err.code === "CONCURRENT_MODIFICATION") {
      return apiError(err.message, 409, "CONCURRENT_MODIFICATION", {
        current_version: err.currentVersion,
      });
    }
    console.error("PATCH /api/jadwal/import/drafts/[id] error:", err);
    return apiError(err.message || "Gagal memperbarui draf jadwal.", 400);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuthSession(req);
    if (!session) {
      return apiError("Sesi login telah berakhir. Silakan masuk kembali.", 401);
    }

    const { id: draftId } = await params;
    const success = await discardScheduleDraft(session.userId, draftId);

    if (!success) {
      return apiError("Draf jadwal tidak ditemukan atau telah dihapus.", 404);
    }

    return apiSuccess("Draf jadwal berhasil dihapus.", { draft_id: draftId });
  } catch (err: any) {
    console.error("DELETE /api/jadwal/import/drafts/[id] error:", err);
    return apiError("Gagal menghapus draf jadwal.", 500);
  }
}

