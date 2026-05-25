import { NextRequest, NextResponse } from "next/server";
import { neteaseProvider } from "@/lib/music-providers/netease";
import { spotifyProvider } from "@/lib/music-providers/spotify";

export async function POST(request: NextRequest) {
  try {
    const { songIds, platform = "netease" } = await request.json();

    if (!songIds || !Array.isArray(songIds) || songIds.length === 0) {
      return NextResponse.json(
        { error: "请提供歌曲 ID 列表" },
        { status: 400 }
      );
    }

    const provider = platform === "spotify" ? spotifyProvider : neteaseProvider;
    const urls = await provider.getPlayUrls(songIds);

    return NextResponse.json({ urls });
  } catch (error) {
    console.error("refresh-urls error:", error);
    return NextResponse.json(
      { error: "播放链接刷新异常" },
      { status: 500 }
    );
  }
}