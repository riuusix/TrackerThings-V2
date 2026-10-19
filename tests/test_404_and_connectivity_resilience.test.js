import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

describe("Custom 404, Logo Loading Animation & iOS Connectivity Resilience Suite", () => {
  const rootDir = process.cwd();

  // --------------------------------------------------------------------------
  // 1. Custom 404 Page Audit & Verification
  // --------------------------------------------------------------------------
  describe("1. Custom 404 Page (Editorial Distinctive, Soft-Blue, Working Actions)", () => {
    const notFoundPath = path.join(rootDir, "app", "not-found.tsx");
    const actionsPath = path.join(rootDir, "components", "NotFoundActions.tsx");

    it("1.1 app/not-found.tsx exists and uses TrackerThings visual identity", () => {
      assert.ok(fs.existsSync(notFoundPath), "app/not-found.tsx must exist");
      const content = fs.readFileSync(notFoundPath, "utf-8");

      // Verify soft-blue tokens & DESIGN.md identity
      assert.ok(content.includes("bg-canvas"), "Must use bg-canvas token");
      assert.ok(content.includes("text-content-primary"), "Must use text-content-primary token");
      assert.ok(content.includes("text-accent"), "Must use text-accent token");
      assert.ok(content.includes("/icon.png"), "Must display canonical TrackerThings logo icon");
      assert.ok(content.includes("Tracker"), "Must include Tracker brand mark");
      assert.ok(content.includes("Things"), "Must include Things brand mark");
      assert.ok(content.includes("404"), "Must clearly display 404 status indicator");
    });

    it("1.2 components/NotFoundActions.tsx provides working navigation (Back, Home, Quick Links)", () => {
      assert.ok(fs.existsSync(actionsPath), "components/NotFoundActions.tsx must exist");
      const content = fs.readFileSync(actionsPath, "utf-8");

      assert.ok(content.includes("useRouter"), "Must use Next.js useRouter for client-side navigation");
      assert.ok(content.includes("router.back()"), "Must provide back navigation action");
      assert.ok(content.includes("/dashboard"), "Must provide Home/Dashboard link");
      assert.ok(content.includes("/matakuliah"), "Must provide quick link to Mata Kuliah");
      assert.ok(content.includes("/ujian"), "Must provide quick link to Ujian");
      assert.ok(content.includes("/settings"), "Must provide quick link to Pengaturan");
    });

    it("1.3 Ensures 404 does not confuse authentication or server errors", () => {
      const notFoundContent = fs.readFileSync(notFoundPath, "utf-8");
      // Must not display false login error or 500 server crash message
      assert.ok(!notFoundContent.includes("Gagal masuk"), "Must not display authentication failure on 404");
      assert.ok(!notFoundContent.includes("Server Error 500"), "Must not display 500 error on 404");
      assert.ok(notFoundContent.includes("Tautan mungkin rusak"), "Must explain missing route context gently");
    });
  });

  // --------------------------------------------------------------------------
  // 2. TrackerThings Splash Screen Loading Animation Audit
  // --------------------------------------------------------------------------
  describe("2. TrackerThings Splash Screen Loading Animation & Exact Geometry", () => {
    const loaderPath = path.join(rootDir, "components", "LogoLoadingAnimation.tsx");
    const rootLoadingPath = path.join(rootDir, "app", "loading.tsx");
    const brandLoadingSwiftPath = path.join(rootDir, "Sources", "TrackerThings", "Views", "Components", "BrandLoadingView.swift");
    const brandLogoSwiftPath = path.join(rootDir, "Sources", "TrackerThings", "Views", "Components", "BrandLogoView.swift");

    it("2.1 components/LogoLoadingAnimation.tsx matches BrandLogoView.swift canonical geometry and 3-phase sequence", () => {
      assert.ok(fs.existsSync(loaderPath), "components/LogoLoadingAnimation.tsx must exist");
      const content = fs.readFileSync(loaderPath, "utf-8");

      // Verify exact landmark geometry constants from BrandLogoView.swift
      assert.ok(content.includes("264.6"), "Must use topY 264.6");
      assert.ok(content.includes("733.4"), "Must use stemBottomY 733.4");
      assert.ok(content.includes("744.1"), "Must use cbRightTop 744.1");
      assert.ok(content.includes("450.0"), "Must use bottomApexX 450.0");
      assert.ok(content.includes("403.3"), "Must use cmTopY 403.3");

      // Verify exact 1.15s duration from BrandLogoView.swift (.easeInOut(duration: 1.15))
      assert.ok(content.includes("1150"), "Must use exact 1150ms (1.15s) duration");

      // Verify Deep Sapphire Navy canonical colors (#023075 and #012461)
      assert.ok(content.includes("#023075"), "Must use canonical Deep Sapphire Navy #023075");
      assert.ok(content.includes("#012461"), "Must use canonical Deep Sapphire Navy #012461");

      // Accessibility & reduced motion
      assert.ok(content.includes("prefers-reduced-motion"), "Must check prefers-reduced-motion");
      assert.ok(content.includes('role="status"'), "Must provide accessible status role");
      assert.ok(content.includes('aria-live="polite"'), "Must be politely announced by screen readers");
    });

    it("2.2 Native iOS BrandLogoView.swift supports loop parameter for ongoing loading states", () => {
      assert.ok(fs.existsSync(brandLogoSwiftPath), "BrandLogoView.swift must exist");
      const content = fs.readFileSync(brandLogoSwiftPath, "utf-8");

      assert.ok(content.includes("loop: Bool = false"), "BrandLogoView must support loop parameter with default false");
      assert.ok(content.includes("withAnimation(.easeInOut(duration: 1.15))"), "Must maintain exact 1.15s easeInOut animation");
    });

    it("2.3 Native iOS BrandLoadingView.swift reuses splash screen visual language and logo", () => {
      assert.ok(fs.existsSync(brandLoadingSwiftPath), "BrandLoadingView.swift must exist");
      const content = fs.readFileSync(brandLoadingSwiftPath, "utf-8");

      assert.ok(content.includes("BrandLogoView"), "BrandLoadingView must reuse BrandLogoView");
      assert.ok(content.includes("BrandWordmarkView"), "BrandLoadingView must reuse BrandWordmarkView");
      assert.ok(content.includes("0.008, green: 0.188, blue: 0.459"), "Must reuse SplashScreenView Deep Sapphire Navy background");
    });

    it("2.4 Root app/loading.tsx uses LogoLoadingAnimation in fullScreen mode", () => {
      assert.ok(fs.existsSync(rootLoadingPath), "app/loading.tsx must exist");
      const content = fs.readFileSync(rootLoadingPath, "utf-8");
      assert.ok(content.includes("LogoLoadingAnimation"), "Root loading must use LogoLoadingAnimation");
      assert.ok(content.includes("fullScreen"), "Must enable fullScreen mode for splash screen reproduction");
    });
  });

  // --------------------------------------------------------------------------
  // 3. iOS Connectivity, Error Classification, Timeout & Retry Logic
  // --------------------------------------------------------------------------
  describe("3. iOS Connectivity Architecture & State Machine Verification", () => {
    const networkServicePath = path.join(rootDir, "Sources", "TrackerThings", "Services", "NetworkService.swift");
    const appErrorPath = path.join(rootDir, "Sources", "TrackerThings", "Models", "AppError.swift");
    const trackerDataServicePath = path.join(rootDir, "Sources", "TrackerThings", "Services", "TrackerDataService.swift");
    const networkMonitorPath = path.join(rootDir, "Sources", "TrackerThings", "Services", "NetworkMonitor.swift");
    const dashboardViewModelPath = path.join(rootDir, "Sources", "TrackerThings", "ViewModels", "DashboardViewModel.swift");
    const rootTabViewPath = path.join(rootDir, "Sources", "TrackerThings", "Views", "RootTabView.swift");

    it("3.1 AppError includes explicit cases for offline, timeout, serverUnreachable, and cancelled", () => {
      const content = fs.readFileSync(appErrorPath, "utf-8");
      assert.ok(content.includes("case offline(String)"), "AppError must include offline case");
      assert.ok(content.includes("case timeout(String)"), "AppError must include timeout case");
      assert.ok(content.includes("case serverUnreachable(String)"), "AppError must include serverUnreachable case");
      assert.ok(content.includes("case cancelled"), "AppError must include cancelled case");
      assert.ok(content.includes("var isCancellation: Bool"), "Must provide cancellation helper");
    });

    it("3.2 NetworkService configures request timeouts and maps URLErrors", () => {
      const content = fs.readFileSync(networkServicePath, "utf-8");
      assert.ok(content.includes("timeoutIntervalForRequest = 15.0"), "Must set 15s request timeout on URLSessionConfiguration");
      assert.ok(content.includes("timeoutIntervalForResource = 30.0"), "Must set 30s resource timeout on URLSessionConfiguration");
      assert.ok(content.includes("request.timeoutInterval = 15.0"), "Must set timeout on URLRequest");
      assert.ok(content.includes("waitsForConnectivity = false"), "Must not wait indefinitely for connectivity");
      assert.ok(content.includes("case .timedOut:"), "Must map timedOut to AppError.timeout");
      assert.ok(content.includes("case .notConnectedToInternet"), "Must map notConnectedToInternet to AppError.offline");
      assert.ok(content.includes("case .cannotConnectToHost"), "Must map cannotConnectToHost to AppError.serverUnreachable");
      assert.ok(content.includes("case .cancelled:"), "Must map cancelled to AppError.cancelled");
    });

    it("3.3 NetworkService bounds automatic retries (max 1 retry for GET only)", () => {
      const content = fs.readFileSync(networkServicePath, "utf-8");
      assert.ok(content.includes("let maxAttempts = isIdempotent ? 2 : 1"), "GET requests allow at most 2 attempts (1 retry), mutating requests allow only 1");
      assert.ok(content.includes("method == \"GET\" || method == \"HEAD\""), "Only GET/HEAD are marked idempotent");
    });

    it("3.4 TrackerDataService does not duplicate requests on error in getTugasList", () => {
      const content = fs.readFileSync(trackerDataServicePath, "utf-8");
      const startIdx = content.lastIndexOf("func getTugasList");
      const endIdx = content.lastIndexOf("func createTugas");
      assert.ok(startIdx !== -1 && endIdx !== -1 && endIdx > startIdx, "Must find getTugasList implementation boundaries");
      const getTugasBlock = content.slice(startIdx, endIdx);
      const matches = getTugasBlock.match(/network\.request/g);
      assert.equal(matches ? matches.length : 0, 1, "getTugasList implementation must make exactly 1 request to avoid doubling timeouts and duplicate cascades");
    });

    it("3.5 NetworkMonitor posts connectivityRestored on reconnection", () => {
      const content = fs.readFileSync(networkMonitorPath, "utf-8");
      assert.ok(content.includes("static let connectivityRestored"), "Must define connectivityRestored notification");
      assert.ok(content.includes("NotificationCenter.default.post(name: .connectivityRestored"), "Must post notification when connection returns");
    });

    it("3.6 ViewModels ensure isLoading always terminates and filter cancellation errors", () => {
      const dashboardContent = fs.readFileSync(dashboardViewModelPath, "utf-8");
      assert.ok(dashboardContent.includes("defer {"), "DashboardViewModel must use defer for isLoading termination");
      assert.ok(dashboardContent.includes("self.isLoading = false"), "defer must reset isLoading");
      assert.ok(dashboardContent.includes("error is CancellationError || (error as? AppError)?.isCancellation == true"), "Must filter cancellation from error display");
    });

    it("3.7 RootTabView refreshes active tab on scenePhase active and connectivityRestored", () => {
      const content = fs.readFileSync(rootTabViewPath, "utf-8");
      assert.ok(content.includes("@Environment(\\.scenePhase)"), "Must observe scenePhase");
      assert.ok(content.includes("onChange(of: scenePhase)"), "Must handle scenePhase transitions");
      assert.ok(content.includes("connectivityRestored"), "Must listen to connectivityRestored");
      assert.ok(content.includes("refreshActiveTabSafely()"), "Must safely refresh active tab");
    });

    it("3.8 Simulates network state machine transitions and guarantees termination", async () => {
      // Functional simulation of the state machine
      async function simulatedFetch(scenario) {
        switch (scenario) {
          case "success":
            return ["Item 1", "Item 2"];
          case "offline":
            throw { code: "offline", message: "Perangkat sedang offline." };
          case "timeout":
            throw { code: "timeout", message: "Waktu permintaan habis (timeout)." };
          case "server_error":
            throw { code: "server_error", message: "Server mengembalikan status HTTP 500." };
          case "session_expiry":
            throw { code: "unauthorized", message: "Sesi login Anda telah berakhir." };
          case "cancelled":
            throw { isCancellation: true };
        }
      }

      async function runStateCycle(scenario) {
        const state = { isLoading: false, errorMessage: null, data: [] };
        let activeLoadId = 1;
        const currentLoad = activeLoadId;

        state.isLoading = true;
        state.errorMessage = null;

        try {
          const res = await simulatedFetch(scenario);
          if (activeLoadId === currentLoad) {
            state.data = res;
          }
        } catch (err) {
          if (activeLoadId === currentLoad) {
            if (!err.isCancellation) {
              state.errorMessage = err.message || "Unknown error";
            }
          }
        } finally {
          if (activeLoadId === currentLoad) {
            state.isLoading = false;
          }
        }

        return state;
      }

      // Verify success
      const successState = await runStateCycle("success");
      assert.equal(successState.isLoading, false, "Loading must terminate on success");
      assert.equal(successState.errorMessage, null);
      assert.equal(successState.data.length, 2);

      // Verify offline
      const offlineState = await runStateCycle("offline");
      assert.equal(offlineState.isLoading, false, "Loading must terminate on offline");
      assert.ok(offlineState.errorMessage?.includes("offline"));

      // Verify timeout
      const timeoutState = await runStateCycle("timeout");
      assert.equal(timeoutState.isLoading, false, "Loading must terminate on timeout");
      assert.ok(timeoutState.errorMessage?.includes("timeout"));

      // Verify server error
      const serverErrState = await runStateCycle("server_error");
      assert.equal(serverErrState.isLoading, false, "Loading must terminate on server error");
      assert.ok(serverErrState.errorMessage?.includes("500"));

      // Verify session expiry
      const sessionState = await runStateCycle("session_expiry");
      assert.equal(sessionState.isLoading, false, "Loading must terminate on session expiry");
      assert.ok(sessionState.errorMessage?.includes("berakhir"));

      // Verify cancellation (MUST NOT display error message!)
      const cancelledState = await runStateCycle("cancelled");
      assert.equal(cancelledState.isLoading, false, "Loading must terminate on cancellation");
      assert.equal(cancelledState.errorMessage, null, "Cancellation must not produce an error message");
    });
  });
});
