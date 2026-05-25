import type { ClipResult } from '../App'

interface Props {
  results: ClipResult[]
  jobId: string
  onNewJob: () => void
}

export default function ResultsPage({ results, jobId, onNewJob }: Props) {
  const formatTime = (ms: number) => {
    const m = Math.floor(ms / 60000)
    const s = Math.floor((ms % 60000) / 1000)
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }

  return (
    <div className="w-full max-w-5xl px-6 py-12">
      <div className="text-center mb-12 animate-fade-in">
        <div className="text-5xl mb-4">✨</div>
        <h2 className="text-3xl font-bold bg-gradient-to-r from-accent-cyan via-accent-blue to-accent-purple bg-clip-text text-transparent">
          高光片段已就绪
        </h2>
        <p className="text-white/30 mt-2">
          共 {results.length} 个片段，可直接下载发布
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {results.map((clip, i) => (
          <div
            key={clip.rank}
            className="clip-card animate-slide-up"
            style={{ animationDelay: `${i * 0.15}s` }}
          >
            <div className="relative aspect-[9/16] bg-surface-1 overflow-hidden">
              {clip.cover_url ? (
                <img
                  src={clip.cover_url}
                  alt={clip.title}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none'
                  }}
                />
              ) : null}
              <div className="absolute inset-0 bg-gradient-to-t from-surface-0 via-transparent to-transparent" />

              <div className="absolute top-4 left-4">
                <span className="px-3 py-1.5 rounded-full bg-accent-amber/20 text-accent-amber text-xs font-bold border border-accent-amber/20 backdrop-blur-sm">
                  #{clip.rank}
                </span>
              </div>

              <div className="absolute bottom-4 left-4 right-4">
                <h3 className="text-white font-bold text-base leading-tight mb-1 drop-shadow-lg">
                  {clip.title}
                </h3>
                <span className="text-white/40 text-xs font-mono">
                  {formatTime(clip.start_ms)} — {formatTime(clip.end_ms)}
                </span>
              </div>
            </div>

            <div className="p-5 space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-white/30 text-xs">精彩指数</span>
                    <span className="text-accent-amber text-sm font-bold font-mono">
                      {clip.score.toFixed(1)}
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-accent-amber to-accent-magenta transition-all"
                      style={{ width: `${(clip.score / 10) * 100}%` }}
                    />
                  </div>
                </div>
              </div>

              {clip.reason && (
                <p className="text-white/40 text-xs leading-relaxed italic">
                  "{clip.reason}"
                </p>
              )}

              <div className="flex gap-2">
                <a
                  href={clip.video_url}
                  download
                  className="flex-1 text-center py-2.5 rounded-xl bg-white/5 text-white/70 text-sm font-medium border border-white/5 hover:bg-white/10 hover:text-white transition-all"
                >
                  原片
                </a>
                <a
                  href={clip.subtitle_video_url}
                  download
                  className="flex-1 text-center py-2.5 rounded-xl bg-accent-purple/10 text-accent-purple text-sm font-medium border border-accent-purple/20 hover:bg-accent-purple/20 transition-all"
                >
                  字幕版
                </a>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="text-center mt-12 animate-fade-in" style={{ animationDelay: '0.6s' }}>
        <button
          onClick={onNewJob}
          className="text-white/30 hover:text-white/60 text-sm transition-colors underline underline-offset-4"
        >
          处理新视频 →
        </button>
      </div>
    </div>
  )
}
