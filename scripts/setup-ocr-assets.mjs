/**
 * TrackerThings V2 â€” Local Tesseract.js OCR Assets Setup Script
 *
 * Copies worker and WASM core files from node_modules and verifies/downloads
 * compressed Indonesian & English language traineddata into public/tesseract.
 *
 * Licensing:
 * - worker.min.js: Apache-2.0 (tesseract.js)
 * - tesseract-core-*-lstm.wasm.js: Apache-2.0 (tesseract.js-core)
 * - ind.traineddata.gz: Apache-2.0 (Tesseract OCR / tessdata)
 * - eng.traineddata.gz: Apache-2.0 (Tesseract OCR / tessdata)
 */

import fs from "node:fs";
import path from "node:path";
import https from "node:https";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "..");
const PUBLIC_TESSERACT_DIR = path.join(ROOT_DIR, "public", "tesseract");
const CORE_DIR = path.join(PUBLIC_TESSERACT_DIR, "core");
const LANG_DIR = path.join(PUBLIC_TESSERACT_DIR, "lang");

// Create directories
fs.mkdirSync(CORE_DIR, { recursive: true });
fs.mkdirSync(LANG_DIR, { recursive: true });

// 1. Copy worker.min.js from installed tesseract.js
const workerSrc = path.join(ROOT_DIR, "node_modules", "tesseract.js", "dist", "worker.min.js");
const workerDest = path.join(PUBLIC_TESSERACT_DIR, "worker.min.js");
if (fs.existsSync(workerSrc)) {
  fs.copyFileSync(workerSrc, workerDest);
  console.log(`[OCR Setup] Copied worker.min.js (${(fs.statSync(workerDest).size / 1024).toFixed(1)} KB)`);
} else {
  console.warn(`[OCR Setup] Source not found: ${workerSrc}`);
}

// 2. Copy core wasm.js files from installed tesseract.js-core
const coreFiles = [
  "tesseract-core-relaxedsimd-lstm.wasm.js",
  "tesseract-core-simd-lstm.wasm.js",
  "tesseract-core-lstm.wasm.js",
  "tesseract-core-relaxedsimd.wasm.js",
  "tesseract-core-simd.wasm.js",
  "tesseract-core.wasm.js",
];

for (const file of coreFiles) {
  const src = path.join(ROOT_DIR, "node_modules", "tesseract.js-core", file);
  const dest = path.join(CORE_DIR, file);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
    console.log(`[OCR Setup] Copied ${file} (${(fs.statSync(dest).size / (1024 * 1024)).toFixed(2)} MB)`);
  } else {
    const isLstm = file.includes("-lstm.");
    if (isLstm) {
      console.error(`[OCR Setup] CRITICAL: Required core source not found: ${src}`);
      process.exit(1);
    } else {
      console.warn(`[OCR Setup] Core source not found: ${src}`);
    }
  }
}

// 3. Download / Verify compressed language models
const LANG_MODELS = [
  {
    lang: "ind",
    filename: "ind.traineddata.gz",
    url: "https://cdn.jsdelivr.net/npm/@tesseract.js-data/ind/4.0.0_best_int/ind.traineddata.gz",
    minBytes: 1000000, // ~1.14 MB
  },
  {
    lang: "eng",
    filename: "eng.traineddata.gz",
    url: "https://cdn.jsdelivr.net/npm/@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz",
    minBytes: 2500000, // ~2.81 MB
  },
];

function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return downloadFile(res.headers.location, destPath).then(resolve).catch(reject);
        }
        if (res.statusCode !== 200) {
          return reject(new Error(`HTTP ${res.statusCode} from ${url}`));
        }
        const fileStream = fs.createWriteStream(destPath);
        res.pipe(fileStream);
        fileStream.on("finish", () => {
          fileStream.close(() => resolve());
        });
      })
      .on("error", (err) => {
        fs.unlink(destPath, () => {});
        reject(err);
      });
  });
}

async function ensureLangModels() {
  for (const model of LANG_MODELS) {
    const dest = path.join(LANG_DIR, model.filename);
    if (fs.existsSync(dest) && fs.statSync(dest).size >= model.minBytes) {
      console.log(`[OCR Setup] Language model verified: ${model.filename} (${(fs.statSync(dest).size / (1024 * 1024)).toFixed(2)} MB)`);
      continue;
    }

    console.log(`[OCR Setup] Downloading ${model.filename}...`);
    try {
      await downloadFile(model.url, dest);
      const sizeMb = (fs.statSync(dest).size / (1024 * 1024)).toFixed(2);
      console.log(`[OCR Setup] Downloaded ${model.filename} (${sizeMb} MB)`);
    } catch (err) {
      console.error(`[OCR Setup] Failed downloading ${model.filename}:`, err);
      process.exit(1);
    }
  }
}

await ensureLangModels();
console.log("[OCR Setup] All local Tesseract OCR assets are ready in public/tesseract/!");
