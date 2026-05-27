import { create } from 'zustand';
import type { Document, Card, ChatSession, ChatMessage, KnowledgeAnswer } from '@/lib/types';

interface KnowledgeStore {
  documents: Document[];
  loading: boolean;
  queryResult: KnowledgeAnswer | null;
  queryLoading: boolean;
  fetchDocuments: () => Promise<void>;
  uploadDocument: (filename: string, content: string) => Promise<Document>;
  uploadDocumentFile: (file: File) => Promise<Document>;
  deleteDocument: (id: number) => Promise<void>;
  queryKnowledge: (question: string) => Promise<KnowledgeAnswer>;
  clearQueryResult: () => void;
}

export const useKnowledgeStore = create<KnowledgeStore>((set) => ({
  documents: [],
  loading: false,
  queryResult: null,
  queryLoading: false,

  fetchDocuments: async () => {
    set({ loading: true });
    const res = await fetch('/api/knowledge/documents');
    const data = await res.json();
    set({ documents: data.documents, loading: false });
  },

  uploadDocument: async (filename, content) => {
    const res = await fetch('/api/knowledge/documents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename, content }),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    return data.document;
  },

  uploadDocumentFile: async (file) => {
    const formData = new FormData();
    formData.set('file', file);
    const res = await fetch('/api/knowledge/documents', {
      method: 'POST',
      body: formData,
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    return data.document;
  },

  deleteDocument: async (id) => {
    await fetch(`/api/knowledge/documents/${id}`, { method: 'DELETE' });
  },

  queryKnowledge: async (question) => {
    set({ queryLoading: true });
    const res = await fetch('/api/knowledge/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question }),
    });
    const data = await res.json();
    set({ queryResult: data, queryLoading: false });
    return data;
  },

  clearQueryResult: () => set({ queryResult: null }),
}));

interface CardsStore {
  cards: Card[];
  loading: boolean;
  filterCategory: string | null;
  filterTag: string | null;
  searchQuery: string;
  fetchCards: () => Promise<void>;
  createCard: (data: { question: string; answer: string; category: string; tags: string[] }) => Promise<Card>;
  updateCard: (id: number, data: Partial<{ question: string; answer: string; category: string; tags: string[] }>) => Promise<void>;
  deleteCard: (id: number) => Promise<void>;
  setFilter: (category: string | null, tag: string | null) => void;
  setSearch: (query: string) => void;
}

export const useCardsStore = create<CardsStore>((set, get) => ({
  cards: [],
  loading: false,
  filterCategory: null,
  filterTag: null,
  searchQuery: '',

  fetchCards: async () => {
    set({ loading: true });
    const { filterCategory, filterTag, searchQuery } = get();
    const params = new URLSearchParams();
    if (filterCategory) params.set('category', filterCategory);
    if (filterTag) params.set('tag', filterTag);
    if (searchQuery) params.set('search', searchQuery);
    const res = await fetch(`/api/cards?${params}`);
    const data = await res.json();
    set({ cards: data.cards, loading: false });
  },

  createCard: async (cardData) => {
    const res = await fetch('/api/cards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cardData),
    });
    const data = await res.json();
    return data.card;
  },

  updateCard: async (id, cardData) => {
    await fetch(`/api/cards/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cardData),
    });
  },

  deleteCard: async (id) => {
    await fetch(`/api/cards/${id}`, { method: 'DELETE' });
  },

  setFilter: (category, tag) => set({ filterCategory: category, filterTag: tag }),
  setSearch: (query) => set({ searchQuery: query }),
}));

interface ChatStore {
  sessions: ChatSession[];
  currentSession: ChatSession | null;
  messages: ChatMessage[];
  mode: 'interviewer_role' | 'self_role';
  streaming: boolean;
  fetchSessions: () => Promise<void>;
  createSession: (mode: 'interviewer_role' | 'self_role') => Promise<ChatSession>;
  loadSession: (sessionId: number) => Promise<void>;
  sendMessage: (content: string) => Promise<void>;
  deleteSession: (sessionId: number) => Promise<void>;
  correctMessage: (messageId: number, corrected: string) => Promise<void>;
  saveAsCard: (messageId: number) => Promise<Card>;
  setMode: (mode: 'interviewer_role' | 'self_role') => void;
}

export const useChatStore = create<ChatStore>((set, get) => ({
  sessions: [],
  currentSession: null,
  messages: [],
  mode: 'interviewer_role',
  streaming: false,

  fetchSessions: async () => {
    const res = await fetch('/api/chat/history');
    const data = await res.json();
    set({ sessions: data.sessions });
  },

  createSession: async (mode) => {
    const res = await fetch('/api/chat/history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode }),
    });
    const data = await res.json();
    set({ currentSession: data.session, messages: [], mode });
    return data.session;
  },

  loadSession: async (sessionId) => {
    const res = await fetch(`/api/chat/history/${sessionId}`);
    const data = await res.json();
    set({
      currentSession: data.session,
      messages: data.messages,
      mode: data.session.mode,
    });
  },

  sendMessage: async (content) => {
    const { currentSession, mode } = get();
    if (!currentSession) return;

    // Add user message optimistically
    const userMsg: ChatMessage = {
      id: Date.now(),
      session_id: currentSession.id,
      role: 'user',
      content,
      is_corrected: 0,
      corrected_content: null,
      saved_as_card_id: null,
      created_at: new Date().toISOString(),
    };
    set((s) => ({ messages: [...s.messages, userMsg], streaming: true }));

    const res = await fetch('/api/chat/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: currentSession.id, message: content, mode }),
    });
    const data = await res.json();

    if (data.error) {
      set((s) => ({ streaming: false }));
      throw new Error(data.error);
    }

    // Sync mode from server response
    set((s) => ({
      messages: [...s.messages, data.message],
      streaming: false,
      mode: data.mode || s.mode,
    }));
  },

  deleteSession: async (sessionId) => {
    await fetch(`/api/chat/history/${sessionId}`, { method: 'DELETE' });
  },

  correctMessage: async (messageId, corrected) => {
    await fetch('/api/chat/correct', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messageId, correctedContent: corrected }),
    });
    set((s) => ({
      messages: s.messages.map((m) =>
        m.id === messageId ? { ...m, is_corrected: 1, corrected_content: corrected } : m
      ),
    }));
  },

  saveAsCard: async (messageId) => {
    const message = get().messages.find((m) => m.id === messageId);
    if (!message) throw new Error('Message not found');

    const res = await fetch('/api/cards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question: '',
        answer: message.corrected_content || message.content,
        category: 'other',
        tags: [],
        source: 'from_chat',
        sourceChatId: get().currentSession?.id,
      }),
    });
    const data = await res.json();

    set((s) => ({
      messages: s.messages.map((m) =>
        m.id === messageId ? { ...m, saved_as_card_id: data.card.id } : m
      ),
    }));

    return data.card;
  },

  setMode: (mode) => set({ mode }),
}));

interface SettingsStore {
  settings: Record<string, string>;
  loading: boolean;
  fetchSettings: () => Promise<void>;
  updateSetting: (key: string, value: string) => Promise<void>;
}

export const useSettingsStore = create<SettingsStore>((set) => ({
  settings: {},
  loading: false,

  fetchSettings: async () => {
    set({ loading: true });
    const res = await fetch('/api/settings');
    const data = await res.json();
    set({ settings: data.settings, loading: false });
  },

  updateSetting: async (key, value) => {
    await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, value }),
    });
    set((s) => ({ settings: { ...s.settings, [key]: value } }));
  },
}));
