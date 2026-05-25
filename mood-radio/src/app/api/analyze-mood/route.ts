import { NextRequest, NextResponse } from "next/server";
import type { MoodAnalysis } from "@/lib/types";

const LLM_API_URL = process.env.LLM_API_URL || "";
const LLM_API_KEY = process.env.LLM_API_KEY || "";
const LLM_MODEL = process.env.LLM_MODEL || "deepseek-chat";

const SYSTEM_PROMPT = `你是一个专业的音乐心理分析师。根据用户描述的情绪或状态，输出严格的 JSON 格式。

分析规则：
1. mood_cn: 用2-4个中文字概括核心情绪
2. mood_en: 对应的英文情绪词
3. genre: 推荐1-3个音乐风格（如 pop, jazz, classical, rock, rnb, electronic, ambient, folk, lo-fi）
4. bpm_range: 推荐BPM范围 [最低, 最高]
5. instruments: 推荐1-3种主要乐器（如 piano, guitar, violin, saxophone, drums, synthesizer）
6. search_keywords: 3-5个中文搜索关键词，用于在网易云音乐中搜索
7. color_palette: 适合该情绪的配色方案 (primary深色, secondary中色, accent亮色)
8. visual_mood: 用1-2个英文词描述视觉氛围（如 rainy window, sunset beach, neon city, forest fog）

BPM参考：
- 平静/忧郁: 60-80
- 舒缓/放松: 80-100
- 愉悦/温暖: 100-120
- 兴奋/活力: 120-140
- 激烈/高能: 140-160

只输出 JSON，不要任何解释文字。`;

export async function POST(request: NextRequest) {
  try {
    const { text } = await request.json();

    if (!text || typeof text !== "string") {
      return NextResponse.json(
        { error: "请提供情绪描述文字" },
        { status: 400 }
      );
    }

    if (!LLM_API_KEY || LLM_API_KEY === "your_deepseek_api_key_here") {
      return NextResponse.json(
        { error: "LLM API Key 未配置，请在 .env.local 中设置 LLM_API_KEY" },
        { status: 500 }
      );
    }

    const response = await fetch(LLM_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LLM_API_KEY}`,
      },
      body: JSON.stringify({
        model: LLM_MODEL,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: text },
        ],
        temperature: 0.7,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error("LLM API error:", response.status, errorBody);
      return NextResponse.json(
        { error: `LLM 服务返回错误 (${response.status})` },
        { status: 502 }
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      return NextResponse.json(
        { error: "LLM 返回内容为空" },
        { status: 500 }
      );
    }

    let analysis: MoodAnalysis;
    try {
      const cleaned = content
        .replace(/^```json\s*/i, "")
        .replace(/\s*```$/, "")
        .trim();
      analysis = JSON.parse(cleaned);
    } catch {
      return NextResponse.json(
        { error: "LLM 返回的 JSON 解析失败", raw: content },
        { status: 500 }
      );
    }

    return NextResponse.json(analysis);
  } catch (error) {
    console.error("analyze-mood error:", error);
    return NextResponse.json(
      { error: "情绪分析服务异常" },
      { status: 500 }
    );
  }
}