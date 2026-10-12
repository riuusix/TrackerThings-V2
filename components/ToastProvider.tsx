"use client";

import React, { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from "lucide-react";
import { FeedbackSeverity, FeedbackMessage } from "@/lib/feedback";

interface ToastContextType {
  showToast: (msg: {
    message: string;
    title?: string;
    severity?: FeedbackSeverity;
    actionLabel?: string;
    onAction?: () => void;
    durationMs?: number;
  }) => void;
  dismissToast: (id: string) => void;
  showSuccess: (message: string, title?: string) => void;
  showError: (message: string, title?: string) => void;
  showWarning: (message: string, title?: string) => void;
  showInfo: (message: string, title?: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<FeedbackMessage[]>([]);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    ({
      message,
      title,
      severity = "info",
      actionLabel,
      onAction,
      durationMs,
    }: {
      message: string;
      title?: string;
      severity?: FeedbackSeverity;
      actionLabel?: string;
      onAction?: () => void;
      durationMs?: number;
    }) => {
      // Prevent exact duplicate notifications from flooding
      setToasts((prev) => {
        const isDuplicate = prev.some((t) => t.message === message && t.severity === severity);
        if (isDuplicate) return prev;

        const id = `toast_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        const autoDuration =
          durationMs !== undefined
            ? durationMs
            : severity === "error"
            ? 7000 // Errors stay longer to be read
            : severity === "warning"
            ? 5500
            : 3800; // Success/Info dismiss faster

        const newToast: FeedbackMessage = {
          id,
          title,
          message,
          severity,
          actionLabel,
          onAction,
          durationMs: autoDuration,
        };

        // Keep maximum 3 toasts stacked at once
        const nextList = [...prev.slice(-2), newToast];

        if (autoDuration > 0) {
          setTimeout(() => {
            dismissToast(id);
          }, autoDuration);
        }

        return nextList;
      });
    },
    [dismissToast]
  );

  const showSuccess = useCallback((msg: string, title?: string) => {
    showToast({ message: msg, title, severity: "success" });
  }, [showToast]);

  const showError = useCallback((msg: string, title?: string) => {
    showToast({ message: msg, title, severity: "error" });
  }, [showToast]);

  const showWarning = useCallback((msg: string, title?: string) => {
    showToast({ message: msg, title, severity: "warning" });
  }, [showToast]);

  const showInfo = useCallback((msg: string, title?: string) => {
    showToast({ message: msg, title, severity: "info" });
  }, [showToast]);

  return (
    <ToastContext.Provider
      value={{
        showToast,
        dismissToast,
        showSuccess,
        showError,
        showWarning,
        showInfo,
      }}
    >
      {children}
      {/* Toast Render Viewport: Top-Right on Desktop, Top-Center on Mobile */}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="fixed top-4 sm:top-5 inset-x-3 sm:inset-x-auto sm:right-5 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none mx-auto sm:mx-0"
      >
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDismiss={() => dismissToast(toast.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: FeedbackMessage;
  onDismiss: () => void;
}) {
  const getIcon = () => {
    switch (toast.severity) {
      case "success":
        return <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />;
      case "error":
        return <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />;
      case "warning":
        return <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />;
      default:
        return <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />;
    }
  };

  const getBorderAndBg = () => {
    switch (toast.severity) {
      case "success":
        return "border-emerald-200/90 dark:border-emerald-800/60 bg-white/95 dark:bg-slate-900/95 text-slate-800 dark:text-slate-100 shadow-md shadow-slate-900/5";
      case "error":
        return "border-rose-200/90 dark:border-rose-800/60 bg-white/95 dark:bg-slate-900/95 text-slate-800 dark:text-slate-100 shadow-md shadow-slate-900/5";
      case "warning":
        return "border-amber-200/90 dark:border-amber-800/60 bg-white/95 dark:bg-slate-900/95 text-slate-800 dark:text-slate-100 shadow-md shadow-slate-900/5";
      default:
        return "border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 text-slate-800 dark:text-slate-100 shadow-md shadow-slate-900/5";
    }
  };

  return (
    <div
      role={toast.severity === "error" ? "alert" : "status"}
      className={`pointer-events-auto p-3.5 rounded-2xl border backdrop-blur-md flex items-start gap-3 transition-all duration-200 transform translate-y-0 opacity-100 animate-in fade-in slide-in-from-top-3 ${getBorderAndBg()}`}
    >
      <div className="mt-0.5">{getIcon()}</div>
      <div className="flex-1 min-w-0">
        {toast.title && (
          <p className="text-xs font-bold tracking-tight text-slate-900 dark:text-white mb-0.5">
            {toast.title}
          </p>
        )}
        <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300 break-words font-medium">
          {toast.message}
        </p>
        {toast.actionLabel && toast.onAction && (
          <button
            type="button"
            onClick={() => {
              toast.onAction?.();
              onDismiss();
            }}
            className="mt-2 text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline"
          >
            {toast.actionLabel}
          </button>
        )}
      </div>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Tutup notifikasi"
        className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}

