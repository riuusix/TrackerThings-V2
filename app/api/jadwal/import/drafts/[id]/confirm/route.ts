import { NextRequest } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { apiSuccess, apiError } from "@/lib/apiResponse";
import { commitScheduleDraft } from "@/lib/scheduleDraftStore";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuthSession(req);
    if (!session) {
      return apiError("Sesi login telah berakhir. Silakan masuk kembali.", 401);
    }

    const { id: draftId } = await params;
    const body = await req.json().catch(() => ({}));

    const result = await commitScheduleDraft({
      userId: session.userId,
      draftId,
      expectedVersion: typeof body.expectedVersion === "number" ? body.expectedVersion : undefined,
      learnCorrections: body.learnCorrections !== false,
    });

    return apiSuccess(
      `Berhasil mengonfirmasi dan mengimpor ${result.count} mata kuliah ke jadwal Anda.`,
      {
        count: result.count,
        items: result.items,
        learned_mappings_total: result.learnedMappingsTotal,
        draft_id: draftId,
      },
      201
    );
  } catch (err: any) {
    if (err.code === "CONCURRENT_MODIFICATION") {
      return apiError(err.message, 409, "CONCURRENT_MODIFICATION", {
        current_version: err.currentVersion,
      });
    }
    console.error("POST /api/jadwal/import/drafts/[id]/confirm error:", err);
    return apiError(err.message || "Gagal mengonfirmasi draf jadwal.", 400);
  }
}
