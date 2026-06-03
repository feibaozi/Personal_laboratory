import { useState } from 'react'
import type { Material, MatchResult } from '../../types'

interface MaterialPickerProps {
  shotDescription: string
  candidates: MatchResult[]
  materials: Material[]
  assignedMaterialId?: string
  onSelect: (materialId: string) => void
  onClose: () => void
  onAutoMatch: () => void
  isMatching: boolean
}

export default function MaterialPicker({
  shotDescription,
  candidates,
  materials,
  assignedMaterialId,
  onSelect,
  onClose,
  onAutoMatch,
  isMatching,
}: MaterialPickerProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const assignedId = assignedMaterialId

  const filteredMaterials = searchQuery.trim()
    ? materials.filter((m) =>
        m.filename.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : materials

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="glass-card w-full max-w-lg mx-4 p-6 max-h-[80vh] overflow-y-auto animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold">选择素材</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300">
            <svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor">
              <path d="M2.969 2.969a.75.75 0 0 1 1.062 0L8 6.939l3.969-3.97a.75.75 0 1 1 1.062 1.062L9.061 8l3.97 3.969a.75.75 0 0 1-1.062 1.062L8 9.061l-3.969 3.97a.75.75 0 0 1-1.062-1.062L6.939 8l-3.97-3.969a.75.75 0 0 1 0-1.062z" />
            </svg>
          </button>
        </div>

        <p className="text-gray-400 text-sm mb-3 line-clamp-2">{shotDescription}</p>

        {candidates.length > 0 && (
          <div className="mb-4">
            <p className="text-xs text-gray-500 mb-2">已匹配的结果：</p>
            <div className="space-y-1.5">
              {candidates.map((c) => (
                <div
                  key={c.material_id}
                  className="flex items-center gap-3 px-3 py-2 bg-gray-800/50 rounded-lg border border-gray-700/50"
                >
                  <span className="text-sm">
                    {c.media_type === 'video' ? '🎬' : c.media_type === 'image' ? '📷' : '🎵'}
                  </span>
                  <span className="flex-1 text-sm text-gray-200 truncate">{c.filename}</span>
                  <span className="text-xs text-primary-400">{c.score.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mb-3">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索素材（文件名或标签）..."
            className="input-field text-sm"
          />
        </div>

        <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">所有素材 ({filteredMaterials.length})</p>
        {materials.length === 0 && (
          <p className="text-gray-600 text-sm py-4 text-center">暂无素材，请先在素材篮中上传</p>
        )}
        <div className="space-y-1.5 max-h-48 overflow-y-auto">
          {filteredMaterials.map((m) => (
            <button
              key={m.id}
              onClick={() => onSelect(m.id)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left text-sm transition-all
                ${assignedId === m.id
                  ? 'bg-primary-900/30 border border-primary-700/50 text-primary-300'
                  : 'bg-gray-800/30 border border-gray-700/30 text-gray-300 hover:bg-gray-700/50'
                }`}
            >
              <span>{m.media_type === 'video' ? '🎬' : m.media_type === 'image' ? '📷' : '🎵'}</span>
              <span className="flex-1 truncate">{m.filename}</span>
              {assignedId === m.id && (
                <span className="text-xs text-primary-400">已选</span>
              )}
            </button>
          ))}
        </div>

        <div className="flex gap-3 mt-4">
          <button
            onClick={onAutoMatch}
            disabled={isMatching}
            className="btn-primary flex-1 disabled:opacity-50"
          >
            {isMatching ? '匹配中...' : '自动匹配'}
          </button>
          <button onClick={onClose} className="btn-secondary flex-1">
            关闭
          </button>
        </div>
      </div>
    </div>
  )
}
