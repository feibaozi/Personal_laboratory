export interface ShotSpec {
  index: number
  description: string
  duration_sec: number
  tone: 'calm' | 'excited' | 'tense' | 'warm' | 'reflective' | 'neutral'
  transition_in: string
  transition_out: string
  narration: string | null
  music_style: string | null
  assigned_material_id?: string
}

export interface Script {
  theme: string
  narrative_type: string
  target_duration_sec: number
  shots: ShotSpec[]
  soundtrack_notes: string
}

export type MaterialType = 'video' | 'image' | 'audio'

export interface Material {
  id: string
  file_path: string
  media_type: MaterialType
  filename: string
  duration_sec: number
  thumbnail_path: string | null
  tags: string[]
  description: string
}

export interface MatchResult {
  material_id: string
  filename: string
  media_type: MaterialType
  score: number
  thumbnail_path: string | null
  tags: string[]
}

export type ProjectStatus = 'draft' | 'narrating' | 'matching' | 'ready' | 'composing' | 'done' | 'failed'

export interface Project {
  id: string
  name: string
  theme: string
  status: ProjectStatus
  script: Script | null
  material_ids: string[]
  shot_matches: Record<string, MatchResult[]>
  output_path: string | null
  created_at: string
  updated_at: string
}