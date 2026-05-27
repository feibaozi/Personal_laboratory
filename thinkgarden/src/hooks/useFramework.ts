"use client";

import { useState, useEffect, useCallback } from "react";
import { FrameworkNode } from "@/lib/types";

export function useFramework() {
  const [tree, setTree] = useState<FrameworkNode | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const api = typeof window !== "undefined" ? window.electronAPI : null;

  const loadFramework = useCallback(async () => {
    if (!api) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api.dbGetFramework();
      setTree(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [api]);

  const initFramework = useCallback(async () => {
    if (!api) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api.dbInitFramework();
      setTree(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    loadFramework();
  }, [loadFramework]);

  return { tree, loading, error, loadFramework, initFramework };
}
