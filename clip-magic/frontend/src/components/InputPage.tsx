import { useState, useCallback, useRef } from 'react'

interface Props {
  onStart: (jobId: string) => void
}

export default function InputPage({ onStart }: Props) {
  const [url, setUrl] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [count, setCount] = useState(3)
  const [duration, setDuration] = useState(45)
  const [dragActive, setDragActive] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragActive(false)
    const f = e.dataTransfer.files[0]
    if (f && f.type.startsWith('video/')) {
      setFile(f)
      setUrl('')
      setError(null)
    }
  }, [])

  const handleSubmit = async () => {
    if (!file && !url) return
    setLoading(true)
    setError(null)

    const formData = new FormData()
    if (file) formData.append('file', file)
    if (url) formData.append('url', url)
    formData.append('count', String(count))
    formData.append('duration', String(duration))

    try {
      const res = await fetch('/api/jobs', { method: 'POST', body: formData })
      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: '未知错误' }))
        throw new Error(errData.error || '上传失败')
      }
      const data = await res.json()
      onStart(data.job_id)
    } catch (err: any) {
      setError(err.message || '上传失败')
      setLoading(false)
    }
  }

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6 py-12 w-full max-w-2xl">
      <div className="text-center mb-12 animate-fade-in">
        <div className="text-6xl mb-4">🎬</div>
        <h1 className="text-4xl font-bold bg-gradient-to-r from-accent-blue via-accent-purple to-accent-magenta bg-clip-text text-transparent">
          Clip Magic
        </h1>
        <p className="text-white/40 mt-3 text-lg">
          AI 自动识别精彩片段，一键生成短视频
        </p>
      </div>

      <div className="glass-card p-8 w-full animate-slide-up">
        <div
          className={`drop-zone p-12 text-center cursor-pointer transition-all ${
            dragActive ? 'active' : ''
          } ${file ? 'border-accent-blue/40 bg-accent-blue/5' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setDragActive(true) }}
          onDragLeave={() => setDragActive(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) { setFile(f); setUrl(''); setError(null) }
            }}
          />

          {file ? (
            <div className="space-y-2">
              <div className="text-4xl">📁</div>
              <p className="text-white font-medium truncate max-w-xs mx-auto">{file.name}</p>
              <p className="text-white/30 text-sm">
                {(file.size / (1024 * 1024)).toFixed(1)} MB
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="text-5xl">📤</div>
              <p className="text-white/60 text-lg">拖拽视频文件到此处</p>
              <p className="text-white/20 text-sm">或点击选择文件 · 支持 MP4/MOV/MKV</p>
            </div>
          )}
        </div>

        <div className="flex items-center gap-4 my-6">
          <div className="flex-1 h-px bg-white/6" />
          <span className="text-white/20 text-sm">或者</span>
          <div className="flex-1 h-px bg-white/6" />
        </div>

        <input
          type="text"
          value={url}
          onChange={(e) => { setUrl(e.target.value); setFile(null); setError(null) }}
          placeholder="粘贴 YouTube / B站 视频链接..."
          className="glass-input w-full px-5 py-4 text-base"
        />

        <div className="grid grid-cols-2 gap-4 mt-6">
          <div>
            <label className="block text-white/30 text-xs mb-2 uppercase tracking-wider">
              片段数量
            </label>
            <div className="flex gap-2">
              {[1, 2, 3, 5].map((n) => (
                <button
                  key={n}
                  onClick={() => setCount(n)}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                    count === n
                      ? 'bg-accent-blue/20 text-accent-blue border border-accent-blue/30'
                      : 'bg-white/5 text-white/40 border border-white/5 hover:bg-white/10'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-white/30 text-xs mb-2 uppercase tracking-wider">
              片段时长
            </label>
            <div className="flex gap-2">
              {[30, 45, 60, 90].map((d) => (
                <button
                  key={d}
                  onClick={() => setDuration(d)}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                    duration === d
                      ? 'bg-accent-amber/20 text-accent-amber border border-accent-amber/30'
                      : 'bg-white/5 text-white/40 border border-white/5 hover:bg-white/10'
                  }`}
                >
                  {formatTime(d)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {error && (
          <div className="mt-4 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            {error}
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={(!file && !url) || loading}
          className="btn-primary w-full py-4 text-lg mt-6 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              正在上传...
            </span>
          ) : (
            '开始智能剪辑'
          )}
        </button>
      </div>
    </div>
  )
}
