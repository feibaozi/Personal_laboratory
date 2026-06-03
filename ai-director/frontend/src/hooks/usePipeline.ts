import { useEffect, useRef, useCallback } from 'react'
import { useProjectStore } from '../stores/projectStore'
import { api } from '../api/client'
import type { Script, MatchResult } from '../types'

interface UsePipelineOptions {
  theme: string
  narrativeType: string
  duration: number
  materialIds: string
}

export function usePipeline() {
  const {
    setScript,
    setShotMatches,
    setPipelineStatus,
    setPipelineProgress,
    setPipelineMessage,
    ensureProject,
    syncProjectToBackend,
    exporting,
    exportProgress,
    exportMessage,
    downloadUrl,
    setExporting,
    setExportProgress,
    setExportMessage,
    setDownloadUrl,
  } = useProjectStore()

  const pipelineIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const exportIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const attemptsRef = useRef(0)
  const exportAttemptsRef = useRef(0)
  const abortControllerRef = useRef<AbortController | null>(null)

  const clearPipelinePoll = useCallback(() => {
    if (pipelineIntervalRef.current) {
      clearInterval(pipelineIntervalRef.current)
      pipelineIntervalRef.current = null
    }
  }, [])

  const clearExportPoll = useCallback(() => {
    if (exportIntervalRef.current) {
      clearInterval(exportIntervalRef.current)
      exportIntervalRef.current = null
    }
  }, [])

  useEffect(() => {
    return () => {
      clearPipelinePoll()
      clearExportPoll()
      abortControllerRef.current?.abort()
    }
  }, [clearPipelinePoll, clearExportPoll])

  const runPipeline = async (options: UsePipelineOptions) => {
    const { theme, narrativeType, duration, materialIds } = options
    if (!theme.trim()) return

    clearPipelinePoll()
    abortControllerRef.current?.abort()
    abortControllerRef.current = new AbortController()
    setPipelineStatus('narrating')
    setPipelineProgress(0)
    setPipelineMessage('正在生成分镜脚本...')

    try {
      const res = await api.post<{ job_id: string }>('/narrative/pipeline', {
        theme,
        narrative_type: narrativeType,
        material_ids: materialIds || undefined,
        target_duration_sec: duration,
        auto_match: true,
      })

      const jobId = res.job_id
      attemptsRef.current = 0
      pipelineIntervalRef.current = setInterval(async () => {
        attemptsRef.current++
        try {
          const status = await api.get<{
            stage: string; progress: number; message: string
            script?: Script; shot_matches?: Record<string, MatchResult[]>
          }>(`/narrative/pipeline/${jobId}/status`)

          setPipelineProgress(status.progress || 0)
          setPipelineMessage(status.message || '')
          if (status.script) setScript(status.script)
          if (status.shot_matches) {
            setShotMatches(status.shot_matches)
          }

          if (status.stage === 'done' || status.stage === 'failed' || attemptsRef.current > 60) {
            clearPipelinePoll()
            if (attemptsRef.current > 60 && status.stage !== 'done' && status.stage !== 'failed') {
              setPipelineStatus('failed')
              setPipelineMessage('操作超时，请重试')
            } else {
              setPipelineStatus(status.stage === 'done' ? 'done' : 'failed')
            }
            if (status.stage === 'done') {
              ensureProject()
            }
          }
        } catch {
          if (attemptsRef.current > 60) { clearPipelinePoll(); setPipelineStatus('failed'); setPipelineMessage('操作超时，请重试') }
        }
      }, 1500)
    } catch (e) {
      setPipelineStatus('failed')
      setPipelineMessage('请求失败: ' + String(e))
    }
  }

  const startExport = async (options?: { includeSubtitles?: boolean; includeNarration?: boolean; bgmPath?: string }) => {
    clearExportPoll()
    abortControllerRef.current?.abort()
    abortControllerRef.current = new AbortController()
    setExporting(true)
    setExportProgress(0)
    setExportMessage('正在准备导出...')
    setDownloadUrl(null)

    try {
      await syncProjectToBackend()
      const projectId = await ensureProject()
      if (!projectId) {
        setExporting(false)
        setExportMessage('创建项目失败')
        return
      }

      const includeSubtitles = options?.includeSubtitles !== false
      const includeNarration = options?.includeNarration === true
      const bgmPath = options?.bgmPath || ''

      let url = `/compose/export?project_id=${projectId}&include_subtitles=${includeSubtitles}&include_narration=${includeNarration}`
      if (bgmPath) url += `&bgm_path=${encodeURIComponent(bgmPath)}`

      const res = await api.post<{ job_id: string }>(url)
      const jobId = res.job_id
      exportAttemptsRef.current = 0
      exportIntervalRef.current = setInterval(async () => {
        exportAttemptsRef.current++
        try {
          const status = await api.get<{
            stage: string; progress: number; message: string; download_url?: string
          }>(`/compose/export/${jobId}/status`)

          setExportProgress(status.progress || 0)
          setExportMessage(status.message || '')
          if (status.download_url) setDownloadUrl(status.download_url)

          if (status.stage === 'done' || status.stage === 'failed' || exportAttemptsRef.current > 120) {
            clearExportPoll()
            if (exportAttemptsRef.current > 120 && status.stage !== 'done' && status.stage !== 'failed') {
              setExportMessage('导出超时，请重试')
            }
            setExporting(false)
          }
        } catch {
          if (exportAttemptsRef.current > 120) { clearExportPoll(); setExporting(false); setExportMessage('导出超时，请重试') }
        }
      }, 2000)
    } catch (e) {
      setExporting(false)
      setExportMessage('导出失败: ' + String(e))
    }
  }

  return {
    exporting,
    exportProgress,
    exportMessage,
    downloadUrl,
    setDownloadUrl,
    runPipeline,
    startExport,
  }
}
