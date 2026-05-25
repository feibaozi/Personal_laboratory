import { NextRequest, NextResponse } from "next/server";
import type { Song } from "@/lib/types";
import { neteaseProvider } from "@/lib/music-providers/netease";
import { spotifyProvider } from "@/lib/music-providers/spotify";
import type { MusicProvider } from "@/lib/music-providers/types";

function getProvider(platform: string): MusicProvider {
  return platform === "spotify" ? spotifyProvider : neteaseProvider;
}

export async function POST(request: NextRequest) {
  try {
    const { keywords, bpm_range, platform = "netease" } = await request.json();

    if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
      return NextResponse.json(
        { error: "请提供搜索关键词" },
        { status: 400 }
      );
    }

    const provider = getProvider(platform);
    const seenIds = new Set<string>();
    const allSongs: Song[] = [];

    for (const keyword of keywords) {
      const songs = await provider.search(keyword, 8);
      for (const song of songs) {
        if (!seenIds.has(song.id)) {
          seenIds.add(song.id);
          allSongs.push(song);
        }
      }
      if (allSongs.length >= 30) break;
    }

    const finalSongs = allSongs.slice(0, 20);

    const songIds = finalSongs.map((s) => s.id);
    const urlMap = await provider.getPlayUrls(songIds);

    const songsWithUrls = finalSongs
      .map((song) => ({
        ...song,
        playUrl: urlMap[song.id] || song.playUrl || "",
      }))
      .filter((song) => song.playUrl);

    return NextResponse.json({ songs: songsWithUrls });
  } catch (error) {
    console.error("search-songs error:", error);
    return NextResponse.json(
      { error: "歌曲搜索服务异常" },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    platforms: ["netease", "spotify"],
    default: "netease",
  });
}