"use client";

import { useState, useEffect, useCallback } from "react";
import { SearchResult } from "@/lib/types";

export function useSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [aiSearchUsed, setAiSearchUsed] = useState(false);
  const [aiExplanation, setAiExplanation] = useState("");
  const api = typeof window !== "undefined" ? window.electronAPI : null;

  const search = useCallback(async (q: string) => {
    if (!api || !q.trim()) {
      setResults([]);
      setAiSearchUsed(false);
      setAiExplanation("");
      return;
    }
    setSearching(true);
    try {
      const data = await api.dbSearch(q.trim());
      const searchResults = data || [];
      setResults(searchResults);

      if (searchResults.length === 0 && q.trim().length > 4) {
        try {
          const aiResult = await api.aiSearch(q.trim());
          if (aiResult && aiResult.matchedNodeIds && aiResult.matchedNodeIds.length > 0) {
            const enrichedResults: SearchResult[] = [];
            for (const nodeId of aiResult.matchedNodeIds) {
              const node = await api.dbGetNode(nodeId);
              if (node) {
                enrichedResults.push({
                  nodeId: node.id,
                  title: node.title,
                  summary: node.summary,
                  nodeType: node.node_type,
                  path: [],
                  snippet: node.content?.substring(0, 100) || "",
                });
              }
            }
            setResults(enrichedResults);
            setAiSearchUsed(true);
            setAiExplanation(aiResult.aiExplanation || "");
          }
        } catch {
          setAiSearchUsed(false);
        }
      } else {
        setAiSearchUsed(false);
        setAiExplanation("");
      }
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }, [api]);

  useEffect(() => {
    const timer = setTimeout(() => {
      search(query);
    }, 300);
    return () => clearTimeout(timer);
  }, [query, search]);

  return { query, setQuery, results, searching, aiSearchUsed, aiExplanation };
}
