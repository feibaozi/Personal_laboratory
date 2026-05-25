"use client";

import { useState, useRef, useEffect, FormEvent } from "react";

interface MoodInputProps {
  onSubmit: (text: string) => void;
  isLoading: boolean;
}

export default function MoodInput({ onSubmit, isLoading }: MoodInputProps) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed || isLoading) return;
    onSubmit(trimmed);
  };

  return (
    <form onSubmit={handleSubmit} className="relative w-full max-w-xl">
      <div className="relative group">
        <div
          className="absolute -inset-1 rounded-2xl opacity-0 group-focus-within:opacity-100 transition-opacity duration-500 blur-md"
          style={{
            background:
              "linear-gradient(135deg, rgba(99, 102, 241, 0.4), rgba(168, 85, 247, 0.4), rgba(236, 72, 153, 0.4))",
          }}
        />
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="你现在感觉怎么样？"
          disabled={isLoading}
          className="relative w-full px-6 py-5 text-lg rounded-xl glass
                     text-white placeholder-white/40 outline-none
                     disabled:opacity-50 transition-all duration-300
                     focus:bg-white/[0.08]"
        />
        {value && !isLoading && (
          <button
            type="submit"
            className="absolute right-3 top-1/2 -translate-y-1/2
                       w-10 h-10 rounded-lg bg-white/10 hover:bg-white/20
                       flex items-center justify-center transition-colors"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </button>
        )}
        {isLoading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="w-6 h-6 border-2 border-white/30 border-t-white/80 rounded-full animate-spin" />
          </div>
        )}
      </div>
      <p className="mt-3 text-center text-white/30 text-sm">
        试试说 &ldquo;下雨天有点忧郁&rdquo; 或 &ldquo;刚跑完步很兴奋&rdquo;
      </p>
    </form>
  );
}