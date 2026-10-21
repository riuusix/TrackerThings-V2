/**
 * TrackerThings V2 â€” Browser Offline OCR Module (Tesseract.js Local Assets)
 *
 * Provides on-origin client-side OCR without external CDN dependencies.
 * Uses local assets located in /public/tesseract/:
 * - worker.min.js
 * - core/tesseract-core-simd-lstm.wasm.js (or fallback lstm)
 * - lang/ind.traineddata.gz & lang/eng.traineddata.gz
 */

export interface BrowserOcrProgress {
  status: string;
  progress: number;
}

export interface BrowserOcrResult {
  text: string;
  tsv: string;
  confidence: number;
}

export interface BrowserOcrOptions {
  onProgress?: (progress: BrowserOcrProgress) => void;
  signal?: AbortSignal;
}

export const LOCAL_OCR_CONFIG = {
  workerPath: "/tesseract/worker.min.js",
  corePath: "/tesseract/core",
  langPath: "/tesseract/lang",
  gzip: true,
};

let activeWorker: any = null;
let isInitializing = false;

/**
 * Gets or initializes a warm singleton Tesseract worker configured exclusively
 * with local origin assets for offline capability.
 */
export async function getLocalBrowserWorker(
  onProgress?: (progress: BrowserOcrProgress) => void
): Promise<any> {
  if (activeWorker) {
    return activeWorker;
  }

  if (isInitializing) {
    // Wait for in-flight initialization
    while (isInitializing) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    if (activeWorker) return activeWorker;
  }

  isInitializing = true;
  try {
    const { createWorker } = await import("tesseract.js");

    const worker = await createWorker(["ind", "eng"], 1, {
      workerPath: LOCAL_OCR_CONFIG.workerPath,
      corePath: LOCAL_OCR_CONFIG.corePath,
      langPath: LOCAL_OCR_CONFIG.langPath,
      gzip: LOCAL_OCR_CONFIG.gzip,
      logger: (m: any) => {
        if (!onProgress) return;
        const prog = Math.round((m.progress || 0) * 100);
        if (m.status === "loading tesseract core") {
          onProgress({ status: "Memuat mesin OCR lokal (WASM)...", progress: prog });
        } else if (m.status === "loading language traineddata") {
          onProgress({ status: "Memuat kamus bahasa Indonesia & Inggris lokal...", progress: prog });
        } else if (m.status === "initializing api") {
          onProgress({ status: "Menginisialisasi pemindai...", progress: prog });
        } else if (m.status === "recognizing text") {
          onProgress({ status: `Mengenali teks & struktur tabel jadwal... ${prog}%`, progress: prog });
        }
      },
    });

    activeWorker = worker;
    return activeWorker;
  } finally {
    isInitializing = false;
  }
}

/**
 * Executes browser OCR on an image file/blob using local origin assets.
 * Preserves text, TSV (for word bounding box spatial clustering), and confidence.
 */
export async function runBrowserOcr(
  imageFile: Blob | File,
  options?: BrowserOcrOptions
): Promise<BrowserOcrResult> {
  if (options?.signal?.aborted) {
    throw new DOMException("Operasi OCR dibatalkan oleh pengguna.", "AbortError");
  }

  const worker = await getLocalBrowserWorker(options?.onProgress);

  if (options?.signal?.aborted) {
    throw new DOMException("Operasi OCR dibatalkan oleh pengguna.", "AbortError");
  }

  options?.onProgress?.({
    status: "Memindai baris dan kolom tabel jadwal...",
    progress: 50,
  });

  const res = await worker.recognize(
    imageFile,
    {},
    { text: true, blocks: true, tsv: true }
  );

  if (options?.signal?.aborted) {
    throw new DOMException("Operasi OCR dibatalkan oleh pengguna.", "AbortError");
  }

  const text = res?.data?.text?.trim() || "";
  const tsv = res?.data?.tsv?.trim() || "";
  const confidence = typeof res?.data?.confidence === "number" ? res.data.confidence : 0;

  return { text, tsv, confidence };
}

/**
 * Terminates the warm browser worker to free WebAssembly and worker memory.
 */
export async function terminateBrowserOcr(): Promise<void> {
  if (activeWorker) {
    try {
      await activeWorker.terminate();
    } catch {
      // Ignore termination error
    } finally {
      activeWorker = null;
    }
  }
}
