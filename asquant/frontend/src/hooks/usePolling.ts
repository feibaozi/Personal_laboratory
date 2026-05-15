import { useEffect, useRef, useState } from "react";
import { api } from "@/api/client";

export function useMarketStatus() {
  const [marketOpen, setMarketOpen] = useState(false);

  useEffect(() => {
    let active = true;
    const check = async () => {
      try {
        const res = await api.get<{ market_open: boolean }>("/market/status");
        if (active) setMarketOpen(res.market_open);
      } catch {}
    };
    check();
    const id = setInterval(check, 30000);
    return () => { active = false; clearInterval(id); };
  }, []);

  return marketOpen;
}

export function usePolling(callback: () => void, fastMs: number, slowMs: number, enabled = true) {
  const savedCallback = useRef(callback);
  savedCallback.current = callback;
  const marketOpen = useMarketStatus();
  const intervalMs = marketOpen ? fastMs : slowMs;

  useEffect(() => {
    if (!enabled) return;
    savedCallback.current();
    const id = setInterval(() => savedCallback.current(), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs, enabled]);
}
