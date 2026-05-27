export interface Document {
  id: number;
  filename: string;
  content: string;
  file_type: string;
  created_at: string;
  updated_at: string;
}

export interface Chunk {
  id: number;
  document_id: number;
  chunk_index: number;
  content: string;
  embedding: string | null;
  token_count: number;
  created_at: string;
}

export interface ChunkResult extends Chunk {
  similarity: number;
  document_filename: string;
}

export interface Card {
  id: number;
  question: string;
  answer: string;
  category: 'technical' | 'behavioral' | 'project' | 'self_intro' | 'other';
  tags: string;
  source: 'manual' | 'from_chat';
  source_chat_id: number | null;
  created_at: string;
  updated_at: string;
}

export interface ChatSession {
  id: number;
  title: string;
  mode: 'interviewer_role' | 'self_role';
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  id: number;
  session_id: number;
  role: 'user' | 'assistant' | 'system';
  content: string;
  is_corrected: number;
  corrected_content: string | null;
  saved_as_card_id: number | null;
  created_at: string;
}

export interface WorkExperience {
  company: string;
  role: string;
  period: { start: string; end: string };
  achievements: string[];
  techStack: string[];
}

export interface Project {
  name: string;
  company: string;
  description: string;
  techStack: string[];
  outcome: string;
  highlights: string[];
}

export interface Skill {
  name: string;
  level: 'expert' | 'advanced' | 'intermediate' | 'familiar';
  evidence: string[];
}

export interface Education {
  school: string;
  degree: string;
  major: string;
  period: { start: string; end: string };
}

export interface PersonProfile {
  person: {
    name: string;
    role: string;
    yearsOfExperience: number;
    summary: string;
  };
  workHistory: WorkExperience[];
  projects: Project[];
  skills: Skill[];
  education: Education[];
  careerNarrative: string;
  coreStrengths: string[];
  growthAreas: string[];
  targetRoles: string[];
}

export interface ProfileRecord {
  id: number;
  profile_json: string;
  source_document_ids: string;
  created_at: string;
}

export interface KnowledgeAnswer {
  answer?: string;
  error?: string;
  sources?: {
    documentId: number;
    filename: string;
    chunkIndex: number;
    content: string;
    similarity: number;
  }[];
}

export const CARD_CATEGORIES = ['technical', 'behavioral', 'project', 'self_intro', 'other'] as const;
export const CARD_CATEGORY_LABELS: Record<string, string> = {
  technical: '技术基础',
  behavioral: '行为面试',
  project: '项目经历',
  self_intro: '自我介绍',
  other: '其他',
};
