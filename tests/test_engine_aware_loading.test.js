import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "..");

const EXPECTED_LOADER_FILES = [
  "trackerthings_loading_typescript_transparent.png",
  "trackerthings_loading_typescript_white.gif",
  "trackerthings_loading_typescript.gif",
  "trackerthings_loading_python_transparent.png",
  "trackerthings_loading_python_white.gif",
  "trackerthings_loading_python.gif",
  "trackerthings_loading_internet_transparent.png",
  "trackerthings_loading_internet_white.gif",
  "trackerthings_loading_internet.gif",
  "trackerthings_loading_react_transparent.png",
  "trackerthings_loading_react_white.gif",
  "trackerthings_loading_react_blue.gif",
];

describe("Engine-Aware Loading Animation & Native iOS Integration Suite", () => {
  // =========================================================================
  // 1. Asset Placement and Integrity Across Web, iOS, and xtool
  // =========================================================================
  describe("1. Asset Placement & Binary Integrity", () => {
    const locations = [
      { name: "Web Public", dir: path.join(REPO_ROOT, "public", "assets", "loaders") },
      { name: "iOS Resources", dir: path.join(REPO_ROOT, "Sources", "TrackerThings", "Resources", "Loaders") },
      { name: "xtool Assets", dir: path.join(REPO_ROOT, "xtool", "assets", "Loaders") },
    ];

    for (const loc of locations) {
      it(`All 12 loader assets exist in ${loc.name}`, () => {
        assert.ok(fs.existsSync(loc.dir), `Directory ${loc.dir} must exist`);
        for (const file of EXPECTED_LOADER_FILES) {
          const filePath = path.join(loc.dir, file);
          assert.ok(fs.existsSync(filePath), `File ${file} must exist in ${loc.name}`);
          const stats = fs.statSync(filePath);
          assert.ok(stats.size > 100000, `Asset ${file} in ${loc.name} must be substantial (size: ${stats.size})`);
        }
      });
    }

    it("Transparent PNG assets have valid PNG signature and APNG animation chunks", () => {
      const webDir = path.join(REPO_ROOT, "public", "assets", "loaders");
      const pngFiles = EXPECTED_LOADER_FILES.filter((f) => f.endsWith(".png"));

      for (const png of pngFiles) {
        const buffer = fs.readFileSync(path.join(webDir, png));
        // PNG 8-byte header: \x89PNG\r\n\x1a\n
        const header = buffer.subarray(0, 8);
        assert.deepEqual(
          Array.from(header),
          [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
          `${png} must have valid PNG magic header`
        );
        // APNG check: contains 'acTL' chunk
        const stringContent = buffer.toString("binary");
        assert.ok(
          stringContent.includes("acTL"),
          `${png} must be an Animated PNG (APNG) containing acTL chunk`
        );
      }
    });

    it("GIF assets have valid GIF89a signatures", () => {
      const webDir = path.join(REPO_ROOT, "public", "assets", "loaders");
      const gifFiles = EXPECTED_LOADER_FILES.filter((f) => f.endsWith(".gif"));

      for (const gif of gifFiles) {
        const buffer = fs.readFileSync(path.join(webDir, gif));
        const sig = buffer.subarray(0, 6).toString("ascii");
        assert.equal(sig, "GIF89a", `${gif} must have GIF89a signature`);
      }
    });
  });

  // =========================================================================
  // 2. Web Engine Loader Configuration & Indonesian Copy
  // =========================================================================
  describe("2. Web Engine Configuration & Dynamic Status Mapping", () => {
    const modalPath = path.join(REPO_ROOT, "components", "ImportScheduleModal.tsx");
    const modalSource = fs.readFileSync(modalPath, "utf8");

    it("Defines exact Indonesian status copy for TypeScript, Python, and Server stages", () => {
      assert.ok(
        modalSource.includes("Sistem TrackerThings sedang memproses jadwalmu…"),
        "Must include TypeScript status message"
      );
      assert.ok(
        modalSource.includes("Mengompilasi dan mempertajam hasil analisismu…"),
        "Must include Python refinement status message"
      );
      assert.ok(
        modalSource.includes("Kami sedang memproses pertajaman analisismu, tunggu sebentar."),
        "Must include Server waiting status message"
      );
    });

    it("Maps engine assets to transparent APNG with fallback to white GIF", () => {
      assert.ok(
        modalSource.includes("/assets/loaders/trackerthings_loading_typescript_transparent.png"),
        "TypeScript engine must use transparent APNG"
      );
      assert.ok(
        modalSource.includes("/assets/loaders/trackerthings_loading_python_transparent.png"),
        "Python engine must use transparent APNG"
      );
      assert.ok(
        modalSource.includes("/assets/loaders/trackerthings_loading_internet_transparent.png"),
        "Server engine must use transparent APNG"
      );
      assert.ok(
        modalSource.includes("/assets/loaders/trackerthings_loading_react_transparent.png"),
        "React client must use transparent APNG"
      );
    });

    it("resolveEngineFromStageAndEngine isolates Python refinement to confirmed Python engines", () => {
      // Must contain python engine mapping
      assert.ok(
        modalSource.includes('stage === "python_refinement" || engine === "python_pdfplumber"'),
        "Must strictly map python_refinement stage or python_pdfplumber to python engine"
      );
      // Must map server OCR/waiting
      assert.ok(
        modalSource.includes('stage === "ocr_extraction" ||\n    engine === "server_ocr" ||\n    stage === "server_waiting" ||\n    stage === "server_refinement"'),
        "Must map server_waiting and server_ocr to server engine"
      );
    });

    it("Replaces upload dropzone with engine-aware loading state (min-h-[260px]) and cancel button", () => {
      assert.ok(
        modalSource.includes("min-h-[260px]"),
        "Loading card must preserve stable height (min-h-[260px]) to prevent layout jitter"
      );
      assert.ok(
        modalSource.includes("Batalkan Proses"),
        "Must offer cancellation action during extraction"
      );
      assert.ok(
        modalSource.includes("abortControllerRef.current.abort()"),
        "Cancellation must abort active in-flight fetch request"
      );
    });
  });

  // =========================================================================
  // 3. Native iOS SwiftUI Engine Loader & ViewModel State
  // =========================================================================
  describe("3. Native iOS SwiftUI Engine Loader & Architecture", () => {
    const modelsPath = path.join(
      REPO_ROOT,
      "Sources",
      "TrackerThings",
      "Models",
      "ScheduleImportModels.swift"
    );
    const viewModelPath = path.join(
      REPO_ROOT,
      "Sources",
      "TrackerThings",
      "ViewModels",
      "ImportScheduleViewModel.swift"
    );
    const engineLoaderViewPath = path.join(
      REPO_ROOT,
      "Sources",
      "TrackerThings",
      "Views",
      "Components",
      "EngineLoaderView.swift"
    );
    const importViewPath = path.join(
      REPO_ROOT,
      "Sources",
      "TrackerThings",
      "Views",
      "Courses",
      "ImportScheduleView.swift"
    );

    it("Swift models declare ScheduleImportEngine with localAppleVision and exact Indonesian copy", () => {
      assert.ok(fs.existsSync(modelsPath), "ScheduleImportModels.swift must exist");
      const source = fs.readFileSync(modelsPath, "utf8");

      assert.ok(source.includes("enum ScheduleImportEngine"), "Must declare ScheduleImportEngine enum");
      assert.ok(source.includes("case localAppleVision = \"apple_vision\""), "Must include localAppleVision case");
      assert.ok(source.includes("case python = \"python\""), "Must include python case");
      assert.ok(source.includes("case serverInternet = \"server\""), "Must include serverInternet case");

      assert.ok(
        source.includes("Membaca teks dan menyusun jadwalmu di perangkat…"),
        "localAppleVision must use device-native Indonesian message"
      );
      assert.ok(
        source.includes("Sistem TrackerThings sedang memproses jadwalmu…"),
        "typescript must use standard processing message"
      );
      assert.ok(
        source.includes("Mengompilasi dan mempertajam hasil analisismu…"),
        "python must use compilation/refinement message"
      );
      assert.ok(
        source.includes("Kami sedang memproses pertajaman analisismu, tunggu sebentar."),
        "serverInternet must use waiting message"
      );
    });

    it("Swift ViewModel initializes with localAppleVision and prevents duplicate file picks", () => {
      assert.ok(fs.existsSync(viewModelPath), "ImportScheduleViewModel.swift must exist");
      const source = fs.readFileSync(viewModelPath, "utf8");

      assert.ok(
        source.includes("public var activeEngine: ScheduleImportEngine = .localAppleVision"),
        "ViewModel must declare activeEngine defaulted to .localAppleVision"
      );
      assert.ok(
        source.includes("activeEngine = .localAppleVision"),
        "Local extraction start must reset activeEngine to .localAppleVision"
      );
      assert.ok(
        source.includes("activeEngine = .serverInternet"),
        "Transition to server refinement must update activeEngine to .serverInternet"
      );
    });

    it("EngineLoaderView provides ImageIO APNG/GIF frame decoding, memory caching, and view teardown", () => {
      assert.ok(fs.existsSync(engineLoaderViewPath), "EngineLoaderView.swift must exist");
      const source = fs.readFileSync(engineLoaderViewPath, "utf8");

      assert.ok(
        source.includes("CGImageSourceCreateWithData"),
        "Must use native ImageIO to decode animation frames"
      );
      assert.ok(
        source.includes("kCGImagePropertyPNGDictionary"),
        "Must parse APNG frame delay properties"
      );
      assert.ok(
        source.includes("kCGImagePropertyGIFDictionary"),
        "Must parse GIF frame delay properties"
      );
      assert.ok(
        source.includes("NSCache<NSString, UIImage>"),
        "Must use NSCache for memory-efficient frame storage without re-decoding"
      );
      assert.ok(
        source.includes("dismantleUIView"),
        "Must implement dismantleUIView to stop animation loop and release UIImage memory when view is dismissed"
      );
      assert.ok(
        source.includes("accessibilityReduceMotion"),
        "Must respect accessibility reduce motion preference"
      );
      assert.ok(
        source.includes("Batalkan Proses"),
        "Must provide Indonesian cancel button"
      );
    });

    it("ImportScheduleView switches picker to EngineLoaderView during active extraction", () => {
      assert.ok(fs.existsSync(importViewPath), "ImportScheduleView.swift must exist");
      const source = fs.readFileSync(importViewPath, "utf8");

      assert.ok(
        source.includes("if viewModel.isLoading || viewModel.isVisionLoading"),
        "Must branch on viewModel.isLoading || viewModel.isVisionLoading"
      );
      assert.ok(
        source.includes("loadingCard"),
        "Must show loadingCard during active loading"
      );
      assert.ok(
        source.includes("EngineLoaderView("),
        "Must embed EngineLoaderView during extraction"
      );
      assert.ok(
        source.includes("engine: viewModel.activeEngine"),
        "Must pass viewModel.activeEngine to EngineLoaderView"
      );
    });
  });

  // =========================================================================
  // 4. Package.swift Resource Processing Gate
  // =========================================================================
  describe("4. Package.swift SwiftPM Resource Configuration", () => {
    it("Package.swift includes Resources folder for bundle asset resolution", () => {
      const packagePath = path.join(REPO_ROOT, "Package.swift");
      const source = fs.readFileSync(packagePath, "utf8");
      assert.ok(
        source.includes('.process("Resources")'),
        "Package.swift must process Resources directory so Bundle.module can find loader assets"
      );
    });
  });

  // =========================================================================
  // 5. Xcode & xtool Project Resources Configuration
  // =========================================================================
  describe("5. Xcode & xtool Project Resources Configuration", () => {
    it("TrackerThings.xcodeproj/project.pbxproj includes Loaders in Resources phase", () => {
      const pbxprojPath = path.join(REPO_ROOT, "TrackerThings.xcodeproj", "project.pbxproj");
      const source = fs.readFileSync(pbxprojPath, "utf8");
      assert.ok(
        source.includes("Loaders in Resources"),
        "PBXResourcesBuildPhase must include Loaders folder"
      );
    });

    it("xtool/TrackerThings.app/Loaders contains all 12 loader files for direct app bundle execution", () => {
      const appLoadersDir = path.join(REPO_ROOT, "xtool", "TrackerThings.app", "Loaders");
      assert.ok(fs.existsSync(appLoadersDir), "xtool/TrackerThings.app/Loaders directory must exist");
      for (const file of EXPECTED_LOADER_FILES) {
        assert.ok(
          fs.existsSync(path.join(appLoadersDir, file)),
          `File ${file} must exist in xtool/TrackerThings.app/Loaders`
        );
      }
    });
  });
});
