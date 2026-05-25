interface Stage {
  key: string
  label: string
}

interface Props {
  message: string
  progress: number
  stageIndex: number
  stages: Stage[]
  transcriptionMode?: string
  analysisMode?: string
  audioConfidence?: number
}

export default function ProgressPage({
  message, progress, stageIndex, stages,
  transcriptionMode, analysisMode, audioConfidence,
}: Props) {
  const showModes = stageIndex >= 2

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6 w-full max-w-lg">
      <div className="glass-card p-10 w-full animate-slide-up text-center">
        <div className="animate-pulse-slow text-5xl mb-6">⚡</div>
        <h2 className="text-xl font-semibold mb-3">AI 正在分析你的视频</h2>
        <p className="text-white/40 text-sm mb-4">{message}</p>

        {showModes && (
          <div className="flex gap-2 justify-center mb-6 flex-wrap">
            {transcriptionMode && (
              <span className={transcriptionMode === 'real'
                ? 'px-3 py-1 rounded-full text-xs bg-green-500/20 text-green-400 border border-green-500/30'
                : 'px-3 py-1 rounded-full text-xs bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'}>
                {transcriptionMode === 'real' ? '真实转录' : '模拟字幕'}
              </span>
            )}
            {analysisMode && (
              <span className={analysisMode === 'llm'
                ? 'px-3 py-1 rounded-full text-xs bg-green-500/20 text-green-400 border border-green-500/30'
                : 'px-3 py-1 rounded-full text-xs bg-blue-500/20 text-blue-400 border border-blue-500/30'}>
                {analysisMode === 'llm' ? 'LLM 分析' : '规则评分'}
              </span>
            )}
            {typeof audioConfidence === 'number' && (
              <span className={audioConfidence > 0.5
                ? 'px-3 py-1 rounded-full text-xs bg-green-500/20 text-green-400 border border-green-500/30'
                : 'px-3 py-1 rounded-full text-xs bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'}>
                音频 {(audioConfidence * 100).toFixed(0)}%
              </span>
            )}
          </div>
        )}

        <div className="progress-bar mb-8">
          <div
            className="progress-fill"
            style={{ width: `${Math.round(progress * 100)}%` }}
          />
        </div>

        <div className="space-y-4 text-left">
          {stages.map((stage, i) => {
            let cls = 'pending'
            if (i < stageIndex) cls = 'done'
            else if (i === stageIndex) cls = 'active'

            return (
              <div
                key={stage.key}
                className={`stage-indicator ${cls} flex items-center justify-between py-1`}
              >
                <span className={cls === 'pending' ? 'text-white/20' : cls === 'active' ? 'text-white font-medium' : 'text-green-400'}>
                  {stage.label}
                </span>
                {cls === 'done' && (
                  <svg className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                )}
                {cls === 'active' && (
                  <svg className="animate-spin w-4 h-4 text-accent-blue" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}