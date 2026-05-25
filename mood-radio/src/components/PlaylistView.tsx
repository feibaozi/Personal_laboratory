"use client";

import type { Song } from "@/lib/types";

interface PlaylistViewProps {
  songs: Song[];
  moodCn: string;
  currentIndex: number;
  onSelect: (index: number) => void;
  likedIds: string[];
  onToggleLike: (songId: string) => void;
}

export default function PlaylistView({
  songs,
  moodCn,
  currentIndex,
  onSelect,
  likedIds,
  onToggleLike,
}: PlaylistViewProps) {
  if (songs.length === 0) return null;

  return (
    <div className="animate-slide-up w-full max-w-xl">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-white/40 text-sm">为你找到</span>
        <span className="text-white/80 text-sm font-medium">
          {songs.length} 首
        </span>
        <span className="text-white/40 text-sm">
          适合 &ldquo;{moodCn}&rdquo; 的歌
        </span>
      </div>
      <div className="glass rounded-xl overflow-hidden max-h-64 overflow-y-auto">
        {songs.map((song, index) => {
          const isCurrent = index === currentIndex;
          const isLiked = likedIds.includes(song.id);

          return (
            <div
              key={song.id}
              onClick={() => onSelect(index)}
              className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-all duration-200 border-b border-white/5 last:border-b-0 ${
                isCurrent
                  ? "bg-white/10"
                  : "hover:bg-white/[0.04]"
              }`}
            >
              <span className="text-white/30 text-xs w-5 text-right tabular-nums">
                {index + 1}
              </span>
              {song.coverUrl ? (
                <img
                  src={song.coverUrl}
                  alt={song.name}
                  className="w-9 h-9 rounded-lg object-cover flex-shrink-0"
                />
              ) : (
                <div className="w-9 h-9 rounded-lg bg-white/10 flex-shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p
                  className={`text-sm font-medium truncate ${
                    isCurrent ? "text-white" : "text-white/70"
                  }`}
                >
                  {song.name}
                </p>
                <p className="text-white/40 text-xs truncate">
                  {song.artists}
                </p>
              </div>
              {isCurrent && (
                <div className="flex items-center gap-1">
                  <span className="w-1 h-3 bg-white/60 rounded-full animate-pulse-soft" />
                  <span
                    className="w-1 h-2 bg-white/40 rounded-full animate-pulse-soft"
                    style={{ animationDelay: "0.2s" }}
                  />
                  <span
                    className="w-1 h-3 bg-white/60 rounded-full animate-pulse-soft"
                    style={{ animationDelay: "0.4s" }}
                  />
                </div>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleLike(song.id);
                }}
                className="flex-shrink-0 ml-1 p-1 rounded transition-colors"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill={isLiked ? "currentColor" : "none"}
                  stroke="currentColor"
                  strokeWidth="2"
                  className={
                    isLiked
                      ? "text-red-400"
                      : "text-white/20 hover:text-white/50"
                  }
                >
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                </svg>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}