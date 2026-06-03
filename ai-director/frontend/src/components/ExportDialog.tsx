import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { api } from '../api/client'
import { showToast } from './Toast'

interface ExportDialogProps {
  open: boolean
  onClose: () => void
  onExport: (options: ExportOptions) => void
  exporting: boolean
}

export interface ExportOptions {
  includeSubtitles: boolean
  includeNarration: boolean
  bgmPath: string
}

export default function ExportDialog({ open, onClose, onExport, exporting }: ExportDialogProps) {
  const [includeSubtitles, setIncludeSubtitles] = useState(true)
  const [includeNarration, setIncludeNarration] = useState(false)
  const [bgmPath, setBgmPath] = useState('')
  const [bgmUploading, setBgmUploading] = useState(false)

  // 打开时重置表单状态
  useEffect(() => {
    if (open) {
      setIncludeSubtitles(true)
      setIncludeNarration(false)
      setBgmPath('')
      setBgmUploading(false)
    }
  }, [open])

  // Escape 键关闭
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  const handleBgmUpload = async (file: File) => {
    setBgmUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await api.upload<{ file_path: string }>('/materials/upload', formData)
      setBgmPath(res.file_path)
    } catch (e) {
      showToast('BGM 上传失败: ' + (e instanceof Error ? e.message : String(e)))
    } finally {
      setBgmUploading(false)
    }
  }

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="glass-card p-6 w-full max-w-md animate-slide-up">
        <h2 className="text-lg font-bold mb-4">导出视频</h2>

        <div className="space-y-4 mb-6">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={includeSubtitles}
              onChange={(e) => setIncludeSubtitles(e.target.checked)}
              className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-primary-500 focus:ring-primary-500"
            />
            <div>
              <span className="text-gray-200 text-sm">包含字幕</span>
              <p className="text-gray-500 text-xs">将旁白文本烧录为 ASS 字幕</p>
            </div>
          </label>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={includeNarration}
              onChange={(e) => setIncludeNarration(e.target.checked)}
              className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-primary-500 focus:ring-primary-500"
            />
            <div>
              <span className="text-gray-200 text-sm">包含旁白</span>
              <p className="text-gray-500 text-xs">使用 TTS 合成语音旁白（需 CosyVoice 2）</p>
            </div>
          </label>

          <div>
            <label className="block text-sm text-gray-300 mb-1">背景音乐</label>
            <input
              type="file"
              accept="audio/*"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) {
                  handleBgmUpload(file)
                }
              }}
              className="block w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4
                file:rounded-lg file:border-0 file:text-sm file:font-medium
                file:bg-primary-600 file:text-white hover:file:bg-primary-500
                file:cursor-pointer cursor-pointer"
            />
            {bgmUploading && <p className="text-xs text-gray-500 mt-1">上传中...</p>}
            {bgmPath && !bgmUploading && <p className="text-xs text-green-400 mt-1">已上传: {bgmPath}</p>}
          </div>
        </div>

        <div className="flex gap-3 justify-end">
          <button onClick={onClose} className="btn-secondary text-sm" disabled={exporting}>
            取消
          </button>
          <button
            onClick={() => onExport({ includeSubtitles, includeNarration, bgmPath })}
            disabled={exporting || bgmUploading}
            className="btn-primary text-sm disabled:opacity-50"
          >
            {exporting ? '导出中...' : '开始导出'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
