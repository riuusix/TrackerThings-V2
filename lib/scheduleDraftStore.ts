import { prisma } from "./prisma";
import {
  type ParsedScheduleItem,
  normalizeHari,
  normalizeTime,
  deriveMappingsFromConfirmedItems,
} from "./scheduleParser";
import {
  getUserScheduleMappings,
  saveUserScheduleMappings,
} from "./scheduleCorrections";
import { parseTimeToDate, formatTimeFromDate } from "./utils";
import { getVisionProvider, checkUserVisionRateLimit } from "./visionProvider";

export interface ScheduleDraftItem extends ParsedScheduleItem {
  id: string;
}

export interface ScheduleDraft {
  id: string;
  userId: number;
  fileName: string;
  mimeType: string;
  sourceFileBase64?: string; // Stored if <= 8MB to enable server re-analysis without re-uploading
  status: "ready" | "committed" | "discarded";
  engineUsed: string;
  processingStage: string;
  qualityStatus: string;
  items: ScheduleDraftItem[];
  warnings: string[];
  visionFallbackEligible: boolean;
  version: number; // Monotonically increasing for optimistic concurrency control
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
  expiresAt: string; // ISO 8601 (24 hours TTL)
  layout?: any;
  timing?: any;
}

export interface ScheduleDraftSummary {
  id: string;
  userId: number;
  fileName: string;
  mimeType: string;
  status: string;
  itemCount: number;
  qualityStatus: string;
  version: number;
  hasStoredDocument: boolean;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
}

const DRAFT_TTL_HOURS = 24;
const MAX_SOURCE_BASE64_SIZE = 8 * 1024 * 1024; // 8 MB

function getDraftKey(userId: number, draftId: string): string {
  return `schedule_draft_${userId}_${draftId}`;
}

function getDraftIndexKey(userId: number): string {
  return `schedule_drafts_index_${userId}`;
}

/**
 * Loads the active draft ID index for a specific user.
 */
async function loadDraftIndex(userId: number): Promise<string[]> {
  try {
    const record = await prisma.systemSetting.findUnique({
      where: { settingKey: getDraftIndexKey(userId) },
    });
    if (!record?.settingValue) return [];
    const parsed = JSON.parse(record.settingValue);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Saves the active draft ID index for a specific user.
 */
async function saveDraftIndex(userId: number, index: string[]): Promise<void> {
  const key = getDraftIndexKey(userId);
  const trimmed = index.slice(0, 50); // Keep max 50 recent drafts in index
  try {
    await prisma.systemSetting.upsert({
      where: { settingKey: key },
      update: { settingValue: JSON.stringify(trimmed) },
      create: { settingKey: key, settingValue: JSON.stringify(trimmed) },
    });
  } catch (err) {
    console.warn("[ScheduleDraftStore] Failed to save draft index:", err);
  }
}

/**
 * Creates a persistent, user-scoped schedule import draft.
 */
export async function createScheduleDraft(params: {
  userId: number;
  fileName: string;
  mimeType: string;
  items: ParsedScheduleItem[];
  warnings?: string[];
  sourceFileBase64?: string;
  engineUsed?: string;
  processingStage?: string;
  qualityStatus?: string;
  visionFallbackEligible?: boolean;
  layout?: any;
  timing?: any;
}): Promise<ScheduleDraft> {
  const {
    userId,
    fileName,
    mimeType,
    items,
    warnings = [],
    sourceFileBase64,
    engineUsed = "typescript_parser",
    processingStage = "ready",
    qualityStatus = "sufficient",
    visionFallbackEligible = false,
    layout,
    timing,
  } = params;

  const now = new Date();
  const expiresAt = new Date(now.getTime() + DRAFT_TTL_HOURS * 60 * 60 * 1000);
  const draftId = `draft_${now.getTime()}_${Math.random().toString(36).substring(2, 9)}`;

  const draftItems: ScheduleDraftItem[] = items.map((it, idx) => ({
    ...it,
    id: it.id || `item_${idx + 1}_${Math.random().toString(36).substring(2, 7)}`,
  }));

  // Store source document only if under size threshold to prevent DB bloat
  const safeBase64 =
    sourceFileBase64 && sourceFileBase64.length <= MAX_SOURCE_BASE64_SIZE
      ? sourceFileBase64
      : undefined;

  const draft: ScheduleDraft = {
    id: draftId,
    userId,
    fileName,
    mimeType,
    sourceFileBase64: safeBase64,
    status: "ready",
    engineUsed,
    processingStage,
    qualityStatus,
    items: draftItems,
    warnings,
    visionFallbackEligible,
    version: 1,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    layout,
    timing,
  };

  const key = getDraftKey(userId, draftId);
  await prisma.systemSetting.upsert({
    where: { settingKey: key },
    update: { settingValue: JSON.stringify(draft) },
    create: { settingKey: key, settingValue: JSON.stringify(draft) },
  });

  // Update index
  const index = await loadDraftIndex(userId);
  if (!index.includes(draftId)) {
    index.unshift(draftId);
    await saveDraftIndex(userId, index);
  }

  return draft;
}

/**
 * Retrieves a user-owned schedule draft by ID, validating ownership and expiration.
 */
export async function getScheduleDraft(
  userId: number,
  draftId: string
): Promise<ScheduleDraft | null> {
  if (!userId || !draftId) return null;

  try {
    const key = getDraftKey(userId, draftId);
    const record = await prisma.systemSetting.findUnique({
      where: { settingKey: key },
    });
    if (!record?.settingValue) return null;

    const draft = JSON.parse(record.settingValue) as ScheduleDraft;
    if (draft.userId !== userId) {
      console.warn(`[ScheduleDraftStore] Ownership mismatch for draft ${draftId}`);
      return null;
    }

    // Check expiration
    if (new Date(draft.expiresAt).getTime() < Date.now()) {
      await discardScheduleDraft(userId, draftId);
      return null;
    }

    return draft;
  } catch (err) {
    console.warn(`[ScheduleDraftStore] Error retrieving draft ${draftId}:`, err);
    return null;
  }
}

/**
 * Lists all active, non-expired schedule drafts for a specific user.
 */
export async function listScheduleDrafts(userId: number): Promise<ScheduleDraftSummary[]> {
  if (!userId) return [];

  const index = await loadDraftIndex(userId);
  const activeDrafts: ScheduleDraftSummary[] = [];
  const validIndex: string[] = [];

  for (const draftId of index) {
    const draft = await getScheduleDraft(userId, draftId);
    if (draft && draft.status !== "discarded") {
      validIndex.push(draftId);
      activeDrafts.push({
        id: draft.id,
        userId: draft.userId,
        fileName: draft.fileName,
        mimeType: draft.mimeType,
        status: draft.status,
        itemCount: draft.items.length,
        qualityStatus: draft.qualityStatus,
        version: draft.version,
        hasStoredDocument: Boolean(draft.sourceFileBase64),
        createdAt: draft.createdAt,
        updatedAt: draft.updatedAt,
        expiresAt: draft.expiresAt,
      });
    }
  }

  // Update index if any expired were pruned
  if (validIndex.length !== index.length) {
    await saveDraftIndex(userId, validIndex);
  }

  return activeDrafts;
}

/**
 * Updates draft items with optimistic concurrency control (`expectedVersion`).
 */
export async function updateScheduleDraft(params: {
  userId: number;
  draftId: string;
  items: ScheduleDraftItem[];
  expectedVersion?: number;
}): Promise<ScheduleDraft> {
  const { userId, draftId, items, expectedVersion } = params;
  const draft = await getScheduleDraft(userId, draftId);

  if (!draft) {
    throw new Error("Draf jadwal tidak ditemukan atau telah kedaluwarsa.");
  }

  if (draft.status === "committed") {
    throw new Error("Draf jadwal telah dikonfirmasi dan tidak dapat diedit lagi.");
  }

  // Optimistic concurrency check
  if (expectedVersion !== undefined && draft.version !== expectedVersion) {
    const err: any = new Error(
      "Draf telah diperbarui di sesi lain (konflik versi). Harap muat ulang data terbaru sebelum menyimpan perubahan."
    );
    err.code = "CONCURRENT_MODIFICATION";
    err.currentVersion = draft.version;
    throw err;
  }

  const now = new Date();
  const requiresReview = items.some((it) => it.needsReview);
  const qualityStatus = items.length === 0 ? "empty" : requiresReview ? "needs_review" : "sufficient";

  draft.items = items;
  draft.qualityStatus = qualityStatus;
  draft.version += 1;
  draft.updatedAt = now.toISOString();

  const key = getDraftKey(userId, draftId);
  await prisma.systemSetting.upsert({
    where: { settingKey: key },
    update: { settingValue: JSON.stringify(draft) },
    create: { settingKey: key, settingValue: JSON.stringify(draft) },
  });

  return draft;
}

/**
 * Validates and atomically commits a draft into `prisma.jadwal`.
 * Draft is marked `committed` and heavy source document buffers are purged.
 */
export async function commitScheduleDraft(params: {
  userId: number;
  draftId: string;
  expectedVersion?: number;
  learnCorrections?: boolean;
}): Promise<{
  count: number;
  items: any[];
  learnedMappingsTotal: number;
}> {
  const { userId, draftId, expectedVersion, learnCorrections = true } = params;
  const draft = await getScheduleDraft(userId, draftId);

  if (!draft) {
    throw new Error("Draf jadwal tidak ditemukan atau telah kedaluwarsa.");
  }

  if (draft.status === "committed") {
    throw new Error("Draf jadwal ini telah dikonfirmasi sebelumnya.");
  }

  if (expectedVersion !== undefined && draft.version !== expectedVersion) {
    const err: any = new Error(
      "Versi draf tidak cocok karena telah diperbarui di sesi lain. Harap tinjau ulang data sebelum konfirmasi."
    );
    err.code = "CONCURRENT_MODIFICATION";
    err.currentVersion = draft.version;
    throw err;
  }

  if (!draft.items || draft.items.length === 0) {
    throw new Error("Draf tidak memiliki jadwal mata kuliah untuk dikonfirmasi.");
  }

  if (draft.items.length > 50) {
    throw new Error("Batas maksimal impor adalah 50 mata kuliah per draf.");
  }

  // 1. Validate every item before transaction
  const validatedRecords: {
    userId: number;
    namaMatkul: string;
    hari: string;
    waktuMulai: Date;
    waktuSelesai: Date;
    dosen: string | null;
    kategori: string | null;
    lokasi: string | null;
    sks: number | null;
  }[] = [];

  const confirmedLearningInputs: any[] = [];

  for (let i = 0; i < draft.items.length; i++) {
    const it = draft.items[i];
    const namaMatkul = (it.namaMatkul || it.nama_matkul || "").trim();
    const rawHari = it.hari || "";
    const hari = normalizeHari(rawHari);
    const rawStart = (it.waktuMulai || it.waktu_mulai || "").trim();
    const rawEnd = (it.waktuSelesai || it.waktu_selesai || "").trim();
    const waktuMulaiStr = normalizeTime(rawStart) || rawStart;
    const waktuSelesaiStr = normalizeTime(rawEnd) || rawEnd;

    if (!namaMatkul || namaMatkul.length < 2) {
      throw new Error(`Baris #${i + 1}: Nama mata kuliah tidak valid.`);
    }

    if (!hari) {
      throw new Error(`Baris #${i + 1} (${namaMatkul}): Hari kuliah wajib dipilih dan valid.`);
    }

    const waktuMulai = parseTimeToDate(waktuMulaiStr);
    const waktuSelesai = parseTimeToDate(waktuSelesaiStr);

    if (!waktuMulai || !waktuSelesai) {
      throw new Error(`Baris #${i + 1} (${namaMatkul}): Format jam tidak valid (gunakan format HH:mm).`);
    }

    if (waktuMulaiStr >= waktuSelesaiStr) {
      throw new Error(`Baris #${i + 1} (${namaMatkul}): Waktu selesai harus lebih lambat dari waktu mulai.`);
    }

    const dosen = it.dosen && typeof it.dosen === "string" && it.dosen.trim() ? it.dosen.trim() : null;
    const kategori = it.kategori && typeof it.kategori === "string" && it.kategori.trim() ? it.kategori.trim() : "Wajib";
    const lokasi = it.lokasi && typeof it.lokasi === "string" && it.lokasi.trim() ? it.lokasi.trim() : null;

    let sks: number | null = null;
    if (it.sks !== null && it.sks !== undefined && (it.sks as any) !== "") {
      const parsedSks = typeof it.sks === "number" ? it.sks : parseInt(String(it.sks), 10);
      if (isNaN(parsedSks) || parsedSks < 1 || parsedSks > 8) {
        throw new Error(`Baris #${i + 1} (${namaMatkul}): Nilai SKS tidak wajar (harus 1 - 8 SKS).`);
      }
      sks = parsedSks;
    }

    validatedRecords.push({
      userId,
      namaMatkul,
      hari,
      waktuMulai,
      waktuSelesai,
      dosen,
      kategori,
      lokasi,
      sks,
    });

    confirmedLearningInputs.push({
      namaMatkul,
      hari,
      lokasi,
      sks,
      kodeMatkul: typeof it.kodeMatkul === "string" ? it.kodeMatkul.trim() : null,
      kelas: typeof it.kelas === "string" ? it.kelas.trim() : null,
      rawFields: it.rawFields && typeof it.rawFields === "object" ? it.rawFields : undefined,
    });
  }

  // 2. Commit all records atomically in a Prisma transaction
  const createdCourses = await prisma.$transaction(
    validatedRecords.map((data) => prisma.jadwal.create({ data }))
  );

  // 3. Learn confirmed mappings if enabled
  let learnedMappingsCount = 0;
  if (learnCorrections && confirmedLearningInputs.length > 0) {
    const existingMappings = await getUserScheduleMappings(userId);
    const updatedMappings = deriveMappingsFromConfirmedItems(confirmedLearningInputs, existingMappings);
    await saveUserScheduleMappings(userId, updatedMappings);
    learnedMappingsCount = updatedMappings.length;
  }

  // 4. Mark draft as committed and purge sourceFileBase64
  draft.status = "committed";
  delete draft.sourceFileBase64;
  draft.updatedAt = new Date().toISOString();

  const key = getDraftKey(userId, draftId);
  await prisma.systemSetting.upsert({
    where: { settingKey: key },
    update: { settingValue: JSON.stringify(draft) },
    create: { settingKey: key, settingValue: JSON.stringify(draft) },
  });

  const formatted = createdCourses.map((c) => ({
    id: c.id,
    userId: c.userId,
    user_id: c.userId,
    namaMatkul: c.namaMatkul,
    nama_matkul: c.namaMatkul,
    hari: c.hari,
    waktuMulai: formatTimeFromDate(c.waktuMulai),
    waktu_mulai: formatTimeFromDate(c.waktuMulai),
    waktuSelesai: formatTimeFromDate(c.waktuSelesai),
    waktu_selesai: formatTimeFromDate(c.waktuSelesai),
    dosen: c.dosen,
    kategori: c.kategori,
    lokasi: c.lokasi,
    sks: c.sks,
  }));

  return {
    count: createdCourses.length,
    items: formatted,
    learnedMappingsTotal: learnedMappingsCount,
  };
}

/**
 * Discards (deletes) a draft.
 */
export async function discardScheduleDraft(userId: number, draftId: string): Promise<boolean> {
  const key = getDraftKey(userId, draftId);
  try {
    await prisma.systemSetting.deleteMany({
      where: { settingKey: key },
    });
    const index = await loadDraftIndex(userId);
    const filtered = index.filter((id) => id !== draftId);
    await saveDraftIndex(userId, filtered);
    return true;
  } catch (err) {
    console.warn(`[ScheduleDraftStore] Error discarding draft ${draftId}:`, err);
    return false;
  }
}
