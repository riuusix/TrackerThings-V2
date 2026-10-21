"use client";

import { useState, useRef, useEffect } from "react";
import {
  Upload,
  FileText,
  Image as ImageIcon,
  AlertTriangle,
  CheckCircle2,
  Trash2,
  Plus,
  Loader2,
  ArrowRight,
  Sparkles,
  BookMarked,
  Edit3,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Modal } from "./Modal";
import { useToast } from "./ToastProvider";
import { useRouter } from "next/navigation";

export type ScheduleFieldKey =
  | "hari"
  | "waktuMulai"
  | "waktuSelesai"
  | "kodeMatkul"
  | "namaMatkul"
  | "kelas"
  | "lokasi"
  | "sks"
  | "dosen";

export interface FieldConfidenceInfo {
  level: "confirmed" | "high" | "medium" | "low";
  source:
    | "user_mapping"
    | "header_aligned_ocr"
    | "pattern_match"
    | "ocr_normalized"
    | "fallback_inferred"
    | "missing";
  ocrConfidence?: number | null;
  needsReview: boolean;
  reviewReason?: string;
  tentativeSuggestion?: string;
}

export interface LayoutInfo {
  kind: string;
  label: string;
  hasRecognizedHeaders: boolean;
  detectedColumns: string[];
  limitationReason?: string;
}

export interface EditableScheduleItem {
  id: string;
  namaMatkul: string;
  hari: string;
  waktuMulai: string;
  waktuSelesai: string;
  dosen: string;
  kategori: string;
  lokasi: string;
  sks: number | "";
  kodeMatkul?: string;
  kelas?: string;
  rawText?: string;
  rawFields?: Record<string, string>;
  appliedCorrections?: string[];
  fieldConfidence?: Partial<Record<ScheduleFieldKey, FieldConfidenceInfo>>;
  tentativeSuggestions?: Partial<Record<ScheduleFieldKey, string>>;
  recognitionStatus?: "high_confidence" | "confirmed_assisted" | "needs_review";
  layoutKind?: string;
  needsReview?: boolean;
  warnings?: string[];
}

export interface UserScheduleMappingItem {
  id: string;
  field: "namaMatkul" | "kodeMatkul" | "lokasi" | "hari" | "kelas" | "courseByCode";
  sourceKey: string;
  targetValue: string;
  metadata?: {
    namaMatkul?: string;
    lokasi?: string;
    sks?: number;
    kelas?: string;
  };
  createdAt?: string;
  updatedAt: string;
}

interface ImportScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const DAYS = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"];

const FIELD_LABELS: Record<string, string> = {
  namaMatkul: "Nama Matkul",
  kodeMatkul: "Kode MK",
  lokasi: "Ruang",
  hari: "Hari",
  kelas: "Kelas",
  courseByCode: "Kode → Matkul",
  waktuMulai: "Jam Mulai",
  waktuSelesai: "Jam Selesai",
  sks: "SKS",
  dosen: "Dosen",
};

export function ImportScheduleModal({ isOpen, onClose, onSuccess }: ImportScheduleModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [step, setStep] = useState<"upload" | "preview">("upload");
  const [isLoading, setIsLoading] = useState(false);
  const [ocrStatus, setOcrStatus] = useState<string | null>(null);
  const [ocrProgress, setOcrProgress] = useState<number>(0);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [parsedItems, setParsedItems] = useState<EditableScheduleItem[]>([]);
  const [detectedLayout, setDetectedLayout] = useState<LayoutInfo | null>(null);
  const [learnCorrections, setLearnCorrections] = useState<boolean>(true);
  const [userMappings, setUserMappings] = useState<UserScheduleMappingItem[]>([]);
  const [showMappingsPanel, setShowMappingsPanel] = useState<boolean>(false);
  const [editingMapping, setEditingMapping] = useState<{
    id?: string;
    field: "namaMatkul" | "kodeMatkul" | "lokasi" | "hari" | "kelas" | "courseByCode";
    sourceKey: string;
    targetValue: string;
  } | null>(null);
  const [isMappingBusy, setIsMappingBusy] = useState<boolean>(false);
  const [isVisionEligible, setIsVisionEligible] = useState<boolean>(false);
  const [insufficiencyReasons, setInsufficiencyReasons] = useState<string[]>([]);
  const [showConsentModal, setShowConsentModal] = useState<boolean>(false);
  const [isVisionLoading, setIsVisionLoading] = useState<boolean>(false);
  const [activeVisionMeta, setActiveVisionMeta] = useState<{
    provider: string;
    model: string;
    duration_ms: number;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const { showSuccess } = useToast();
  const router = useRouter();

  const fetchUserMappings = async () => {
    try {
      const res = await fetch("/api/jadwal/import/mappings");
      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json.mappings)) {
          setUserMappings(json.mappings);
        }
      }
    } catch {
      // Ignore background fetch error
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchUserMappings();
    }
  }, [isOpen]);

  const resetState = () => {
    setFile(null);
    setStep("upload");
    setIsLoading(false);
    setOcrStatus(null);
    setOcrProgress(0);
    setIsSaving(false);
    setErrorMsg(null);
    setIsVisionEligible(false);
    setParsedItems([]);
    setDetectedLayout(null);
    setShowMappingsPanel(false);
    setEditingMapping(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleClose = () => {
    if (isLoading || isSaving) return;
    resetState();
    onClose();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMsg(null);
    setIsVisionEligible(false);
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      if (selected.size > 10 * 1024 * 1024) {
        setErrorMsg("Ukuran file maksimal adalah 10 MB.");
        return;
      }
      setFile(selected);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsVisionEligible(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const selected = e.dataTransfer.files[0];
      if (selected.size > 10 * 1024 * 1024) {
        setErrorMsg("Ukuran file maksimal adalah 10 MB.");
        return;
      }
      setFile(selected);
    }
  };

  /**
   * Compresses oversized user schedule images in the browser before sending to Vision AI or OCR.
   * Downscales images exceeding 1920px max dimension and encodes to JPEG (0.85 quality),
   * reducing multi-megabyte camera photos by 90-95% while keeping schedule text razor-sharp.
   */
  const compressImageForVision = async (inputFile: File): Promise<File> => {
    if (!inputFile.type.startsWith("image/") || inputFile.type === "image/svg+xml") {
      return inputFile;
    }
    if (inputFile.size <= 400 * 1024) {
      return inputFile;
    }

    return new Promise((resolve) => {
      try {
        const img = new Image();
        const objectUrl = URL.createObjectURL(inputFile);
        img.onload = () => {
          URL.revokeObjectURL(objectUrl);
          const { width, height } = img;
          const maxDim = 1920;
          let targetWidth = width;
          let targetHeight = height;

          if (width > maxDim || height > maxDim) {
            if (width > height) {
              targetWidth = maxDim;
              targetHeight = Math.round((height * maxDim) / width);
            } else {
              targetHeight = maxDim;
              targetWidth = Math.round((width * maxDim) / height);
            }
          }

          const canvas = document.createElement("canvas");
          canvas.width = targetWidth;
          canvas.height = targetHeight;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            resolve(inputFile);
            return;
          }

          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, targetWidth, targetHeight);
          ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

          canvas.toBlob(
            (blob) => {
              if (!blob || blob.size >= inputFile.size) {
                resolve(inputFile);
                return;
              }
              const compressedFile = new File([blob], inputFile.name.replace(/\.[^.]+$/, ".jpg"), {
                type: "image/jpeg",
                lastModified: Date.now(),
              });
              resolve(compressedFile);
            },
            "image/jpeg",
            0.85
          );
        };
        img.onerror = () => {
          URL.revokeObjectURL(objectUrl);
          resolve(inputFile);
        };
        img.src = objectUrl;
      } catch {
        resolve(inputFile);
      }
    });
  };

  const handleUploadAndPreview = async () => {
    if (!file) {
      setErrorMsg("Pilih file jadwal kuliah terlebih dahulu.");
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);
    setOcrProgress(0);

    try {
      const isImage = file.type.startsWith("image/");
      const fileToProcess = isImage ? await compressImageForVision(file) : file;
      const formData = new FormData();

      if (isImage) {
        setOcrStatus("Menyiapkan pemindai tabel & teks di peramban...");
        try {
          const { createWorker } = await import("tesseract.js");
          const worker = await createWorker(["ind", "eng"], 1, {
            logger: (m: any) => {
              if (m.status === "recognizing text") {
                const prog = Math.round((m.progress || 0) * 100);
                setOcrStatus(`Mengenali struktur tabel & teks jadwal... ${prog}%`);
                setOcrProgress(prog);
              } else if (m.status === "loading tesseract core") {
                setOcrStatus("Memuat mesin OCR...");
              } else if (m.status === "loading language traineddata") {
                setOcrStatus("Memuat kamus bahasa Indonesia & Inggris...");
              }
            },
          });

          setOcrStatus("Memindai kolom tabel jadwal kuliah...");
          // Request text, blocks, and TSV so spatial word bounding boxes (x0, y0, x1, y1) are preserved!
          const res = await worker.recognize(fileToProcess, {}, { text: true, blocks: true, tsv: true });
          await worker.terminate();

          const textOut = res?.data?.text?.trim() || "";
          const tsvOut = res?.data?.tsv?.trim() || "";

          if (textOut.length > 0 || tsvOut.length > 0) {
            if (textOut) formData.append("rawText", textOut);
            if (tsvOut) formData.append("ocrTsv", tsvOut);
            formData.append("fileName", fileToProcess.name);
          } else {
            formData.append("file", fileToProcess);
          }
        } catch (clientOcrErr) {
          console.warn("Browser OCR gagal, beralih ke ekstraksi server:", clientOcrErr);
          formData.append("file", fileToProcess);
        }
      } else {
        setOcrStatus("Mengekstrak dokumen PDF...");
        formData.append("file", fileToProcess);
      }

      setOcrStatus("Memetakan kolom jadwal, tingkat keyakinan, dan cek bentrok...");
      const res = await fetch("/api/jadwal/import/preview", {
        method: "POST",
        body: formData,
      });

      const json = await res.json();

      if (!res.ok) {
        if (json.extra?.vision_fallback_eligible || json.vision_fallback_eligible || (isImage && file)) {
          setIsVisionEligible(true);
        }
        throw new Error(json.message || "Gagal mengekstrak dokumen.");
      }

      if (Array.isArray(json.data?.user_mappings)) {
        setUserMappings(json.data.user_mappings);
      }

      if (json.data?.layout && typeof json.data.layout === "object") {
        setDetectedLayout(json.data.layout);
      } else {
        setDetectedLayout(null);
      }

      setIsVisionEligible(Boolean(json.data?.vision_fallback_eligible));
      setInsufficiencyReasons(Array.isArray(json.data?.insufficiency_reasons) ? json.data.insufficiency_reasons : []);
      setActiveVisionMeta(null);

      // Preserve exact extracted fields without inventing silent fake values
      const items: EditableScheduleItem[] = (json.data?.items || []).map((it: any) => ({
        id: it.id || `item_${Math.random()}`,
        namaMatkul: typeof it.namaMatkul === "string" ? it.namaMatkul : "",
        hari: typeof it.hari === "string" ? it.hari : "",
        waktuMulai: typeof it.waktuMulai === "string" ? it.waktuMulai : "",
        waktuSelesai: typeof it.waktuSelesai === "string" ? it.waktuSelesai : "",
        dosen: typeof it.dosen === "string" ? it.dosen : "",
        kategori: typeof it.kategori === "string" && it.kategori ? it.kategori : "Wajib",
        lokasi: typeof it.lokasi === "string" ? it.lokasi : "",
        sks: typeof it.sks === "number" && !isNaN(it.sks) ? it.sks : "",
        kodeMatkul: typeof it.kodeMatkul === "string" ? it.kodeMatkul : "",
        kelas: typeof it.kelas === "string" ? it.kelas : "",
        rawText: typeof it.rawText === "string" ? it.rawText : undefined,
        rawFields: it.rawFields && typeof it.rawFields === "object" ? it.rawFields : undefined,
        appliedCorrections: Array.isArray(it.appliedCorrections) ? it.appliedCorrections : [],
        fieldConfidence:
          it.fieldConfidence && typeof it.fieldConfidence === "object"
            ? it.fieldConfidence
            : undefined,
        tentativeSuggestions:
          it.tentativeSuggestions && typeof it.tentativeSuggestions === "object"
            ? it.tentativeSuggestions
            : undefined,
        recognitionStatus: it.recognitionStatus || (it.needsReview ? "needs_review" : "high_confidence"),
        layoutKind: it.layoutKind,
        needsReview: Boolean(it.needsReview),
        warnings: Array.isArray(it.warnings) ? it.warnings : [],
      }));

      setParsedItems(items);
      setStep("preview");
    } catch (err: any) {
      setErrorMsg(err.message || "Terjadi kesalahan saat memproses file.");
    } finally {
      setIsLoading(false);
      setOcrStatus(null);
      setOcrProgress(0);
    }
  };

  const handleExecuteVisionFallback = async () => {
    if (!file) {
      setErrorMsg("File dokumen tidak ditemukan untuk fallback vision.");
      return;
    }

    setIsVisionLoading(true);
    setShowConsentModal(false);
    setErrorMsg(null);

    try {
      // Optimize image payload before network upload (JPEG 0.85, max 1920px) to minimize transmission & Gemini latency
      const fileToSend = await compressImageForVision(file);

      const formData = new FormData();
      formData.append("file", fileToSend);
      formData.append("userConsent", "true");
      formData.append("localItems", JSON.stringify(parsedItems));

      const res = await fetch("/api/jadwal/import/vision", {
        method: "POST",
        body: formData,
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.message || "Gagal memproses gambar melalui vision provider.");
      }

      if (json.data?.layout && typeof json.data.layout === "object") {
        setDetectedLayout(json.data.layout);
      }
      if (Array.isArray(json.data?.user_mappings)) {
        setUserMappings(json.data.user_mappings);
      }
      if (json.data?.vision_meta) {
        setActiveVisionMeta(json.data.vision_meta);
      }

      const mergedItems: EditableScheduleItem[] = (json.data?.items || []).map((it: any) => ({
        id: it.id || `item_${Math.random()}`,
        namaMatkul: typeof it.namaMatkul === "string" ? it.namaMatkul : "",
        hari: typeof it.hari === "string" ? it.hari : "",
        waktuMulai: typeof it.waktuMulai === "string" ? it.waktuMulai : "",
        waktuSelesai: typeof it.waktuSelesai === "string" ? it.waktuSelesai : "",
        dosen: typeof it.dosen === "string" ? it.dosen : "",
        kategori: typeof it.kategori === "string" && it.kategori ? it.kategori : "Wajib",
        lokasi: typeof it.lokasi === "string" ? it.lokasi : "",
        sks: typeof it.sks === "number" && !isNaN(it.sks) ? it.sks : "",
        kodeMatkul: typeof it.kodeMatkul === "string" ? it.kodeMatkul : "",
        kelas: typeof it.kelas === "string" ? it.kelas : "",
        rawText: typeof it.rawText === "string" ? it.rawText : undefined,
        rawFields: it.rawFields && typeof it.rawFields === "object" ? it.rawFields : undefined,
        appliedCorrections: Array.isArray(it.appliedCorrections) ? it.appliedCorrections : [],
        fieldConfidence:
          it.fieldConfidence && typeof it.fieldConfidence === "object"
            ? it.fieldConfidence
            : undefined,
        tentativeSuggestions:
          it.tentativeSuggestions && typeof it.tentativeSuggestions === "object"
            ? it.tentativeSuggestions
            : undefined,
        recognitionStatus: it.recognitionStatus || (it.needsReview ? "needs_review" : "high_confidence"),
        layoutKind: it.layoutKind,
        needsReview: Boolean(it.needsReview),
        warnings: Array.isArray(it.warnings) ? it.warnings : [],
      }));

      setParsedItems(mergedItems);
      setIsVisionEligible(false); // Vision has been executed for this upload
      showSuccess(`Pengenalan cerdas Vision AI selesai (${mergedItems.length} matkul dipadukan).`);
    } catch (err: any) {
      setErrorMsg(err?.message || "Gagal memproses gambar via Vision AI. Anda tetap dapat melanjutkan pengeditan manual.");
    } finally {
      setIsVisionLoading(false);
    }
  };

  const evaluateItemReviewState = (
    item: EditableScheduleItem,
    editedField?: ScheduleFieldKey
  ): EditableScheduleItem => {
    const nextFieldConf: Partial<Record<ScheduleFieldKey, FieldConfidenceInfo>> = {
      ...(item.fieldConfidence || {}),
    };
    const nextTentative = { ...(item.tentativeSuggestions || {}) };

    if (editedField) {
      delete nextTentative[editedField];
      nextFieldConf[editedField] = {
        level: "confirmed",
        source: "user_mapping",
        needsReview: false,
      };
    }

    const newWarnings: string[] = [];
    if (!item.namaMatkul || item.namaMatkul.trim().length < 2) {
      newWarnings.push("Nama mata kuliah belum terdeteksi dengan jelas");
      nextFieldConf.namaMatkul = {
        level: "low",
        source: "missing",
        needsReview: true,
        reviewReason: "Nama mata kuliah wajib diisi (minimal 2 karakter).",
      };
    }
    if (!item.hari || !DAYS.includes(item.hari)) {
      newWarnings.push("Hari kuliah wajib dipilih");
      nextFieldConf.hari = {
        level: "low",
        source: "missing",
        needsReview: true,
        reviewReason: "Silakan pilih hari kuliah yang valid.",
      };
    }
    if (!item.waktuMulai || !item.waktuSelesai) {
      newWarnings.push("Jam mulai dan jam selesai wajib diisi");
      if (!item.waktuMulai) {
        nextFieldConf.waktuMulai = {
          level: "low",
          source: "missing",
          needsReview: true,
          reviewReason: "Jam mulai belum diisi.",
        };
      }
      if (!item.waktuSelesai) {
        nextFieldConf.waktuSelesai = {
          level: "low",
          source: "missing",
          needsReview: true,
          reviewReason: "Jam selesai belum diisi.",
        };
      }
    } else if (item.waktuMulai >= item.waktuSelesai) {
      newWarnings.push("Waktu selesai harus lebih lambat dari waktu mulai");
      nextFieldConf.waktuSelesai = {
        level: "low",
        source: "pattern_match",
        needsReview: true,
        reviewReason: "Jam selesai harus lebih lambat dari jam mulai.",
      };
    } else if (editedField === "waktuMulai" || editedField === "waktuSelesai") {
      nextFieldConf.waktuMulai = { level: "confirmed", source: "user_mapping", needsReview: false };
      nextFieldConf.waktuSelesai = { level: "confirmed", source: "user_mapping", needsReview: false };
    }

    if (item.sks === "") {
      newWarnings.push("Jumlah SKS wajib diisi");
      nextFieldConf.sks = {
        level: "low",
        source: "missing",
        needsReview: true,
        reviewReason: "Jumlah SKS wajib diisi (1–8).",
      };
    } else if (Number(item.sks) < 1 || Number(item.sks) > 8) {
      newWarnings.push("Nilai SKS harus di antara 1–8");
      nextFieldConf.sks = {
        level: "low",
        source: "pattern_match",
        needsReview: true,
        reviewReason: "Nilai SKS berada di luar rentang wajar (1–8).",
      };
    }

    // Preserve DB conflict warnings from initial preview
    const conflictWarnings = (item.warnings || []).filter(
      (w) => w.includes("Bentrok") || w.includes("duplikat")
    );
    const anyFieldNeedsReview = Object.values(nextFieldConf).some((fc) => fc?.needsReview);
    const mergedWarnings = [...newWarnings, ...conflictWarnings];
    const needsReview = mergedWarnings.length > 0 || anyFieldNeedsReview;

    return {
      ...item,
      fieldConfidence: nextFieldConf,
      tentativeSuggestions: Object.keys(nextTentative).length > 0 ? nextTentative : undefined,
      warnings: mergedWarnings,
      needsReview,
      recognitionStatus: needsReview ? "needs_review" : "confirmed_assisted",
    };
  };

  const handleItemChange = (id: string, field: keyof EditableScheduleItem, value: any) => {
    setParsedItems((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const updated = { ...item, [field]: value };
          return evaluateItemReviewState(updated, field as ScheduleFieldKey);
        }
        return item;
      })
    );
  };

  const handleApplyTentativeSuggestion = (
    id: string,
    field: ScheduleFieldKey,
    suggestionValue: string
  ) => {
    setParsedItems((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const updated: EditableScheduleItem = {
            ...item,
            [field]: suggestionValue,
            appliedCorrections: [
              ...(item.appliedCorrections || []),
              `Saran kamus diterapkan (${FIELD_LABELS[field] || field}): '${suggestionValue}'`,
            ],
          };
          return evaluateItemReviewState(updated, field);
        }
        return item;
      })
    );
  };

  const isFieldUncertain = (item: EditableScheduleItem, field: ScheduleFieldKey): boolean => {
    return Boolean(item.fieldConfidence?.[field]?.needsReview);
  };

  const getFieldReviewReasons = (item: EditableScheduleItem): { field: ScheduleFieldKey; reason: string }[] => {
    if (!item.fieldConfidence) return [];
    const list: { field: ScheduleFieldKey; reason: string }[] = [];
    for (const [k, info] of Object.entries(item.fieldConfidence)) {
      if (info && info.needsReview && info.reviewReason) {
        list.push({ field: k as ScheduleFieldKey, reason: info.reviewReason });
      }
    }
    return list;
  };

  const handleDeleteItem = (id: string) => {
    setParsedItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleAddNewItem = () => {
    const newItem: EditableScheduleItem = {
      id: `manual_${Date.now()}`,
      namaMatkul: "",
      hari: "Senin",
      waktuMulai: "08:00",
      waktuSelesai: "09:40",
      dosen: "",
      kategori: "Wajib",
      lokasi: "",
      sks: 2,
      kodeMatkul: "",
      kelas: "",
      fieldConfidence: {
        namaMatkul: {
          level: "low",
          source: "missing",
          needsReview: true,
          reviewReason: "Nama mata kuliah wajib diisi.",
        },
      },
      recognitionStatus: "needs_review",
      needsReview: true,
      warnings: ["Nama mata kuliah belum diisi"],
    };
    setParsedItems((prev) => [...prev, newItem]);
  };

  const handleSaveMapping = async () => {
    if (!editingMapping) return;
    if (!editingMapping.sourceKey.trim() || !editingMapping.targetValue.trim()) {
      setErrorMsg("Teks OCR asal dan hasil koreksi tidak boleh kosong.");
      return;
    }

    setIsMappingBusy(true);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/jadwal/import/mappings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingMapping),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Gagal menyimpan koreksi.");
      }
      setUserMappings(json.mappings || []);
      setEditingMapping(null);
    } catch (err: any) {
      setErrorMsg(err.message || "Gagal menyimpan koreksi.");
    } finally {
      setIsMappingBusy(false);
    }
  };

  const handleDeleteMapping = async (mappingId: string) => {
    setIsMappingBusy(true);
    try {
      const res = await fetch(`/api/jadwal/import/mappings?id=${encodeURIComponent(mappingId)}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (res.ok && Array.isArray(json.mappings)) {
        setUserMappings(json.mappings);
      }
    } catch {
      // Ignore error
    } finally {
      setIsMappingBusy(false);
    }
  };

  const handleConfirmSave = async () => {
    if (parsedItems.length === 0) {
      setErrorMsg("Daftar jadwal kosong.");
      return;
    }

    for (let i = 0; i < parsedItems.length; i++) {
      const it = parsedItems[i];
      if (!it.namaMatkul || !it.namaMatkul.trim() || it.namaMatkul.trim().length < 2) {
        setErrorMsg(`Baris #${i + 1}: Nama mata kuliah wajib diisi.`);
        return;
      }
      if (!it.hari || !DAYS.includes(it.hari)) {
        setErrorMsg(`Baris #${i + 1} (${it.namaMatkul}): Hari kuliah wajib dipilih.`);
        return;
      }
      if (!it.waktuMulai || !it.waktuSelesai) {
        setErrorMsg(`Baris #${i + 1} (${it.namaMatkul}): Jam mulai dan jam selesai wajib diisi.`);
        return;
      }
      if (it.waktuMulai >= it.waktuSelesai) {
        setErrorMsg(
          `Baris #${i + 1} (${it.namaMatkul}): Waktu selesai harus lebih lambat dari waktu mulai.`
        );
        return;
      }
      if (it.sks === "" || Number(it.sks) < 1 || Number(it.sks) > 8) {
        setErrorMsg(`Baris #${i + 1} (${it.namaMatkul}): SKS harus bernilai antara 1 hingga 8.`);
        return;
      }
    }

    setIsSaving(true);
    setErrorMsg(null);

    try {
      const payloadItems = parsedItems.map((it) => ({
        ...it,
        sks: it.sks === "" ? null : Number(it.sks),
      }));

      const res = await fetch("/api/jadwal/import/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: payloadItems,
          learnCorrections,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.message || "Gagal menyimpan jadwal.");
      }

      showSuccess(`Berhasil mengimpor ${parsedItems.length} mata kuliah ke jadwal Anda!`);
      handleClose();
      router.refresh();
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setErrorMsg(err.message || "Gagal mengonfirmasi impor jadwal.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      maxWidth="max-w-4xl lg:max-w-5xl"
      title={
        step === "upload"
          ? "Impor Jadwal Kuliah Cerdas (Foto / PDF)"
          : `Tinjau Hasil Ekstraksi (${parsedItems.length} Matkul)`
      }
      description={
        step === "upload"
          ? "Mendukung tabel KRS kampus (Hari, Mulai, Akhir, Ruang, Kode MK, Kls, Nama MK, SKS) dari screenshot maupun dokumen PDF."
          : "Periksa hasil pembacaan sebelum disimpan. Hanya kolom yang belum pasti ditandai kuning beserta alasan peninjauannya."
      }
    >
      <div className="flex-1 min-h-0 flex flex-col space-y-4">
        {step === "upload" ? (
          <div className="flex-1 min-h-0 flex flex-col space-y-4 overflow-y-auto pr-1">
            {/* Unified Mutually Exclusive Banner in Upload Step */}
            {showConsentModal ? (
              <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border-2 border-purple-400 dark:border-purple-600 shadow-lg text-xs space-y-3 shrink-0">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0 mt-0.5">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div className="space-y-1 flex-1">
                    <p className="font-bold text-slate-800 dark:text-slate-100 text-sm">
                      Konfirmasi Persetujuan Pemrosesan Vision Eksternal
                    </p>
                    <p className="text-slate-600 dark:text-slate-300 text-[11px] sm:text-xs leading-relaxed">
                      Dokumen jadwal Anda akan dikirimkan ke server untuk diproses melalui model visual (Google Gemini API). Dokumen hanya diproses sementara untuk mengekstrak teks jadwal dan tunduk pada ketentuan privasi.
                    </p>
                    <p className="text-slate-500 italic text-[11px]">
                      Hasil vision akan dipadukan dengan bukti ekstraksi lokal dan tidak akan disimpan ke database sebelum Anda meninjau dan mengonfirmasi secara manual.
                    </p>
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setShowConsentModal(false)}
                    className="px-3.5 py-1.5 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    onClick={handleExecuteVisionFallback}
                    className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold transition-all shadow-xs flex items-center gap-1.5"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Saya Setuju & Mulai Pemindaian Vision</span>
                  </button>
                </div>
              </div>
            ) : isVisionLoading ? (
              <div className="p-4 rounded-2xl bg-purple-50/70 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800/50 flex flex-row items-center gap-3 text-xs text-purple-800 dark:text-purple-200 font-semibold shrink-0">
                <Loader2 className="w-4 h-4 animate-spin text-purple-600 dark:text-purple-400 shrink-0" />
                <span>Memproses dokumen melalui Vision Model & memadukan dengan bukti ekstraksi lokal...</span>
              </div>
            ) : errorMsg ? (
              isVisionEligible && file && !isVisionLoading ? (
                <div className="p-3.5 sm:p-4 rounded-2xl bg-purple-50/90 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800/60 flex flex-row items-center justify-between gap-3.5 text-xs shrink-0">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
                      <Sparkles className="w-4 h-4 sm:w-5 sm:h-5" />
                    </div>
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <p className="font-bold text-purple-900 dark:text-purple-200 text-xs sm:text-sm">
                        {file.type === "application/pdf"
                          ? "Ekstraksi PDF Kurang Maksimal"
                          : "OCR Gambar Mengalami Kendala"}
                      </p>
                      <p className="text-purple-700/90 dark:text-purple-300/80 text-[11px] sm:text-xs truncate sm:line-clamp-2">
                        {errorMsg} Anda dapat melanjutkan dengan bantuan Gemini Vision AI.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => setErrorMsg(null)}
                      className="px-3 py-2 rounded-xl text-slate-500 hover:bg-purple-100 dark:hover:bg-purple-900/30 text-xs font-semibold transition-colors"
                    >
                      Tutup
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowConsentModal(true)}
                      className="px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold transition-all shadow-xs flex items-center gap-1.5 text-xs shrink-0"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Coba Vision AI</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-3.5 sm:p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/50 flex flex-row items-center justify-between gap-3.5 text-xs shrink-0">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-rose-100 dark:bg-rose-900/50 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                      <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5" />
                    </div>
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <p className="font-bold text-rose-900 dark:text-rose-200 text-xs sm:text-sm">
                        Gagal Memproses Dokumen
                      </p>
                      <p className="text-rose-700 dark:text-rose-300 text-[11px] sm:text-xs">
                        {errorMsg}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setErrorMsg(null)}
                    className="shrink-0 px-3 py-1.5 rounded-xl bg-rose-100 dark:bg-rose-900/50 hover:bg-rose-200 dark:hover:bg-rose-800/50 text-rose-800 dark:text-rose-200 font-semibold transition-colors"
                  >
                    Tutup
                  </button>
                </div>
              )
            ) : null}

        {/* Saved User Corrections Manager Toggle */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50 overflow-hidden">
          <button
            type="button"
            onClick={() => setShowMappingsPanel((prev) => !prev)}
            className="w-full px-3.5 py-2.5 flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100/70 dark:hover:bg-slate-800/50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <BookMarked className="w-3.5 h-3.5 text-accent" />
              <span>Kamus Koreksi Otomatis Anda ({userMappings.length})</span>
            </div>
            {showMappingsPanel ? (
              <ChevronUp className="w-4 h-4 text-slate-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-slate-400" />
            )}
          </button>

          {showMappingsPanel && (
            <div className="p-3.5 border-t border-slate-200 dark:border-slate-800 space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Koreksi yang Anda konfirmasi hanya berlaku untuk akun Anda sendiri dan dapat dihapus kapan saja.
                </p>
                <button
                  type="button"
                  onClick={() =>
                    setEditingMapping({
                      field: "namaMatkul",
                      sourceKey: "",
                      targetValue: "",
                    })
                  }
                  className="shrink-0 px-2.5 py-1 rounded-lg bg-accent text-accent-text font-semibold hover:bg-accent-hover transition-colors flex items-center gap-1 shadow-xs"
                >
                  <Plus className="w-3 h-3" />
                  <span>Tambah</span>
                </button>
              </div>

              {editingMapping && (
                <div className="p-2.5 rounded-lg bg-surface border border-accent/40 space-y-2">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <select
                      value={editingMapping.field}
                      onChange={(e) =>
                        setEditingMapping({
                          ...editingMapping,
                          field: e.target.value as any,
                        })
                      }
                      className="bg-slate-100 dark:bg-slate-800 rounded-lg px-2 py-1.5 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 font-medium"
                    >
                      <option value="namaMatkul">Nama Mata Kuliah</option>
                      <option value="kodeMatkul">Kode MK</option>
                      <option value="lokasi">Ruangan</option>
                      <option value="kelas">Kelas</option>
                      <option value="hari">Hari</option>
                      <option value="courseByCode">Kode MK → Nama Matkul</option>
                    </select>
                    <input
                      type="text"
                      placeholder="Teks terbaca OCR (mis. 1F253418)"
                      value={editingMapping.sourceKey}
                      onChange={(e) =>
                        setEditingMapping({ ...editingMapping, sourceKey: e.target.value })
                      }
                      className="bg-slate-100 dark:bg-slate-800 rounded-lg px-2 py-1.5 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700"
                    />
                    <input
                      type="text"
                      placeholder="Koreksi benar (mis. IF253418)"
                      value={editingMapping.targetValue}
                      onChange={(e) =>
                        setEditingMapping({ ...editingMapping, targetValue: e.target.value })
                      }
                      className="bg-slate-100 dark:bg-slate-800 rounded-lg px-2 py-1.5 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingMapping(null)}
                      className="px-2.5 py-1 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      Batal
                    </button>
                    <button
                      type="button"
                      disabled={isMappingBusy}
                      onClick={handleSaveMapping}
                      className="px-3 py-1 rounded-lg bg-emerald-600 text-white font-semibold hover:bg-emerald-700 disabled:opacity-50"
                    >
                      Simpan Koreksi
                    </button>
                  </div>
                </div>
              )}

              {userMappings.length === 0 ? (
                <p className="text-[11px] text-slate-400 italic py-1">
                  Belum ada koreksi tersimpan. Koreksi akan otomatis dipelajari saat Anda memperbaiki & menyimpan hasil impor.
                </p>
              ) : (
                <div className="max-h-36 overflow-y-auto divide-y divide-slate-200/70 dark:divide-slate-800">
                  {userMappings.map((m) => (
                    <div key={m.id} className="py-1.5 flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <span className="inline-block px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-[10px] font-bold text-slate-600 dark:text-slate-300 mr-1.5">
                          {FIELD_LABELS[m.field] || m.field}
                        </span>
                        <span className="text-slate-500 line-through mr-1.5">{m.sourceKey}</span>
                        <span className="text-slate-400 mr-1.5">→</span>
                        <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                          {m.targetValue}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() =>
                            setEditingMapping({
                              id: m.id,
                              field: m.field,
                              sourceKey: m.sourceKey,
                              targetValue: m.targetValue,
                            })
                          }
                          className="p-1 text-slate-400 hover:text-accent"
                          title="Edit koreksi"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={isMappingBusy}
                          onClick={() => handleDeleteMapping(m.id)}
                          className="p-1 text-slate-400 hover:text-rose-600"
                          title="Hapus koreksi"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

          {/* Dropzone */}
          <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-accent rounded-2xl p-6 sm:p-8 text-center cursor-pointer transition-all bg-slate-50/50 dark:bg-slate-900/40 hover:bg-accent-muted/20 group"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf, image/png, image/jpeg, image/jpg, image/webp"
                className="hidden"
                onChange={handleFileChange}
              />

              <div className="w-14 h-14 mx-auto mb-3.5 rounded-2xl bg-accent-muted text-accent flex items-center justify-center group-hover:scale-105 transition-transform shadow-xs">
                {file ? (
                  file.type === "application/pdf" ? (
                    <FileText className="w-7 h-7" />
                  ) : (
                    <ImageIcon className="w-7 h-7" />
                  )
                ) : (
                  <Upload className="w-7 h-7" />
                )}
              </div>

              {file ? (
                <div>
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{file.name}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {(file.size / 1024 / 1024).toFixed(2)} MB • Klik untuk mengganti file
                  </p>
                </div>
              ) : (
                <div>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                    Tarik file ke sini atau{" "}
                    <span className="text-accent font-bold">
                      pilih dari perangkat
                    </span>
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Mendukung PDF KRS resmi, screenshot tabel jadwal kampus (PNG, JPG, WebP) maks. 10MB
                  </p>
                </div>
              )}
            </div>

            {/* Progress indicator during loading */}
            {isLoading && (
              <div className="p-4 rounded-xl bg-accent-muted/50 border border-line-subtle space-y-2">
                <div className="flex items-center gap-2.5 text-xs font-semibold text-accent">
                  <Loader2 className="w-4 h-4 animate-spin shrink-0 text-accent" />
                  <span>{ocrStatus || "Memproses dokumen jadwal..."}</span>
                </div>
                {ocrProgress > 0 && ocrProgress < 100 && (
                  <div className="w-full bg-accent-muted h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-accent h-full rounded-full transition-all duration-300"
                      style={{ width: `${ocrProgress}%` }}
                    />
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Batal
              </button>

              <button
                type="button"
                disabled={!file || isLoading}
                onClick={handleUploadAndPreview}
                className="px-5 py-2.5 rounded-xl text-xs font-bold text-accent-text bg-accent hover:bg-accent-hover disabled:opacity-50 transition-all shadow-xs flex items-center gap-2"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Mengekstrak Dokumen...</span>
                  </>
                ) : (
                  <>
                    <span>Tinjau Ekstraksi</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </div>
          </div>
        ) : (
          /* Step 2: Interactive Editable Preview Table */
          <div className="flex-1 min-h-0 flex flex-col space-y-3">
            {/* Dedicated Single Banner Slot */}
            {errorMsg ? (
              isVisionEligible && file && !isVisionLoading ? (
                <div className="p-3.5 sm:p-4 rounded-2xl bg-purple-50/90 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800/60 flex flex-col md:flex-row md:items-center justify-between gap-3.5 text-xs shrink-0">
                  <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
                    <div className="w-8 h-8 rounded-xl bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <p className="font-bold text-purple-900 dark:text-purple-200 text-xs sm:text-sm">
                        Kendala Ekstraksi Dokumen
                      </p>
                      <p className="text-purple-700/90 dark:text-purple-300/80 text-[11px] sm:text-xs">
                        {errorMsg} Anda dapat mencoba pemindaian ulang menggunakan Gemini Vision AI.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 self-end md:self-auto">
                    <button
                      type="button"
                      onClick={() => setErrorMsg(null)}
                      className="px-3 py-1.5 rounded-xl text-slate-500 hover:bg-purple-100 dark:hover:bg-purple-900/30 text-xs font-semibold transition-colors"
                    >
                      Tutup
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowConsentModal(true)}
                      className="px-3.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold transition-all shadow-xs flex items-center gap-1.5 text-xs"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Coba Vision AI</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-3 sm:p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/50 flex items-start sm:items-center justify-between gap-3 text-xs shrink-0">
                  <div className="flex items-center gap-2.5 min-w-0 flex-1 text-rose-700 dark:text-rose-300">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
                    <span className="font-medium">{errorMsg}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setErrorMsg(null)}
                    className="px-2.5 py-1 rounded-lg text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/40 text-xs font-semibold shrink-0"
                  >
                    Tutup
                  </button>
                </div>
              )
            ) : showConsentModal ? (
              <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border-2 border-purple-400 dark:border-purple-600 shadow-lg text-xs space-y-3 shrink-0">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0 mt-0.5">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div className="space-y-1 flex-1 min-w-0">
                    <p className="font-bold text-slate-800 dark:text-slate-100 text-sm">
                      Konfirmasi Persetujuan Pemrosesan Vision Eksternal
                    </p>
                    <p className="text-[11px] sm:text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                      Dokumen gambar jadwal Anda akan dikirimkan ke server untuk diproses melalui model vision (Google Gemini API). Gambar hanya diproses sementara untuk ekstraksi teks tabel dan tunduk pada ketentuan privasi.
                    </p>
                    <p className="text-[11px] text-slate-500 italic">
                      Hasil vision akan dipadukan dengan hasil ekstraksi lokal dan tidak akan disimpan sebelum Anda meninjau dan menyetujuinya secara manual.
                    </p>
                  </div>
                </div>
                <div className="flex justify-end gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setShowConsentModal(false)}
                    className="px-3.5 py-2 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold text-xs"
                  >
                    Batal (Lanjut Manual)
                  </button>
                  <button
                    type="button"
                    onClick={handleExecuteVisionFallback}
                    className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold transition-all shadow-xs text-xs flex items-center gap-1.5"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Saya Setuju & Mulai Pemindaian Vision</span>
                  </button>
                </div>
              </div>
            ) : isVisionLoading ? (
              <div className="p-3.5 sm:p-4 rounded-2xl bg-purple-50/80 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800/50 flex items-center gap-3 text-xs text-purple-900 dark:text-purple-200 font-semibold shrink-0">
                <Loader2 className="w-4 h-4 animate-spin text-purple-600 dark:text-purple-400 shrink-0" />
                <span>Memproses dokumen melalui Vision Model & memadukan dengan bukti ekstraksi lokal...</span>
              </div>
            ) : isVisionEligible ? (
              <div className="p-3.5 sm:p-4 rounded-2xl bg-purple-50/90 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800/60 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs shrink-0">
                <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
                  <div className="w-8 h-8 rounded-xl bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <p className="font-bold text-purple-900 dark:text-purple-200 text-xs sm:text-sm">
                      Hasil ekstraksi lokal belum maksimal? Gunakan Bantuan Vision AI
                    </p>
                    <p className="text-purple-700/90 dark:text-purple-300/80 text-[11px] sm:text-xs">
                      {insufficiencyReasons.length > 0
                        ? insufficiencyReasons.join(" • ")
                        : "Deteksi tata letak atau teks tabel kurang jelas. Anda dapat mengaktifkan pemindaian berbasis Vision AI untuk mengenali baris yang terlewat."}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowConsentModal(true)}
                  className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 text-xs shrink-0 self-end md:self-auto"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Coba Vision AI</span>
                </button>
              </div>
            ) : detectedLayout?.limitationReason ? (
              <div className="p-3 sm:p-3.5 rounded-2xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 flex items-start sm:items-center gap-2.5 text-xs text-amber-800 dark:text-amber-300 shrink-0">
                <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
                <span className="font-medium text-[11px] sm:text-xs">{detectedLayout.limitationReason}</span>
              </div>
            ) : null}

            {/* Subheader: Item count, statuses, format badge, Vision badge, Add row */}
            <div className="shrink-0 flex flex-wrap items-center justify-between gap-2 text-xs py-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-slate-800 dark:text-slate-100">
                  {parsedItems.length} Baris Jadwal Terdeteksi
                </span>
                {parsedItems.some((i) => i.needsReview) ? (
                  <span className="px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 font-bold flex items-center gap-1 text-[11px]">
                    <AlertTriangle className="w-3 h-3" />
                    {parsedItems.filter((i) => i.needsReview).length} Baris Perlu Ditinjau
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-bold flex items-center gap-1 text-[11px]">
                    <CheckCircle2 className="w-3 h-3" />
                    Siap Disimpan
                  </span>
                )}
                {detectedLayout && (
                  <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 font-medium text-slate-600 dark:text-slate-300 text-[11px]">
                    Format: {detectedLayout.label}
                  </span>
                )}
                {activeVisionMeta && (
                  <span className="text-[10px] px-2 py-0.5 rounded-md bg-purple-100 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300 font-bold flex items-center gap-1">
                    <Sparkles className="w-2.5 h-2.5" />
                    Vision AI ({activeVisionMeta.provider}: {activeVisionMeta.model})
                  </span>
                )}
              </div>

              <button
                type="button"
                onClick={handleAddNewItem}
                className="flex items-center gap-1 text-accent hover:underline font-semibold text-xs shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Tambah Baris</span>
              </button>
            </div>

            {/* Dedicated Scrollable Items Container */}
            <div className="flex-1 min-h-0 overflow-y-auto space-y-3 p-1.5 sm:p-2.5 pr-2 sm:pr-3 rounded-2xl border border-line bg-surface/30">
              {parsedItems.map((item, idx) => {
                const fieldReasons = getFieldReviewReasons(item);
                const tentativeEntries = Object.entries(item.tentativeSuggestions || {}).filter(
                  ([, val]) => Boolean(val)
                ) as [ScheduleFieldKey, string][];

                return (
                  <div
                    key={item.id}
                    className={`p-3.5 rounded-xl border transition-all text-xs space-y-2.5 ${
                      item.needsReview
                        ? "bg-amber-50/40 dark:bg-amber-950/15 border-amber-300 dark:border-amber-800/80"
                        : "bg-surface-elevated border-line shadow-xs"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-1">
                        <span className="font-bold text-content-muted w-5">
                          #{idx + 1}
                        </span>
                        <input
                          type="text"
                          value={item.namaMatkul}
                          onChange={(e) => handleItemChange(item.id, "namaMatkul", e.target.value)}
                          placeholder="Nama Mata Kuliah (Wajib diisi)"
                          className={`flex-1 font-bold bg-transparent border-b border-dashed focus:border-accent focus:outline-none px-1 py-0.5 ${
                            !item.namaMatkul || isFieldUncertain(item, "namaMatkul")
                              ? "border-amber-500 bg-amber-100/50 dark:bg-amber-950/40 rounded text-amber-900 dark:text-amber-200 placeholder:text-amber-500"
                              : "border-line text-content-primary"
                          }`}
                        />
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {item.recognitionStatus === "confirmed_assisted" && !item.needsReview && (
                          <span className="px-2 py-0.5 rounded-md bg-accent-muted text-[10px] font-bold text-accent flex items-center gap-1 border border-line-subtle">
                            <BookMarked className="w-2.5 h-2.5" />
                            Kamus Pengguna
                          </span>
                        )}
                        {item.recognitionStatus === "high_confidence" && !item.needsReview && (
                          <span className="px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-[10px] font-bold text-emerald-700 dark:text-emerald-300 flex items-center gap-1">
                            <CheckCircle2 className="w-2.5 h-2.5" />
                            Otomatis Akurat
                          </span>
                        )}
                        {item.needsReview && (
                          <span className="px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950/70 text-[10px] font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1">
                            <AlertTriangle className="w-2.5 h-2.5" />
                            Perlu Ditinjau
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => handleDeleteItem(item.id)}
                          className="p-1 text-slate-400 hover:text-rose-600 transition-colors"
                          title="Hapus baris ini"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Metadata Badges (Kode MK, Kelas, Auto-Corrections, Tentative Suggestions) */}
                    {(item.kodeMatkul ||
                      item.kelas ||
                      (item.appliedCorrections && item.appliedCorrections.length > 0) ||
                      tentativeEntries.length > 0) && (
                      <div className="flex items-center flex-wrap gap-1.5 pl-7">
                        {item.kodeMatkul && (
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[10px] font-semibold text-slate-600 dark:text-slate-300">
                            Kode: {item.kodeMatkul}
                          </span>
                        )}
                        {item.kelas && (
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[10px] font-semibold text-slate-600 dark:text-slate-300">
                            Kls: {item.kelas}
                          </span>
                        )}
                        {item.appliedCorrections &&
                          item.appliedCorrections.map((corr, cIdx) => (
                            <span
                              key={cIdx}
                              className="px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/50 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300 flex items-center gap-1"
                            >
                              <Sparkles className="w-2.5 h-2.5" />
                              {corr}
                            </span>
                          ))}
                        {tentativeEntries.map(([fieldKey, suggestedVal]) => (
                          <button
                            key={fieldKey}
                            type="button"
                            onClick={() =>
                              handleApplyTentativeSuggestion(item.id, fieldKey, suggestedVal)
                            }
                            className="px-2 py-0.5 rounded-md bg-amber-100 hover:bg-amber-200 dark:bg-amber-950/80 dark:hover:bg-amber-900 text-[10px] font-bold text-amber-800 dark:text-amber-200 border border-amber-300 dark:border-amber-700 flex items-center gap-1 transition-colors"
                            title="Klik untuk menerapkan saran dari kamus Anda"
                          >
                            <BookMarked className="w-2.5 h-2.5" />
                            <span>
                              Saran {FIELD_LABELS[fieldKey] || fieldKey}: &ldquo;{suggestedVal}&rdquo; [Gunakan]
                            </span>
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Details Grid — Highlights ONLY uncertain fields */}
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1">
                      <div>
                        <label className="text-[10px] text-slate-400 block mb-0.5">Hari</label>
                        <select
                          value={item.hari}
                          onChange={(e) => handleItemChange(item.id, "hari", e.target.value)}
                          className={`w-full rounded-lg px-2 py-1 focus:outline-none border font-semibold ${
                            !item.hari || isFieldUncertain(item, "hari")
                              ? "bg-amber-50 dark:bg-amber-950/40 border-amber-400 text-amber-800 dark:text-amber-200"
                              : "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200"
                          }`}
                        >
                          <option value="">-- Pilih Hari --</option>
                          {DAYS.map((d) => (
                            <option key={d} value={d}>
                              {d}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="sm:col-span-2">
                        <label className="text-[10px] text-slate-400 block mb-0.5">
                          Jam Kuliah (Mulai - Akhir)
                        </label>
                        <div className="flex items-center gap-1">
                          <input
                            type="time"
                            value={item.waktuMulai}
                            onChange={(e) =>
                              handleItemChange(item.id, "waktuMulai", e.target.value)
                            }
                            className={`w-full rounded-lg px-1.5 py-1 focus:outline-none border ${
                              !item.waktuMulai || isFieldUncertain(item, "waktuMulai")
                                ? "bg-amber-50 dark:bg-amber-950/40 border-amber-400 text-amber-900 dark:text-amber-200 font-semibold"
                                : "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200"
                            }`}
                          />
                          <span>-</span>
                          <input
                            type="time"
                            value={item.waktuSelesai}
                            onChange={(e) =>
                              handleItemChange(item.id, "waktuSelesai", e.target.value)
                            }
                            className={`w-full rounded-lg px-1.5 py-1 focus:outline-none border ${
                              !item.waktuSelesai || isFieldUncertain(item, "waktuSelesai")
                                ? "bg-amber-50 dark:bg-amber-950/40 border-amber-400 text-amber-900 dark:text-amber-200 font-semibold"
                                : "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200"
                            }`}
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-[10px] text-slate-400 block mb-0.5">Ruangan</label>
                        <input
                          type="text"
                          value={item.lokasi}
                          onChange={(e) => handleItemChange(item.id, "lokasi", e.target.value)}
                          placeholder="Mis: D.302 VA"
                          className={`w-full rounded-lg px-2 py-1 focus:outline-none border ${
                            isFieldUncertain(item, "lokasi")
                              ? "bg-amber-50 dark:bg-amber-950/40 border-amber-400 text-amber-900 dark:text-amber-200 font-semibold"
                              : "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200"
                          }`}
                        />
                      </div>

                      <div>
                        <label className="text-[10px] text-slate-400 block mb-0.5">SKS</label>
                        <input
                          type="number"
                          min={1}
                          max={8}
                          value={item.sks}
                          onChange={(e) =>
                            handleItemChange(
                              item.id,
                              "sks",
                              e.target.value === "" ? "" : parseInt(e.target.value, 10)
                            )
                          }
                          placeholder="1-8"
                          className={`w-full rounded-lg px-2 py-1 focus:outline-none border ${
                            item.sks === "" || isFieldUncertain(item, "sks")
                              ? "bg-amber-50 dark:bg-amber-950/40 border-amber-400 text-amber-900 dark:text-amber-200 font-semibold"
                              : "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200"
                          }`}
                        />
                      </div>
                    </div>

                    {/* Secondary Row: Dosen, Kode MK, Kelas */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <div>
                        <label className="text-[10px] text-slate-400 block mb-0.5">
                          Dosen Pengampu (Opsional)
                        </label>
                        <input
                          type="text"
                          value={item.dosen}
                          onChange={(e) => handleItemChange(item.id, "dosen", e.target.value)}
                          placeholder="Nama Dosen"
                          className={`w-full rounded-lg px-2 py-1 focus:outline-none border ${
                            isFieldUncertain(item, "dosen")
                              ? "bg-amber-50 dark:bg-amber-950/40 border-amber-400 text-amber-900 dark:text-amber-200 font-semibold"
                              : "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200"
                          }`}
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-400 block mb-0.5">
                          Kode MK (Opsional)
                        </label>
                        <input
                          type="text"
                          value={item.kodeMatkul || ""}
                          onChange={(e) => handleItemChange(item.id, "kodeMatkul", e.target.value)}
                          placeholder="Mis: IF253418"
                          className={`w-full rounded-lg px-2 py-1 focus:outline-none border ${
                            isFieldUncertain(item, "kodeMatkul")
                              ? "bg-amber-50 dark:bg-amber-950/40 border-amber-400 text-amber-900 dark:text-amber-200 font-semibold"
                              : "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200"
                          }`}
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-400 block mb-0.5">
                          Kelas (Opsional)
                        </label>
                        <input
                          type="text"
                          value={item.kelas || ""}
                          onChange={(e) => handleItemChange(item.id, "kelas", e.target.value)}
                          placeholder="Mis: R.03"
                          className={`w-full rounded-lg px-2 py-1 focus:outline-none border ${
                            isFieldUncertain(item, "kelas")
                              ? "bg-amber-50 dark:bg-amber-950/40 border-amber-400 text-amber-900 dark:text-amber-200 font-semibold"
                              : "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200"
                          }`}
                        />
                      </div>
                    </div>

                    {/* Per-field review reasons */}
                    {fieldReasons.length > 0 && (
                      <div className="p-2 rounded-lg bg-amber-100/60 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-800/60 space-y-1">
                        {fieldReasons.map((fr, rIdx) => (
                          <div
                            key={rIdx}
                            className="text-[11px] text-amber-800 dark:text-amber-300 flex items-start gap-1.5"
                          >
                            <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                            <span>
                              <strong className="font-bold">
                                {FIELD_LABELS[fr.field] || fr.field}:
                              </strong>{" "}
                              {fr.reason}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Preserve & Display Raw OCR Text when uncertain */}
                    {item.needsReview && item.rawText && (
                      <div className="px-2.5 py-1.5 rounded-lg bg-slate-100/80 dark:bg-slate-800/60 text-[10px] text-slate-500 dark:text-slate-400 font-mono break-all">
                        <span className="font-semibold text-slate-600 dark:text-slate-300">
                          Teks OCR Asli:{" "}
                        </span>
                        {item.rawText}
                      </div>
                    )}

                    {item.warnings && item.warnings.length > 0 && (
                      <div className="pt-0.5 text-[11px] text-amber-700 dark:text-amber-400 font-medium flex items-center gap-1.5">
                        <AlertTriangle className="w-3 h-3 shrink-0" />
                        <span>{item.warnings.join(" • ")}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Pinned Bottom Footer */}
            <div className="shrink-0 space-y-2 pt-2 border-t border-line">
              {/* Opt-in Learning Checkbox */}
              <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={learnCorrections}
                  onChange={(e) => setLearnCorrections(e.target.checked)}
                  className="rounded border-line text-accent focus:ring-accent"
                />
                <span>
                  Ingat koreksi nama mata kuliah, kode MK, dan ruangan yang saya perbaiki untuk impor berikutnya
                </span>
              </label>

              {/* Bottom Actions */}
              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={() => setStep("upload")}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  Pilih File Lain
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleClose}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    Batal
                  </button>

                  <button
                    type="button"
                    disabled={parsedItems.length === 0 || isSaving}
                    onClick={handleConfirmSave}
                    className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 transition-all shadow-md shadow-emerald-500/20 flex items-center gap-2"
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Menyimpan ke Jadwal...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Konfirmasi & Simpan ({parsedItems.length})</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
