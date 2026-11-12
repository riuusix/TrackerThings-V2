"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

export const INVISIBLE_PAGINATION_PAGE_SIZE = 3;

export interface InvisibleTaskDeckProps<T> {
  /** Full or current collection of items to chunk into pages of 3. */
  items: T[];
  /** Unique key extractor for each item. */
  getItemKey: (item: T) => string | number;
  /** Render function for a single task item. */
  renderItem: (item: T, indexInPage: number) => React.ReactNode;
  /** Maximum items visible per deck page (defaults to 3). */
  pageSize?: number;
  /** Optional controlled page index (0-based). */
  currentPage?: number;
  /** Optional callback when page index changes (0-based). */
  onPageChange?: (nextPage: number) => void;
  /** Accessible label for the deck region. */
  ariaLabel: string;
  /** Optional empty state element when items is empty. */
  emptyState?: React.ReactNode;
  /** Optional callback fired when user lands on `page`, allowing selective prefetch of `page + 1`. */
  onPrefetchPage?: (nextPageIndex: number) => void;
}

/**
 * Pure helper exported for deterministic unit tests:
 * slices an array into pages of at most `pageSize` (default 3) items.
 */
export function chunkIntoInvisiblePages<T>(
  items: readonly T[],
  pageSize: number = INVISIBLE_PAGINATION_PAGE_SIZE
): T[][] {
  const safeSize = Math.max(1, Math.floor(pageSize));
  if (!items || items.length === 0) return [];
  const pages: T[][] = [];
  for (let i = 0; i < items.length; i += safeSize) {
    pages.push(items.slice(i, i + safeSize));
  }
  return pages;
}

/**
 * Pure directional gesture classifier exported for unit tests:
 * returns -1 (swipe right -> previous page), +1 (swipe left -> next page), or 0 (ignore / vertical scroll).
 */
export function evaluateHorizontalDeckSwipe(
  deltaX: number,
  deltaY: number,
  minDistancePx = 38,
  horizontalRatio = 1.35
): -1 | 0 | 1 {
  const absX = Math.abs(deltaX);
  const absY = Math.abs(deltaY);
  if (absX < minDistancePx) return 0;
  if (absX <= absY * horizontalRatio) return 0;
  return deltaX < 0 ? 1 : -1;
}

export function InvisibleTaskDeck<T>({
  items,
  getItemKey,
  renderItem,
  pageSize = INVISIBLE_PAGINATION_PAGE_SIZE,
  currentPage: controlledPage,
  onPageChange,
  ariaLabel,
  emptyState,
  onPrefetchPage,
}: InvisibleTaskDeckProps<T>) {
  const pages = chunkIntoInvisiblePages(items, pageSize);
  const totalPages = Math.max(1, pages.length);

  const [internalPage, setInternalPage] = useState(0);
  const [slideDirection, setSlideDirection] = useState<"next" | "prev" | null>(null);
  const [dragOffsetX, setDragOffsetX] = useState(0);

  const activePage = Math.min(
    totalPages - 1,
    Math.max(0, controlledPage !== undefined ? controlledPage : internalPage)
  );

  // Clamp page index automatically if items shrink (e.g. after completing or unpinning a task)
  useEffect(() => {
    if (controlledPage === undefined && internalPage >= totalPages) {
      setInternalPage(Math.max(0, totalPages - 1));
    }
  }, [totalPages, controlledPage, internalPage]);

  // Selective next-page prefetch hook
  useEffect(() => {
    if (activePage + 1 < totalPages) {
      onPrefetchPage?.(activePage + 1);
    }
  }, [activePage, totalPages, onPrefetchPage]);

  const goToPage = useCallback(
    (target: number) => {
      const clamped = Math.min(totalPages - 1, Math.max(0, target));
      if (clamped === activePage) return;
      setSlideDirection(clamped > activePage ? "next" : "prev");
      if (controlledPage === undefined) {
        setInternalPage(clamped);
      }
      onPageChange?.(clamped);
    },
    [activePage, totalPages, controlledPage, onPageChange]
  );

  // Touch / Pointer swipe tracking (direction-locked so vertical scroll is never blocked)
  const touchStartRef = useRef<{ x: number; y: number; isInteractiveTarget: boolean } | null>(null);

  const isInteractiveElement = (target: EventTarget | null): boolean => {
    if (!(target instanceof HTMLElement)) return false;
    return Boolean(target.closest('input[type="range"], button, a, select, textarea'));
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (totalPages <= 1 || e.touches.length !== 1) return;
    const touch = e.touches[0];
    touchStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      isInteractiveTarget: isInteractiveElement(e.target),
    };
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    const start = touchStartRef.current;
    if (!start || start.isInteractiveTarget || totalPages <= 1 || e.touches.length !== 1) return;
    const touch = e.touches[0];
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;

    if (Math.abs(dx) > 16 && Math.abs(dx) > Math.abs(dy) * 1.35) {
      // Apply subtle rubber-band resistance at deck boundaries
      const atBoundary = (activePage === 0 && dx > 0) || (activePage === totalPages - 1 && dx < 0);
      const damped = atBoundary ? dx * 0.22 : Math.max(-56, Math.min(56, dx * 0.45));
      setDragOffsetX(damped);
    }
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    const start = touchStartRef.current;
    touchStartRef.current = null;
    setDragOffsetX(0);

    if (!start || start.isInteractiveTarget || totalPages <= 1 || e.changedTouches.length === 0) {
      return;
    }

    const touch = e.changedTouches[0];
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    const outcome = evaluateHorizontalDeckSwipe(dx, dy);

    if (outcome === 1 && activePage < totalPages - 1) {
      goToPage(activePage + 1);
    } else if (outcome === -1 && activePage > 0) {
      goToPage(activePage - 1);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (totalPages <= 1) return;
    if (isInteractiveElement(e.target)) return;
    if (e.key === "ArrowRight" && activePage < totalPages - 1) {
      e.preventDefault();
      goToPage(activePage + 1);
    } else if (e.key === "ArrowLeft" && activePage > 0) {
      e.preventDefault();
      goToPage(activePage - 1);
    }
  };

  if (items.length === 0) {
    return <>{emptyState || null}</>;
  }

  const visibleItems = pages[activePage] || [];
  const startItemNumber = activePage * pageSize + 1;
  const endItemNumber = Math.min(items.length, startItemNumber + visibleItems.length - 1);

  return (
    <section
      aria-label={ariaLabel}
      tabIndex={totalPages > 1 ? 0 : -1}
      onKeyDown={handleKeyDown}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className="relative select-none outline-none focus-visible:ring-2 focus-visible:ring-accent/60 rounded-2xl"
      style={{ touchAction: "pan-y" }}
    >
      {/* Active 3-Task Deck Viewport */}
      <div
        key={`deck-page-${activePage}`}
        style={{
          transform: dragOffsetX !== 0 ? `translate3d(${dragOffsetX}px, 0, 0)` : "translate3d(0, 0, 0)",
          transition:
            dragOffsetX !== 0
              ? "none"
              : "transform 240ms cubic-bezier(0.22, 1, 0.36, 1), opacity 200ms cubic-bezier(0.22, 1, 0.36, 1)",
        }}
        className={`space-y-3 ${
          slideDirection === "next"
            ? "animate-in fade-in-50 slide-in-from-right-2 duration-200"
            : slideDirection === "prev"
            ? "animate-in fade-in-50 slide-in-from-left-2 duration-200"
            : ""
        }`}
      >
        {visibleItems.map((item, idx) => (
          <React.Fragment key={getItemKey(item)}>{renderItem(item, idx)}</React.Fragment>
        ))}
      </div>

      {/* Subtle Integrated Invisible-Pagination Footer (only rendered when > 3 items exist) */}
      {totalPages > 1 && (
        <div
          className="mt-3 pt-2 px-1 flex items-center justify-between gap-3 text-xs text-content-secondary"
          role="navigation"
          aria-label={`Navigasi grup ${ariaLabel}`}
        >
          {/* Left: Subtle Range & Position Indicator */}
          <div className="flex items-center gap-2.5">
            <span
              className="font-mono tabular-nums text-[11px] font-semibold text-content-muted"
              aria-live="polite"
            >
              {startItemNumber}–{endItemNumber} dari {items.length}
            </span>

            {/* Minimal Capsule Progress Dots */}
            <div className="flex items-center gap-1" role="tablist" aria-label="Pilih grup halaman">
              {pages.map((_, idx) => {
                const isCurrent = idx === activePage;
                return (
                  <button
                    key={idx}
                    type="button"
                    role="tab"
                    aria-selected={isCurrent}
                    aria-label={`Grup ${idx + 1} dari ${totalPages}`}
                    onClick={() => goToPage(idx)}
                    className={`h-1.5 rounded-full transition-all duration-200 ${
                      isCurrent
                        ? "w-5 bg-accent"
                        : "w-1.5 bg-line-strong/60 hover:bg-content-muted"
                    }`}
                  />
                );
              })}
            </div>
          </div>

          {/* Right: Accessible Tactile Prev / Next Controls + Swipe Hint */}
          <div className="flex items-center gap-1.5">
            <span className="hidden sm:inline text-[11px] text-content-muted mr-1">
              Geser atau pilih
            </span>
            <button
              type="button"
              onClick={() => goToPage(activePage - 1)}
              disabled={activePage === 0}
              aria-label="Halaman tugas sebelumnya"
              className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-surface-elevated hover:bg-surface border border-line text-content-primary disabled:opacity-35 disabled:pointer-events-none transition-all duration-150 active:scale-95 shadow-2xs"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="font-mono tabular-nums text-[11px] font-bold text-content-primary min-w-[34px] text-center">
              {activePage + 1}/{totalPages}
            </span>
            <button
              type="button"
              onClick={() => goToPage(activePage + 1)}
              disabled={activePage >= totalPages - 1}
              aria-label="Halaman tugas berikutnya"
              className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-surface-elevated hover:bg-surface border border-line text-content-primary disabled:opacity-35 disabled:pointer-events-none transition-all duration-150 active:scale-95 shadow-2xs"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

