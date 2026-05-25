import type { Song } from "@/lib/types";

export interface MusicProvider {
  name: "netease" | "spotify";
  search(keyword: string, limit: number): Promise<Song[]>;
  getPlayUrls(songIds: string[]): Promise<Record<string, string>>;
}