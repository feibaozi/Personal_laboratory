"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import type { Song } from "@/lib/types";

interface MusicPlayerProps {
  playlist: Song[];
  currentIndex: number;
  onIndexChange: (index: number) => void;
  onUrlsExpiring: (songIds: string[]) => void;
}

export default function MusicPlayer({
  playlist,
  currentIndex,
  onIndexChange,
  onUrlsExpiring,
}: MusicPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.7);
  const audioRef = useRef<HTMLAudioElement>(null);
  const loadedAtIndex = useRef(-1);
  const lastUrlRefresh = useRef(0);

  const currentSong = playlist[currentIndex];

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleLoadedMetadata = () => setDuration(audio.duration);
    const handleEnded = () => {
      if (playlist.length === 0) return;
      onIndexChange((currentIndex + 1) % playlist.length);
    };

    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("ended", handleEnded);

    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("ended", handleEnded);
    };
  }, [currentIndex, playlist.length, onIndexChange]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  useEffect(() => {
    if (!currentSong?.playUrl || !audioRef.current) return;

    if (loadedAtIndex.current === currentIndex) return;

    const audio = audioRef.current;
    audio.src = currentSong.playUrl;
    audio.load();

    const onCanPlay = () => {
      audio.play().then(() => setIsPlaying(true)).catch(() => {});
      audio.removeEventListener("canplay", onCanPlay);
    };
    audio.addEventListener("canplay", onCanPlay);
    loadedAtIndex.current = currentIndex;

    return () => {
      audio.removeEventListener("canplay", onCanPlay);
    };
  }, [currentSong, currentIndex]);

  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      if (now - lastUrlRefresh.current < 15 * 60 * 1000) return;

      lastUrlRefresh.current = now;
      const allIds = playlist.map((s) => s.id);
      if (allIds.length > 0) {
        onUrlsExpiring(allIds);
      }
    }, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [playlist, onUrlsExpiring]);

  const playNext = useCallback(() => {
    if (playlist.length === 0) return;
    onIndexChange((currentIndex + 1) % playlist.length);
  }, [playlist.length, currentIndex, onIndexChange]);

  const playPrev = useCallback(() => {
    if (playlist.length === 0) return;
    onIndexChange(
      (currentIndex - 1 + playlist.length) % playlist.length
    );
  }, [playlist.length, currentIndex, onIndexChange]);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play().then(() => setIsPlaying(true)).catch(() => {});
    }
  }, [isPlaying]);

  const seek = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!audioRef.current || !duration) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const ratio = (e.clientX - rect.left) / rect.width;
      audioRef.current.currentTime = ratio * duration;
    },
    [duration]
  );

  const formatTime = (t: number) => {
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  if (playlist.length === 0 || !currentSong) return null;

  return (
    <div className="animate-slide-up w-full">
      <audio ref={audioRef} />
      <div className="glass rounded-2xl p-5 flex items-center gap-5">
        <div className="relative flex-shrink-0">
          <div
            className="w-[72px] h-[72px] rounded-full bg-gradient-to-br from-white/5 to-white/10
                       flex items-center justify-center overflow-hidden shadow-lg"
            style={{
              animation: isPlaying ? "spin 10s linear infinite" : "none",
              border: "2px solid rgba(255,255,255,0.08)",
            }}
          >
            <div className="w-[26px] h-[26px] rounded-full bg-[#111] absolute border-2 border-white/10" />
            {currentSong.coverUrl ? (
              <img
                src={currentSong.coverUrl}
                alt={currentSong.name}
                className="absolute inset-0 w-full h-full object-cover opacity-80"
              />
            ) : (
              <svg
                width="40"
                height="40"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1"
                className="text-white/20"
              >
                <path d="M9 18V5l12-2v13" />
                <circle cx="6" cy="18" r="3" />
                <circle cx="18" cy="16" r="3" />
              </svg>
            )}
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-white font-medium truncate">
            {currentSong.name}
          </p>
          <p className="text-white/50 text-sm truncate">
            {currentSong.artists}
          </p>

          <div className="mt-2 flex items-center gap-3">
            <button
              onClick={playPrev}
              className="text-white/60 hover:text-white transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" />
              </svg>
            </button>
            <button
              onClick={togglePlay}
              className="text-white hover:text-white/80 transition-colors"
            >
              {isPlaying ? (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                </svg>
              ) : (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M8 5v14l11-7z" />
                </svg>
              )}
            </button>
            <button
              onClick={playNext}
              className="text-white/60 hover:text-white transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
              </svg>
            </button>

            <div className="flex items-end gap-[2px] ml-1 h-4">
              {[0.6, 0.9, 0.4, 0.7, 1, 0.5, 0.8, 0.3].map((h, i) => (
                <span
                  key={i}
                  className="w-[2px] bg-white/30 rounded-full transition-all duration-150"
                  style={{
                    height: isPlaying ? `${4 + h * 10}px` : "4px",
                    animationDelay: `${i * 0.15}s`,
                  }}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-col items-end gap-2">
          <div
            className="w-24 h-1 bg-white/10 rounded-full cursor-pointer group"
            onClick={seek}
          >
            <div
              className="h-full bg-white/60 rounded-full transition-all group-hover:bg-white/80"
              style={{
                width: duration ? `${(currentTime / duration) * 100}%` : "0%",
              }}
            />
          </div>
          <span className="text-white/30 text-xs">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
        </div>
      </div>
    </div>
  );
}