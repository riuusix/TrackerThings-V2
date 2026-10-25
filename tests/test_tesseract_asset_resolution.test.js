import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import zlib from "node:zlib";
import { createWorker } from "tesseract.js";
import { register } from "node:module";
import { pathToFileURL } from "node:url";

// Register custom loader for dynamic next/server and @ path resolution
register("./tests/loader.mjs", pathToFileURL("./"));

const { LOCAL_OCR_CONFIG } = await import("../lib/ocr/browserOcr.ts");
const { recognizeScheduleData } = await import("../lib/scheduleParser.ts");

test.describe("Tesseract.js Asset Resolution & Browser OCR Core Integrity Suite", () => {
  let server;
  let serverPort;
  let serverBaseUrl;

  test.before(async () => {
    // Start a lightweight static file server mirroring Next.js /public directory mapping
    const publicDir = path.resolve("public");

    server = http.createServer((req, res) => {
      const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
      let reqPath = parsedUrl.pathname;
      if (reqPath.startsWith("/")) reqPath = reqPath.slice(1);

      const filePath = path.join(publicDir, reqPath);

      if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        res.writeHead(404, { "Content-Type": "text/html" });
        res.end("<h1>404 Not Found</h1>");
        return;
      }

      let contentType = "application/octet-stream";
      if (filePath.endsWith(".js") || filePath.endsWith(".wasm.js")) {
        contentType = "application/javascript";
      } else if (filePath.endsWith(".gz")) {
        contentType = "application/gzip";
      } else if (filePath.endsWith(".wasm")) {
        contentType = "application/wasm";
      }

      const fileBuffer = fs.readFileSync(filePath);
      res.writeHead(200, {
        "Content-Type": contentType,
        "Content-Length": fileBuffer.length,
      });
      res.end(fileBuffer);
    });

    await new Promise((resolve) => {
      server.listen(0, "127.0.0.1", () => {
        serverPort = server.address().port;
        serverBaseUrl = `http://127.0.0.1:${serverPort}`;
        resolve();
      });
    });
  });

  test.after(() => {
    if (server) {
      server.close();
    }
  });

  // =========================================================================
  // 1. Exact Failing Asset URL Verification
  // =========================================================================
  test("1. Exact previously failing URL (/tesseract/core/tesseract-core-relaxedsimd-lstm.wasm.js) returns HTTP 200 with JavaScript", async () => {
    const assetUrl = `${serverBaseUrl}/tesseract/core/tesseract-core-relaxedsimd-lstm.wasm.js`;
    const res = await fetch(assetUrl);

    assert.equal(res.status, 200, `Must return HTTP 200 for ${assetUrl}`);
    assert.ok(
      res.headers.get("content-type")?.includes("javascript"),
      "Response Content-Type must be javascript"
    );

    const bodyText = await res.text();
    assert.ok(
      bodyText.length > 3500000,
      `Asset body size (${bodyText.length} bytes) must be > 3.5 MB`
    );
    assert.ok(
      bodyText.startsWith("var TesseractCore="),
      "Asset must start with var TesseractCore="
    );
    assert.ok(
      bodyText.includes("TesseractCore"),
      "Asset must define TesseractCore"
    );
  });

  // =========================================================================
  // 2. All Core Variants and Support Files
  // =========================================================================
  test("2. All required WASM core variants and worker script are served with valid JS headers", async () => {
    const requiredJsAssets = [
      "/tesseract/worker.min.js",
      "/tesseract/core/tesseract-core-relaxedsimd-lstm.wasm.js",
      "/tesseract/core/tesseract-core-simd-lstm.wasm.js",
      "/tesseract/core/tesseract-core-lstm.wasm.js",
      "/tesseract/core/tesseract-core-relaxedsimd.wasm.js",
      "/tesseract/core/tesseract-core-simd.wasm.js",
      "/tesseract/core/tesseract-core.wasm.js",
    ];

    for (const assetPath of requiredJsAssets) {
      const res = await fetch(`${serverBaseUrl}${assetPath}`);
      assert.equal(res.status, 200, `Asset ${assetPath} must return HTTP 200`);
      assert.ok(
        res.headers.get("content-type")?.includes("javascript"),
        `Asset ${assetPath} must be served as javascript`
      );
      const buf = await res.arrayBuffer();
      assert.ok(buf.byteLength > 100000, `Asset ${assetPath} size must be non-trivial`);
    }
  });

  // =========================================================================
  // 3. Language Models Integrity
  // =========================================================================
  test("3. Local language models are valid gzip files and decompress cleanly", async () => {
    const langs = ["ind", "eng"];

    for (const lang of langs) {
      const langUrl = `${serverBaseUrl}/tesseract/lang/${lang}.traineddata.gz`;
      const res = await fetch(langUrl);
      assert.equal(res.status, 200, `Language model ${lang} must return HTTP 200`);

      const compressedBuf = Buffer.from(await res.arrayBuffer());
      // Check magic bytes for GZIP (0x1f, 0x8b)
      assert.equal(compressedBuf[0], 0x1f, "Must start with gzip magic byte 0x1f");
      assert.equal(compressedBuf[1], 0x8b, "Must start with gzip magic byte 0x8b");

      // Verify decompression
      const decompressed = zlib.gunzipSync(compressedBuf);
      assert.ok(
        decompressed.length > compressedBuf.length,
        "Decompressed traineddata must be larger than compressed"
      );
      assert.ok(
        decompressed.length > 1500000,
        `Decompressed ${lang} traineddata must be > 1.5 MB`
      );
    }
  });

  // =========================================================================
  // 4. WASM Core Executable Instantiation
  // =========================================================================
  test("4. Relaxed-SIMD WASM Core bundle instantiates cleanly without runtime errors", async () => {
    const coreScriptPath = path.resolve(
      "public/tesseract/core/tesseract-core-relaxedsimd-lstm.wasm.js"
    );
    assert.ok(fs.existsSync(coreScriptPath), "Core script must exist on disk");

    const coreFactory = (await import(pathToFileURL(coreScriptPath).href)).default;
    assert.equal(typeof coreFactory, "function", "Core export must be factory function");

    const coreModule = await coreFactory();
    assert.ok(coreModule, "Core module must instantiate successfully");
    assert.ok(
      typeof coreModule.OEM_LSTM_ONLY !== "undefined" ||
        typeof coreModule._emscripten_bind_TessBaseAPI_Recognize_1 !== "undefined" ||
        typeof coreModule.TessBaseAPI !== "undefined" ||
        typeof coreModule.RIL_TEXTLINE !== "undefined",
      "Core module must export Tesseract symbols"
    );
  });

  // =========================================================================
  // 5. End-to-End OCR Recognition on Image Fixture with Local Assets
  // =========================================================================
  test("5. OCR worker recognizes timetable text using local core and lang assets", async () => {
    const fixturePath = path.resolve("datasets/fixtures/schedule_table_fixture.png");
    assert.ok(fs.existsSync(fixturePath), "Image fixture must exist");

    // Initialize worker using local corePath and langPath
    const worker = await createWorker(["ind", "eng"], 1, {
      corePath: path.resolve("public/tesseract/core"),
      langPath: path.resolve("public/tesseract/lang"),
      gzip: true,
    });

    try {
      const res = await worker.recognize(
        fixturePath,
        {},
        { text: true, blocks: true, tsv: true }
      );

      const text = res?.data?.text?.trim() || "";
      const tsv = res?.data?.tsv?.trim() || "";
      const confidence = res?.data?.confidence || 0;

      assert.ok(text.length > 100, `OCR text must be extracted (got ${text.length} chars)`);
      assert.ok(
        text.includes("Mata Kuliah") || text.includes("Ruang") || text.includes("Senin"),
        "Must contain timetable keywords"
      );
      assert.ok(tsv.length > 200, "OCR TSV output must be extracted for spatial parsing");
      assert.ok(confidence > 50, `OCR confidence must be > 50% (got ${confidence})`);

      // Verify that schedule parser consumes this OCR output successfully
      const lines = text.split("\n").filter((l) => l.trim().length > 0);
      const recog = recognizeScheduleData({ text, lines }, [], []);
      assert.ok(recog.items.length > 0, "Schedule parser must extract items from OCR output");
      assert.ok(recog.items.some((it) => it.namaMatkul.length > 0), "Must extract valid course names");
    } finally {
      await worker.terminate();
    }
  });

  // =========================================================================
  // 6. Configuration Contract Verification
  // =========================================================================
  test("6. LOCAL_OCR_CONFIG preserves local origin paths and zero external CDNs", () => {
    assert.equal(LOCAL_OCR_CONFIG.workerPath, "/tesseract/worker.min.js");
    assert.equal(LOCAL_OCR_CONFIG.corePath, "/tesseract/core");
    assert.equal(LOCAL_OCR_CONFIG.langPath, "/tesseract/lang");
    assert.equal(LOCAL_OCR_CONFIG.gzip, true);
  });
});
