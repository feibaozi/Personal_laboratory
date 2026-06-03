import { useState } from 'react'
import type { ShotSpec } from '../../types'

type ToneValue = ShotSpec['tone']

interface ShotCardProps {
  shot: ShotSpec
  isSelected: boolean
  dragHandleProps?: React.HTMLAttributes<HTMLElement>
  onSelect: () => void
  onUpdate: (patch: Partial<ShotSpec>) => void
  onDelete: () => void
  onOpenMatcher: () => void
  transitions: string[]
}

const TONES: Record<ToneValue, string> = {
  calm: '平静',
  excited: '激昂',
  tense: '紧张',
  warm: '温暖',
  reflective: '反思',
  neutral: '中性',
}
const TONE_ORDER: ToneValue[] = Object.keys(TONES) as ToneValue[]

export default function ShotCard({
  shot,
  isSelected,
  dragHandleProps,
  onSelect,
  onUpdate,
  onDelete,
  onOpenMatcher,
  transitions,
}: ShotCardProps) {
  const [localDuration, setLocalDuration] = useState(String(shot.duration_sec))

  // shot.duration_sec 变化时同步本地状态
  const currentDuration = String(shot.duration_sec)
  if (localDuration !== currentDuration && parseFloat(localDuration) !== shot.duration_sec) {
    setLocalDuration(currentDuration)
  }

  return (
    <div
      onClick={onSelect}
      className={`glass-card p-4 cursor-pointer transition-all duration-200 border
        ${isSelected ? 'border-primary-500 ring-1 ring-primary-500/50' : 'border-gray-800 hover:border-gray-600'}`}
    >
      <div className="flex items-center gap-3 mb-3">
        <button
          {...dragHandleProps}
          className="text-gray-500 hover:text-gray-300 cursor-grab active:cursor-grabbing p-1"
          onClick={(e) => e.stopPropagation()}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <circle cx="5" cy="3" r="1.5" />
            <circle cx="11" cy="3" r="1.5" />
            <circle cx="5" cy="8" r="1.5" />
            <circle cx="11" cy="8" r="1.5" />
            <circle cx="5" cy="13" r="1.5" />
            <circle cx="11" cy="13" r="1.5" />
          </svg>
        </button>

        <span className="text-primary-400 font-bold text-sm">分镜 {shot.index}</span>

        {isSelected ? (
          <input
            value={localDuration}
            onChange={(e) => setLocalDuration(e.target.value)}
            onBlur={() => {
              const v = parseFloat(localDuration)
              if (!isNaN(v) && v > 0) onUpdate({ duration_sec: v })
              else setLocalDuration(String(shot.duration_sec))
            }}
            className="w-16 px-2 py-0.5 bg-gray-800 border border-gray-600 rounded text-gray-200 text-sm text-center"
            onClick={(e) => e.stopPropagation()}
            type="number"
            step="0.5"
            min="1"
          />
        ) : (
          <span className="text-gray-400 text-sm">{shot.duration_sec}s</span>
        )}

        <div className="flex-1" />

        <span
          className="text-xs px-2 py-0.5 rounded bg-gray-800 text-gray-400 cursor-pointer hover:bg-gray-700"
          onClick={(e) => {
            e.stopPropagation()
            const idx = TONE_ORDER.indexOf(shot.tone)
            const next = TONE_ORDER[(idx + 1) % TONE_ORDER.length]
            onUpdate({ tone: next })
          }}
          title={`点击切换情绪 (当前: ${TONES[shot.tone] || shot.tone}，下一个: ${TONES[TONE_ORDER[(TONE_ORDER.indexOf(shot.tone) + 1) % TONE_ORDER.length]]})`}
        >
          {TONES[shot.tone] || shot.tone}
        </span>

        {isSelected && (
          <select
            value={shot.transition_out}
            onChange={(e) => {
              e.stopPropagation()
              onUpdate({ transition_out: e.target.value })
            }}
            onClick={(e) => e.stopPropagation()}
            className="text-xs px-1.5 py-0.5 bg-gray-800 border border-gray-700 rounded text-gray-400 max-w-[120px]"
          >
            {transitions.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        )}

        <button
          onClick={(e) => {
            e.stopPropagation()
            onOpenMatcher()
          }}
          className="text-xs px-2 py-0.5 rounded bg-primary-900/40 text-primary-300
                     hover:bg-primary-800/50 border border-primary-700/30"
        >
          选素材
        </button>

        <button
          onClick={(e) => {
            e.stopPropagation()
            onDelete()
          }}
          className="text-gray-600 hover:text-red-400 p-1"
          title="删除分镜"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
            <path d="M5 2V1h6v1h4v2h-1v10a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V4H1V2h4zm1 2H4v9h1V4zm3 0H7v9h1V4zm3 0h-1v9h2V4z" />
          </svg>
        </button>
      </div>

      {isSelected ? (
        <textarea
          value={shot.description}
          onChange={(e) => onUpdate({ description: e.target.value })}
          onClick={(e) => e.stopPropagation()}
          className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg
                     text-gray-200 text-sm resize-none focus:outline-none focus:border-primary-500"
          rows={2}
          placeholder="用中文描述这个镜头应该展示什么画面..."
        />
      ) : (
        <p className="text-gray-300 text-sm line-clamp-2">{shot.description}</p>
      )}
    </div>
  )
}
