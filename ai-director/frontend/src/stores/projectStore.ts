import { create } from 'zustand'
import type { Material, Script, ShotSpec, MatchResult, Project } from '../types'
import { api } from '../api/client'

interface ProjectState {
  materials: Material[]
  script: Script | null
  shotMatches: Record<string, MatchResult[]>
  projectId: string | null
  pipelineStatus: 'idle' | 'narrating' | 'matching' | 'done' | 'failed'
  pipelineProgress: number
  pipelineMessage: string
  currentMode: 'quick' | 'storyboard'
  selectedShotIndex: number | null
  transitions: string[]
  narrativeType: string
  targetDuration: number

  setMaterials: (materials: Material[]) => void
  addMaterial: (m: Material) => void
  removeMaterial: (id: string) => void
  setScript: (s: Script) => void
  setShotMatches: (matches: Record<string, MatchResult[]>) => void
  assignMaterial: (shotIndex: number, materialId: string) => void
  setPipelineStatus: (status: ProjectState['pipelineStatus']) => void
  setPipelineProgress: (progress: number) => void
  setPipelineMessage: (message: string) => void
  setMode: (mode: 'quick' | 'storyboard') => void
  setSelectedShot: (index: number | null) => void
  setProjectId: (id: string | null) => void
  setTransitions: (transitions: string[]) => void
  setNarrativeType: (nt: string) => void
  setTargetDuration: (d: number) => void
  updateShot: (index: number, patch: Partial<ShotSpec>) => void
  reorderShots: (fromIndex: number, toIndex: number) => void
  deleteShot: (index: number) => void
  addShot: (afterIndex?: number) => void
  ensureProject: () => Promise<string | null>
  syncProjectToBackend: () => Promise<void>
  fetchTransitions: () => Promise<void>
  reset: () => void

  // 导出状态
  exporting: boolean
  exportProgress: number
  exportMessage: string
  downloadUrl: string | null
  setExporting: (v: boolean) => void
  setExportProgress: (p: number) => void
  setExportMessage: (m: string) => void
  setDownloadUrl: (u: string | null) => void

  // 并发保护
  isCreatingProject: boolean
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  materials: [],
  script: null,
  shotMatches: {},
  projectId: null,
  pipelineStatus: 'idle',
  pipelineProgress: 0,
  pipelineMessage: '',
  currentMode: 'quick',
  selectedShotIndex: null,
  transitions: ['cut', 'dissolve', 'fadeblack', 'fadewhite', 'wipeleft', 'wiperight', 'slideleft', 'slideright', 'radial', 'circleopen', 'circleclose', 'pixelize', 'zoomin', 'smoothleft', 'smoothright'],
  narrativeType: 'three_act',
  targetDuration: 120,
  exporting: false,
  exportProgress: 0,
  exportMessage: '',
  downloadUrl: null,
  isCreatingProject: false,

  setMaterials: (materials) => set({ materials }),
  addMaterial: (m) => set((s) => ({ materials: [...s.materials, m] })),
  removeMaterial: (id) => set((s) => ({ materials: s.materials.filter((m) => m.id !== id) })),
  setScript: (script) => set({ script }),
  setShotMatches: (shotMatches) => set({ shotMatches }),
  assignMaterial: (shotIndex, materialId) =>
    set((s) => {
      if (!s.script) return s
      return {
        script: {
          ...s.script,
          shots: s.script.shots.map((shot) =>
            shot.index === shotIndex ? { ...shot, assigned_material_id: materialId } : shot
          ),
        },
      }
    }),
  setPipelineStatus: (pipelineStatus) => set({ pipelineStatus }),
  setPipelineProgress: (pipelineProgress) => set({ pipelineProgress }),
  setPipelineMessage: (pipelineMessage) => set({ pipelineMessage }),
  setMode: (currentMode) => set({ currentMode }),
  setSelectedShot: (selectedShotIndex) => set({ selectedShotIndex }),
  setProjectId: (projectId) => set({ projectId }),
  setTransitions: (transitions) => set({ transitions }),
  setNarrativeType: (narrativeType) => set({ narrativeType }),
  setTargetDuration: (targetDuration) => set({ targetDuration }),
  setExporting: (exporting) => set({ exporting }),
  setExportProgress: (exportProgress) => set({ exportProgress }),
  setExportMessage: (exportMessage) => set({ exportMessage }),
  setDownloadUrl: (downloadUrl) => set({ downloadUrl }),

  updateShot: (index, patch) =>
    set((s) => {
      if (!s.script) return s
      return {
        script: {
          ...s.script,
          shots: s.script.shots.map((shot) =>
            shot.index === index ? { ...shot, ...patch } : shot
          ),
        },
      }
    }),

  reorderShots: (fromIndex, toIndex) =>
    set((s) => {
      if (!s.script) return s
      const shots = [...s.script.shots]
      const [removed] = shots.splice(fromIndex, 1)
      shots.splice(toIndex, 0, removed)
      const reindexed = shots.map((shot, i) => ({ ...shot, index: i + 1 }))
      return { script: { ...s.script, shots: reindexed } }
    }),

  deleteShot: (index) =>
    set((s) => {
      if (!s.script) return s
      const filtered = s.script.shots.filter((shot) => shot.index !== index)
      const reindexed = filtered.map((shot, i) => ({ ...shot, index: i + 1 }))
      return { script: { ...s.script, shots: reindexed } }
    }),

  addShot: (afterIndex) =>
    set((s) => {
      if (!s.script) return s
      const totalDuration = s.script.shots.reduce((sum, shot) => sum + shot.duration_sec, 0)
      const avgDuration = Math.round(totalDuration / Math.max(s.script.shots.length, 1))
      const newShot: ShotSpec = {
        index: s.script.shots.length + 1,
        description: '新分镜 — 请输入描述',
        duration_sec: avgDuration || 10,
        tone: 'neutral',
        transition_in: 'cut',
        transition_out: 'dissolve',
        narration: null,
        music_style: null,
      }
      const shots = [...s.script.shots]
      if (afterIndex !== undefined && afterIndex < shots.length) {
        shots.splice(afterIndex + 1, 0, newShot)
      } else {
        shots.push(newShot)
      }
      const reindexed = shots.map((shot, i) => ({ ...shot, index: i + 1 }))
      return { script: { ...s.script, shots: reindexed } }
    }),

  ensureProject: async () => {
    const state = get()
    if (state.projectId) return state.projectId
    if (state.isCreatingProject) return null

    set({ isCreatingProject: true })
    try {
      const theme = state.script?.theme || 'untitled'
      const res = await api.post<{ id: string; name: string }>('/projects', {
        name: theme,
        theme,
      })
      set({ projectId: res.id })
      await get().syncProjectToBackend()
      return res.id
    } catch (e) {
      console.error('Failed to create project:', e)
      return null
    } finally {
      set({ isCreatingProject: false })
    }
  },

  syncProjectToBackend: async () => {
    const state = get()
    if (!state.projectId || !state.script) return

    const shotMatchesPayload: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(state.shotMatches)) {
      shotMatchesPayload[k] = v
    }

    try {
      await api.patch(`/projects/${state.projectId}`, {
        script: state.script,
        shot_matches: shotMatchesPayload,
        status: 'ready',
        material_ids: state.materials.map((m) => m.id),
      })
    } catch (e) {
      console.error('Failed to sync project:', e)
    }
  },

  fetchTransitions: async () => {
    try {
      const data = await api.get<{ name: string; xfade_name: string }[]>('/compose/transitions')
      const names = data.map((t) => t.name)
      set({ transitions: names })
    } catch {
      // fallback: keep default list
    }
  },

  reset: () =>
    set({
      materials: [],
      script: null,
      shotMatches: {},
      projectId: null,
      pipelineStatus: 'idle',
      pipelineProgress: 0,
      pipelineMessage: '',
      currentMode: 'quick',
      selectedShotIndex: null,
      transitions: ['cut', 'dissolve', 'fadeblack', 'fadewhite', 'wipeleft', 'wiperight', 'slideleft', 'slideright', 'radial', 'circleopen', 'circleclose', 'pixelize', 'zoomin', 'smoothleft', 'smoothright'],
      narrativeType: 'three_act',
      targetDuration: 120,
      exporting: false,
      exportProgress: 0,
      exportMessage: '',
      downloadUrl: null,
    }),
}))
