"use client";

import { useState, useCallback } from "react";
import MoodInput from "@/components/MoodInput";
import MoodPresets from "@/components/MoodPresets";
import DynamicBackground from "@/components/DynamicBackground";
import MusicPlayer from "@/components/MusicPlayer";
import PlaylistView from "@/components/PlaylistView";
import HistoryPanel from "@/components/HistoryPanel";
import TitleBar from "@/components/TitleBar";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import type { MoodAnalysis, Song, MoodSession } from "@/lib/types";

const DEFAULT_PALETTE = {
  primary: "#0a0a2e",
  secondary: "#1a1a3e",
  accent: "#3b3b6e",
};

const MUSIC_PLATFORM = (process.env.NEXT_PUBLIC_MUSIC_PLATFORM || "netease") as
  | "netease"
  | "spotify";

const isElectron =
  typeof window !== "undefined" && window.electronAPI?.isElectron;

export default function Home() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [analysis, setAnalysis] = useState<MoodAnalysis | null>(null);
  const [songs, setSongs] = useState<Song[]>([]);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [likedIds, setLikedIds] = useLocalStorage<string[]>(
    "mood-radio-liked",
    []
  );
  const [history, setHistory] = useLocalStorage<MoodSession[]>(
    "mood-radio-history",
    []
  );

  const palette = analysis?.color_palette || DEFAULT_PALETTE;
  const visualMood = analysis?.visual_mood || "";

  const handleSubmit = useCallback(async (text: string) => {
    setIsLoading(true);
    setError("");
    setSongs([]);
    setCurrentTrackIndex(0);

    try {
      const moodRes = await fetch("/api/analyze-mood", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });

      if (!moodRes.ok) {
        const err = await moodRes.json();
        throw new Error(err.error || "情绪分析失败");
      }

      const moodAnalysis: MoodAnalysis = await moodRes.json();
      setAnalysis(moodAnalysis);

      const songRes = await fetch("/api/search-songs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keywords: moodAnalysis.search_keywords,
          bpm_range: moodAnalysis.bpm_range,
          platform: MUSIC_PLATFORM,
        }),
      });

      if (!songRes.ok) {
        const err = await songRes.json();
        throw new Error(err.error || "歌曲搜索失败");
      }

      const { songs: songList } = await songRes.json();
      setSongs(songList);

      const session: MoodSession = {
        id: Date.now().toString(),
        userInput: text,
        analysis: moodAnalysis,
        songs: songList,
        createdAt: new Date().toISOString(),
      };

      setHistory((prev) => [session, ...prev].slice(0, 20));
    } catch (e) {
      setError(e instanceof Error ? e.message : "未知错误");
    } finally {
      setIsLoading(false);
    }
  }, [setHistory]);

  const handleSelectHistory = useCallback((session: MoodSession) => {
    setAnalysis(session.analysis);
    setSongs(session.songs);
    setCurrentTrackIndex(0);
    setError("");
  }, []);

  const handleDeleteHistory = useCallback(
    (id: string) => {
      setHistory((prev) => prev.filter((s) => s.id !== id));
    },
    [setHistory]
  );

  const handleToggleLike = useCallback(
    (songId: string) => {
      setLikedIds((prev) =>
        prev.includes(songId)
          ? prev.filter((id) => id !== songId)
          : [...prev, songId]
      );
    },
    [setLikedIds]
  );

  const handleRefreshUrls = useCallback(
    async (songIds: string[]) => {
      try {
        const res = await fetch("/api/refresh-urls", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ songIds, platform: MUSIC_PLATFORM }),
        });
        if (!res.ok) return;
        const { urls } = await res.json();
        setSongs((prev) =>
          prev.map((song) => {
            const newUrl = urls[song.id];
            return newUrl ? { ...song, playUrl: newUrl } : song;
          })
        );
      } catch {
      }
    },
    []
  );

  return (
    <>
      <DynamicBackground
        colorPalette={palette}
        visualMood={visualMood}
      />

      <TitleBar />

      <main
        className={`relative flex flex-col items-center justify-center px-4 ${
          isElectron ? "h-screen pt-10" : "h-screen"
        }`}
      >
        <div className="flex flex-col items-center gap-6 w-full max-w-xl">
          {!isElectron && (
            <div className="text-center animate-fade-in">
              <h1 className="text-4xl font-light tracking-wide text-white/90 mb-2">
                Mood Radio
              </h1>
              <p className="text-white/35 text-sm">情绪音乐电台</p>
            </div>
          )}

          <MoodInput onSubmit={handleSubmit} isLoading={isLoading} />

          <MoodPresets onSelect={handleSubmit} isLoading={isLoading} />

          {error && (
            <div className="animate-slide-down bg-red-400/10 border border-red-400/20 rounded-xl px-5 py-3 text-red-300 text-sm">
              {error}
            </div>
          )}

          {!isLoading && !error && analysis && (
            <div className="animate-fade-in text-center">
              <span className="text-white/50 text-sm">
                当前情绪：
              </span>
              <span className="text-white/80 ml-1 font-medium">
                {analysis.mood_cn}
              </span>
              <span className="text-white/30 mx-2">·</span>
              <span className="text-white/40 text-sm">
                {analysis.mood_en}
              </span>
            </div>
          )}

          {songs.length > 0 && (
            <MusicPlayer
              playlist={songs}
              currentIndex={currentTrackIndex}
              onIndexChange={setCurrentTrackIndex}
              onUrlsExpiring={handleRefreshUrls}
            />
          )}

          {songs.length > 0 && (
            <PlaylistView
              songs={songs}
              moodCn={analysis?.mood_cn || ""}
              currentIndex={currentTrackIndex}
              onSelect={setCurrentTrackIndex}
              likedIds={likedIds}
              onToggleLike={handleToggleLike}
            />
          )}

          <HistoryPanel
            history={history}
            onSelect={handleSelectHistory}
            onDelete={handleDeleteHistory}
          />
        </div>
      </main>
    </>
  );
}