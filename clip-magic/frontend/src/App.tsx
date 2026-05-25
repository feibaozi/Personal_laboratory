import { useState, useCallback, useEffect, useRef } from 'react'
import InputPage from './components/InputPage'
import ProgressPage from './components/ProgressPage'
import ResultsPage from './components/ResultsPage'

export interface ClipResult {
  rank: number
  title: string
  start_ms: number
  end_ms: number
  reason: string
  score: number
  video_url: string
  subtitle_video_url: string
  cover_url: string
}

export interface JobState {
  jobId: string | null
  status: 'idle' | 'uploading' | 'processing' | 'done' | 'failed'
  stage: string
  progress: number
  message: string
  results: ClipResult[]
  error: string | null
  transcriptionMode: string
  analysisMode: string
  audioConfidence: number
}

const STAGES = [
  { key: 'starting', label: '任务初始化' },
  { key: 'extracting', label: '音轨分离' },
  { key: 'transcribing', label: '语音转文字' },
  { key: 'analyzing', label: 'AI 高光分析' },
  { key: 'clipping', label: '智能裁剪' },
  { key: 'post_processing', label: '封面字幕生成' },
]

function getWsUrl(jobId: string): string {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  const host = window.location.host
  return `${protocol}//${host}/ws/${jobId}`
}

export default function App() {
  const [job, setJob] = useState<JobState>({
    jobId: null,
    status: 'idle',
    stage: '',
    progress: 0,
    message: '',
    results: [],
    error: null,
    transcriptionMode: '',
    analysisMode: '',
    audioConfidence: 0,
  })

  const wsRef = useRef<WebSocket | null>(null)
  const pollRef = useRef<number | null>(null)

  const startJob = useCallback(async (jobId: string) => {
    setJob((prev) => ({ ...prev, jobId, status: 'processing', progress: 0 }))

    const socket = new WebSocket(getWsUrl(jobId))
    wsRef.current = socket

    socket.onopen = () => {
      socket.send('ping')
    }

    socket.onmessage = (e) => {
      const data = JSON.parse(e.data)
      setJob((prev) => ({
        ...prev,
        stage: data.stage,
        progress: data.progress,
        message: data.message,
        status: data.stage === 'done' ? 'done' : data.stage === 'failed' ? 'failed' : 'processing',
      }))
    }

    const poll = setInterval(async () => {
      try {
        const res = await fetch(`/api/jobs/${jobId}`)
        const data = await res.json()
        if (data.status === 'done' || data.status === 'failed') {
          clearInterval(poll)
          pollRef.current = null
          socket.close()
          wsRef.current = null
          setJob((prev) => ({
            ...prev,
            status: data.status,
            results: data.results || [],
            error: data.error || null,
            progress: 1,
            transcriptionMode: data.transcription_mode || '',
            analysisMode: data.analysis_mode || '',
            audioConfidence: data.audio_confidence || 0,
          }))
        }
      } catch {}
    }, 2000)
    pollRef.current = poll
  }, [])

  const reset = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
    wsRef.current?.close()
    wsRef.current = null
    setJob({
      jobId: null,
      status: 'idle',
      stage: '',
      progress: 0,
      message: '',
      results: [],
      error: null,
      transcriptionMode: '',
      analysisMode: '',
      audioConfidence: 0,
    })
  }, [])

  useEffect(() => {
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current)
      }
      wsRef.current?.close()
    }
  }, [])

  const getCurrentStageIndex = () => {
    if (job.status === 'done') return STAGES.length
    if (job.stage === 'failed') return -1
    return STAGES.findIndex((s) => s.key === job.stage)
  }

  const stageIndex = getCurrentStageIndex()

  return (
    <div className="min-h-screen flex flex-col items-center">
      {job.status === 'idle' && <InputPage onStart={startJob} />}

      {job.status === 'processing' && (
        <ProgressPage
          message={job.message}
          progress={job.progress}
          stageIndex={stageIndex}
          stages={STAGES}
          transcriptionMode={job.transcriptionMode}
          analysisMode={job.analysisMode}
          audioConfidence={job.audioConfidence}
        />
      )}

      {job.status === 'done' && (
        <ResultsPage
          results={job.results}
          jobId={job.jobId!}
          onNewJob={reset}
        />
      )}

      {job.status === 'failed' && (
        <div className="flex flex-col items-center justify-center min-h-screen px-6">
          <div className="glass-card p-10 max-w-md w-full text-center animate-slide-up">
            <div className="text-5xl mb-6">😞</div>
            <h2 className="text-xl font-semibold mb-3 text-red-400">处理失败</h2>
            <p className="text-white/50 mb-8 text-sm">{job.error || '未知错误'}</p>
            <button onClick={reset} className="btn-primary px-8 py-3 w-full">
              重新开始
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
