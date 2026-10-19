"use client";

import React, { useEffect, useState, useRef, useId } from "react";

export interface LogoLoadingAnimationProps {
  /** Size in pixels (default: 80) or preset string */
  size?: "sm" | "md" | "lg" | "xl" | number;
  /** Optional loading message displayed underneath */
  label?: string;
  /** Optional secondary subtitle */
  sublabel?: string;
  /** Whether to show the TrackerThings wordmark (default: true) */
  showWordmark?: boolean;
  /** Whether to fill the entire screen with the canonical Deep Sapphire (#023075) background */
  fullScreen?: boolean;
  /** Whether the animation should loop continuously while loading (default: true) */
  loop?: boolean;
  /** Custom extra CSS classes */
  className?: string;
}

// Canonical landmark geometry from BrandLogoView.swift (scale 0..1000)
const GEO = {
  topY: 264.6,
  cbBotY: 353.5,
  cbLeft: 252.0,
  cbRightTop: 744.1,
  cbRightBot: 668.9,

  stemLeft: 398.4,
  stemRight: 491.2,
  stemJoinY: 551.8,
  stemBottomY: 733.4,
  bottomApexX: 450.0,

  cmTopY: 403.3,
  cmInnerX: 611.3,
  cmOuterX: 722.7,

  rCorner: 10.0,
  rStemBottom: 24.0,
};

/**
 * Computes SVG path string for TrackerThings canonical monogram based on progress [0..1]
 * Exactly mirrors BrandLogoMonogramShape.path(in:) from BrandLogoView.swift:
 * - Phase 1 (0.00..0.33): Batang vertikal "I" dari atas ke bawah
 * - Phase 2 (0.33..0.66): Palang horizontal "T" dari kiri ke kanan dengan terminal 45°
 * - Phase 3 (0.66..1.00): Sayap centang dari apex dasar ke kanan atas
 */
export function getMonogramPath(progress: number): string {
  const p = Math.min(Math.max(progress, 0), 1);
  if (p <= 0) return "";

  let d = "";
  const pStem = Math.min(Math.max(p / 0.33, 0), 1);
  const pCb = Math.min(Math.max((p - 0.33) / 0.33, 0), 1);
  const pCm = Math.min(Math.max((p - 0.66) / 0.34, 0), 1);

  // 1. Subpath Batang Vertikal "I" (Fase 1)
  if (pStem > 0) {
    const currBottomY = GEO.topY + (GEO.stemBottomY - GEO.topY) * pStem;
    d += `M ${GEO.stemLeft.toFixed(1)} ${GEO.topY.toFixed(1)} `;
    d += `L ${GEO.stemRight.toFixed(1)} ${GEO.topY.toFixed(1)} `;

    if (pStem < 1) {
      d += `L ${GEO.stemRight.toFixed(1)} ${currBottomY.toFixed(1)} `;
      d += `L ${GEO.stemLeft.toFixed(1)} ${currBottomY.toFixed(1)} Z `;
    } else {
      d += `L ${GEO.stemRight.toFixed(1)} ${(GEO.stemBottomY - GEO.rStemBottom).toFixed(1)} `;
      d += `Q ${GEO.stemRight.toFixed(1)} ${GEO.stemBottomY.toFixed(1)} ${GEO.bottomApexX.toFixed(1)} ${GEO.stemBottomY.toFixed(1)} `;
      d += `Q ${GEO.stemLeft.toFixed(1)} ${GEO.stemBottomY.toFixed(1)} ${GEO.stemLeft.toFixed(1)} ${(GEO.stemBottomY - GEO.rStemBottom).toFixed(1)} Z `;
    }
  }

  // 2. Subpath Palang Horizontal "T" (Fase 2)
  if (pCb > 0) {
    const totalSpan = GEO.cbRightTop - GEO.cbLeft;
    const currX = GEO.cbLeft + totalSpan * pCb;

    d += `M ${(GEO.cbLeft + GEO.rCorner).toFixed(1)} ${GEO.topY.toFixed(1)} `;

    if (currX <= GEO.cbRightBot) {
      d += `L ${currX.toFixed(1)} ${GEO.topY.toFixed(1)} `;
      d += `L ${currX.toFixed(1)} ${GEO.cbBotY.toFixed(1)} `;
      d += `L ${(GEO.cbLeft + GEO.rCorner).toFixed(1)} ${GEO.cbBotY.toFixed(1)} `;
    } else {
      const alpha = (currX - GEO.cbRightBot) / (GEO.cbRightTop - GEO.cbRightBot);
      const currYSlant = GEO.cbBotY + (GEO.topY - GEO.cbBotY) * alpha;

      d += `L ${currX.toFixed(1)} ${GEO.topY.toFixed(1)} `;
      d += `L ${currX.toFixed(1)} ${currYSlant.toFixed(1)} `;
      d += `L ${GEO.cbRightBot.toFixed(1)} ${GEO.cbBotY.toFixed(1)} `;
      d += `L ${(GEO.cbLeft + GEO.rCorner).toFixed(1)} ${GEO.cbBotY.toFixed(1)} `;
    }

    d += `A ${GEO.rCorner} ${GEO.rCorner} 0 0 1 ${GEO.cbLeft.toFixed(1)} ${(GEO.cbBotY - GEO.rCorner).toFixed(1)} `;
    d += `L ${GEO.cbLeft.toFixed(1)} ${(GEO.topY + GEO.rCorner).toFixed(1)} `;
    d += `A ${GEO.rCorner} ${GEO.rCorner} 0 0 1 ${(GEO.cbLeft + GEO.rCorner).toFixed(1)} ${GEO.topY.toFixed(1)} Z `;
  }

  // 3. Subpath Sayap Centang (Fase 3)
  if (pCm > 0) {
    const currY = GEO.stemBottomY + (GEO.cmTopY - GEO.stemBottomY) * pCm;
    const alphaOut = (currY - GEO.stemBottomY) / (GEO.cmTopY - GEO.stemBottomY);
    const currXOut = GEO.bottomApexX + (GEO.cmOuterX - GEO.bottomApexX) * alphaOut;

    d += `M ${GEO.stemLeft.toFixed(1)} ${(GEO.stemBottomY - GEO.rStemBottom).toFixed(1)} `;
    d += `Q ${GEO.stemLeft.toFixed(1)} ${GEO.stemBottomY.toFixed(1)} ${GEO.bottomApexX.toFixed(1)} ${GEO.stemBottomY.toFixed(1)} `;
    d += `L ${currXOut.toFixed(1)} ${currY.toFixed(1)} `;

    if (currY >= GEO.stemJoinY) {
      d += `L ${GEO.stemRight.toFixed(1)} ${currY.toFixed(1)} `;
    } else {
      const alphaIn = (currY - GEO.stemJoinY) / (GEO.cmTopY - GEO.stemJoinY);
      const currXIn = GEO.stemRight + (GEO.cmInnerX - GEO.stemRight) * alphaIn;

      d += `L ${currXIn.toFixed(1)} ${currY.toFixed(1)} `;
      d += `L ${GEO.stemRight.toFixed(1)} ${GEO.stemJoinY.toFixed(1)} `;
    }

    d += `L ${GEO.stemRight.toFixed(1)} ${GEO.stemBottomY.toFixed(1)} `;
    d += `L ${GEO.stemLeft.toFixed(1)} ${GEO.stemBottomY.toFixed(1)} Z `;
  }

  return d.trim();
}

const sizeMap: Record<string, number> = {
  sm: 48,
  md: 64,
  lg: 80,
  xl: 96,
};

export function LogoLoadingAnimation({
  size = "lg",
  label = "Memuat TrackerThings...",
  sublabel = "Portal Manajemen Jadwal & Tugas Akademik",
  showWordmark = true,
  fullScreen = false,
  loop = true,
  className = "",
}: LogoLoadingAnimationProps) {
  const pixelSize = typeof size === "number" ? size : sizeMap[size] || 80;
  const gradientId = useId();

  // Animation state
  const [progress, setProgress] = useState(1);
  const [isClient, setIsClient] = useState(false);
  const animRef = useRef<number | null>(null);

  useEffect(() => {
    setIsClient(true);
    // Respect prefers-reduced-motion
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (mediaQuery.matches) {
      setProgress(1);
      return;
    }

    const DURATION = 1150; // Exact 1.15s duration from BrandLogoView.swift
    const HOLD = 650;      // Hold completed logo before loop
    const CYCLE = DURATION + HOLD;

    let startTime: number | null = null;

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const elapsed = timestamp - startTime;

      if (elapsed < DURATION) {
        // EaseInOut cubic timing curve matching SwiftUI .easeInOut(duration: 1.15)
        const t = elapsed / DURATION;
        const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
        setProgress(Math.max(0.01, Math.min(eased, 1)));
      } else if (elapsed < CYCLE) {
        setProgress(1);
      } else {
        if (loop) {
          startTime = timestamp;
          setProgress(0.01);
        } else {
          setProgress(1);
          return;
        }
      }

      animRef.current = requestAnimationFrame(animate);
    };

    animRef.current = requestAnimationFrame(animate);

    return () => {
      if (animRef.current) {
        cancelAnimationFrame(animRef.current);
      }
    };
  }, [loop]);

  const cornerRadius = pixelSize * 0.24;
  const pathD = getMonogramPath(isClient ? progress : 1);

  const content = (
    <div
      role="status"
      aria-live="polite"
      className={`flex flex-col items-center justify-center select-none ${className}`}
    >
      {/* Exact Native Monogram Container */}
      <div
        style={{
          width: pixelSize,
          height: pixelSize,
          borderRadius: cornerRadius,
          boxShadow: `0 ${pixelSize * 0.05}px ${pixelSize * 0.1}px rgba(0, 0, 0, 0.18)`,
        }}
        className="relative overflow-hidden shrink-0"
      >
        <svg
          viewBox="0 0 1000 1000"
          width={pixelSize}
          height={pixelSize}
          className="w-full h-full block"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            {/* Deep Sapphire Navy Kanonikal Gradient (#023075 -> #012461) */}
            <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#023075" />
              <stop offset="100%" stopColor="#012461" />
            </linearGradient>
          </defs>

          {/* Rounded Container Surface */}
          <rect
            width="1000"
            height="1000"
            rx="240"
            fill={`url(#${gradientId})`}
          />

          {/* Pure White Monogram Vector (Animated Sequential I -> T -> Checkmark) */}
          {pathD ? (
            <path d={pathD} fill="#FFFFFF" fillRule="evenodd" />
          ) : null}
        </svg>
      </div>

      {/* Wordmark (Tracker solid + Things glossy reflective gradient) */}
      {showWordmark && (
        <div className="mt-4 text-center">
          <div className="text-2xl sm:text-3xl font-extrabold tracking-tight font-sans">
            <span className={fullScreen ? "text-white" : "text-content-primary"}>
              Tracker
            </span>
            <span
              className="bg-gradient-to-br from-white via-sky-200 to-sky-400 bg-clip-text text-transparent font-extrabold"
              style={{
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              Things
            </span>
          </div>

          {sublabel && (
            <p
              className={`text-xs mt-1 max-w-xs mx-auto ${
                fullScreen ? "text-white/80" : "text-content-secondary"
              }`}
            >
              {sublabel}
            </p>
          )}
        </div>
      )}

      {/* Optional distinct loading message */}
      {label && label !== sublabel && (
        <p
          className={`text-xs mt-2 font-medium ${
            fullScreen ? "text-white/70" : "text-content-muted"
          }`}
        >
          {label}
        </p>
      )}

      <span className="sr-only">{label || "Memuat TrackerThings..."}</span>
    </div>
  );

  if (fullScreen) {
    return (
      <div
        style={{ backgroundColor: "#023075" }}
        className="fixed inset-0 z-50 flex flex-col items-center justify-center p-6 text-white"
      >
        {content}
      </div>
    );
  }

  return content;
}
