import { NextRequest } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { apiSuccess, apiError } from "@/lib/apiResponse";
import {
  listScheduleDrafts,
  createScheduleDraft,
} from "@/lib/scheduleDraftStore";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    if (!session) {
      return apiError("Sesi login telah berakhir. Silakan masuk kembali.", 401);
    }

    const drafts = await listScheduleDrafts(session.userId);
    return apiSuccess("Daftar draf jadwal berhasil dimuat.", {
      drafts,
      total: drafts.length,
    });
  } catch (err: any) {
    console.error("GET /api/jadwal/import/drafts error:", err);
    return apiError("Gagal memuat daftar draf jadwal.", 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    if (!session) {
      return apiError("Sesi login telah berakhir. Silakan masuk kembali.", 401);
    }

    const body = await req.json().catch(() => null);
    if (!body || !Array.isArray(body.items)) {
      return apiError("Payload draf tidak valid. Diperlukan array items.", 400);
    }

    const draft = await createScheduleDraft({
      userId: session.userId,
      fileName: body.fileName || "jadwal_impor",
      mimeType: body.mimeType || "application/json",
      items: body.items,
      warnings: Array.isArray(body.warnings) ? body.warnings : [],
      sourceFileBase64: body.sourceFileBase64,
      engineUsed: body.engineUsed || "manual_entry",
      processingStage: body.processingStage || "ready",
      qualityStatus: body.qualityStatus || "sufficient",
      visionFallbackEligible: Boolean(body.visionFallbackEligible),
      layout: body.layout,
      timing: body.timing,
    });

    return apiSuccess("Draf jadwal berhasil disimpan.", { draft }, 201);
  } catch (err: any) {
    console.error("POST /api/jadwal/import/drafts error:", err);
    return apiError("Gagal menyimpan draf jadwal.", 500);
  }
}
