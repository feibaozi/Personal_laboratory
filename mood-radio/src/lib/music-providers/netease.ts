import type { Song } from "@/lib/types";
import type { MusicProvider } from "./types";

const API_BASE = process.env.NETEASE_API_BASE || "http://localhost:3000";

interface NeteaseSearchResult {
  id: number;
  name: string;
  artists: Array<{ name: string }>;
  album: { name: string; picUrl: string };
  duration: number;
}

export const neteaseProvider: MusicProvider = {
  name: "netease",

  async search(keyword: string, limit = 10): Promise<Song[]> {
    const response = await fetch(
      `${API_BASE}/search?keywords=${encodeURIComponent(keyword)}&limit=${limit}&type=1`
    );

    if (!response.ok) return [];

    const data = await response.json();
    const songs: NeteaseSearchResult[] = data.result?.songs || [];

    return songs.map((song) => ({
      id: String(song.id),
      name: song.name,
      artists: song.artists?.map((a) => a.name).join(" / ") || "未知艺术家",
      album: song.album?.name || "未知专辑",
      coverUrl: song.album?.picUrl || "",
      playUrl: "",
      duration: song.duration || 0,
    }));
  },

  async getPlayUrls(songIds: string[]): Promise<Record<string, string>> {
    const urls: Record<string, string> = {};

    try {
      const idsParam = songIds.join(",");
      const response = await fetch(`${API_BASE}/song/url?id=${idsParam}`);
      if (!response.ok) return urls;

      const data = await response.json();
      for (const item of data.data || []) {
        if (item.url) {
          urls[String(item.id)] = item.url;
        }
      }
    } catch {
      // 静默失败
    }

    return urls;
  },
};