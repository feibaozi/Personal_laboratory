interface PipelineProgressProps {
  status: 'idle' | 'narrating' | 'matching' | 'done' | 'failed'
  progress: number
  message: string
}

const STAGE_LABELS: Record<string, string> = {
  narrating: '生成分镜脚本...',
  matching: '匹配素材...',
  done: '完成',
  failed: '失败',
}

export default function PipelineProgress({ status, progress, message }: PipelineProgressProps) {
  if (status === 'idle') return null

  return (
    <div className="glass-card p-5 mb-4 animate-slide-up">
      <div className="flex items-center gap-3 mb-3">
        {status !== 'done' && status !== 'failed' && (
          <div className="animate-spin w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full" />
        )}
        {status === 'done' && (
          <span className="text-green-400 text-lg">✓</span>
        )}
        {status === 'failed' && (
          <span className="text-red-400 text-lg">✗</span>
        )}
        <span className="text-gray-300 font-medium">
          {STAGE_LABELS[status] || ''}
        </span>
        <span className="text-gray-500 text-sm ml-auto">
          {Math.round(progress * 100)}%
        </span>
      </div>

      <div className="w-full bg-gray-800 rounded-full h-2 mb-1">
        <div
          className={`h-2 rounded-full transition-all duration-500 ${
            status === 'failed' ? 'bg-red-500' : 'bg-primary-500'
          }`}
          style={{ width: `${Math.round(progress * 100)}%` }}
        />
      </div>

      {message && (
        <p className="text-gray-500 text-xs mt-2">{message}</p>
      )}
    </div>
  )
}