"use client";

import { useState, useEffect, useCallback } from "react";
import { Tag } from "@/lib/types";

export function useTags() {
  const [tags, setTags] = useState<Tag[]>([]);
  const api = typeof window !== "undefined" ? window.electronAPI : null;

  const loadTags = useCallback(async () => {
    if (!api) return;
    try {
      const data = await api.dbGetTags();
      setTags(data || []);
    } catch {}
  }, [api]);

  useEffect(() => {
    loadTags();
  }, [loadTags]);

  return { tags, loadTags };
}
