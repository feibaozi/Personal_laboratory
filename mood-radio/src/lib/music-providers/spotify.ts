import type { Song } from "@/lib/types";
import type { MusicProvider } from "./types";

const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID || "";
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET || "";

let accessToken = "";
let tokenExpiresAt = 0;

async function getAccessToken(): Promise<string> {
  if (accessToken && Date.now() < tokenExpiresAt - 60000) {
    return accessToken;
  }

  const auth = Buffer.from(
    `${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`
  ).toString("base64");

  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${auth}`,
    },
    body: "grant_type=client_credentials",
  });

  if (!response.ok) {
    throw new Error(`Spotify auth failed: ${response.status}`);
  }

  const data = await response.json();
  accessToken = data.access_token;
  tokenExpiresAt = Date.now() + data.expires_in * 1000;
  return accessToken;
}

interface SpotifyTrack {
  id: string;
  name: string;
  artists: Array<{ name: string }>;
  album: {
    name: string;
    images: Array<{ url: string }>;
  };
  duration_ms: number;
  preview_url: string | null;
}

export const spotifyProvider: MusicProvider = {
  name: "spotify",

  async search(keyword: string, limit = 10): Promise<Song[]> {
    try {
      const token = await getAccessToken();
      const response = await fetch(
        `https://api.spotify.com/v1/search?q=${encodeURIComponent(keyword)}&type=track&limit=${limit}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!response.ok) return [];

      const data = await response.json();
      const tracks: SpotifyTrack[] = data.tracks?.items || [];

      return tracks.map((track) => ({
        id: track.id,
        name: track.name,
        artists: track.artists?.map((a) => a.name).join(" / ") || "未知艺术家",
        album: track.album?.name || "未知专辑",
        coverUrl: track.album?.images?.[0]?.url || "",
        playUrl: track.preview_url || "",
        duration: track.duration_ms || 0,
      }));
    } catch {
      return [];
    }
  },

  async getPlayUrls(songIds: string[]): Promise<Record<string, string>> {
    // Spotify Client Credentials 只能获取 preview_url（30秒试听）
    // 完整播放需要用户 OAuth 授权，暂时返回空
    return {};
  },
};