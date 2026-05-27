"use client";

import { useState, useEffect, useCallback } from "react";

interface Toast {
  id: number;
  message: string;
  type: "success" | "error" | "info";
}

let toastId = 0;
const listeners: Set<(toast: Toast) => void> = new Set();

export function showToast(message: string, type: "success" | "error" | "info" = "info") {
  const toast: Toast = { id: ++toastId, message, type };
  listeners.forEach((fn) => fn(toast));
}

export default function ToastContainer() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((toast: Toast) => {
    setToasts((prev) => [...prev, toast]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== toast.id));
    }, 4000);
  }, []);

  useEffect(() => {
    listeners.add(addToast);
    return () => {
      listeners.delete(addToast);
    };
  }, [addToast]);

  const typeStyles: Record<string, string> = {
    success: "bg-sentiment-positive/15 border-sentiment-positive/30 text-sentiment-positive",
    error: "bg-sentiment-negative/15 border-sentiment-negative/30 text-sentiment-negative",
    info: "bg-brand/15 border-brand/30 text-brand",
  };

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 space-y-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`px-4 py-3 rounded-lg border text-sm animate-slide-up ${
            typeStyles[toast.type] || typeStyles.info
          }`}
        >
          {toast.message}
        </div>
      ))}
    </div>
  );
}
