"use client";

import { useState, useCallback } from "react";
import { PlacementResult } from "@/lib/types";

export function useAI() {
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<PlacementResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const api = typeof window !== "undefined" ? window.electronAPI : null;

  const submitNote = useCallback(async (content: string, tags?: string[], source?: string) => {
    if (!api) return;
    setAnalyzing(true);
    setError(null);
    setResult(null);
    try {
      const response = await api.dbSubmitNote(content, tags, source);
      if (response.aiResult) {
        setResult(response.aiResult);
      } else if (response.aiError) {
        setError(response.aiError);
      }
      return response;
    } catch (err: any) {
      setError(err.message);
    } finally {
      setAnalyzing(false);
    }
  }, [api]);

  const confirmPlacement = useCallback(async (inboxId: number, nodeId: number | null, adjustments?: any) => {
    if (!api) return;
    try {
      return await api.dbConfirmPlacement(inboxId, nodeId, adjustments);
    } catch (err: any) {
      setError(err.message);
    }
  }, [api]);

  return { analyzing, result, error, submitNote, confirmPlacement };
}
