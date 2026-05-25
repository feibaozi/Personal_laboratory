export interface MoodAnalysis {
  mood_cn: string;
  mood_en: string;
  genre: string[];
  bpm_range: [number, number];
  instruments: string[];
  search_keywords: string[];
  color_palette: {
    primary: string;
    secondary: string;
    accent: string;
  };
  visual_mood: string;
}

export interface Song {
  id: string;
  name: string;
  artists: string;
  album: string;
  coverUrl: string;
  playUrl: string;
  duration: number;
}

export interface MoodSession {
  id: string;
  userInput: string;
  analysis: MoodAnalysis;
  songs: Song[];
  createdAt: string;
}

export interface PlaylistResponse {
  analysis: MoodAnalysis;
  songs: Song[];
}