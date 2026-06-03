import { useState, useEffect } from 'react'
import { useProjectStore } from './stores/projectStore'
import { api } from './api/client'
import type { Material } from './types'
import { usePipeline } from './hooks/usePipeline'
import { ToastContainer, showToast } from './components/Toast'
import ExportDialog from './components/ExportDialog'
import StoryboardPage from './components/storyboard/StoryboardPage'

const NARRATIVE_LABELS: Record<string, string> = {
  three_act: '三幕式',
  five_stage: '五段式',
  montage: '蒙太奇',
  highlight_reel: '精彩集锦',
}

export default function App() {
  const {
    materials,
    addMaterial,
    script,
    shotMatches,
    pipelineStatus,
    pipelineProgress,
    pipelineMessage,
    currentMode,
    setMode,
    reset,
    narrativeType,
    setNarrativeType,
    targetDuration,
    setTargetDuration,
    fetchTransitions,
    exporting,
    exportProgress,
    exportMessage,
    downloadUrl,
    setDownloadUrl,
  } = useProjectStore()

  const [theme, setTheme] = useState('')
  const [uploading, setUploading] = useState(false)
  const [exportDialogOpen, setExportDialogOpen] = useState(false)

  const { runPipeline, startExport } = usePipeline()

  useEffect(() => {
    fetchTransitions()
  }, [fetchTransitions])

  const handleUpload = async (files: FileList | null) => {
    if (!files) return
    setUploading(true)
    const tasks = Array.from(files).map((file) => {
      const formData = new FormData()
      formData.append('file', file)
      return api.upload<{ material: Material }>('/materials/upload', formData)
        .then((res) => { addMaterial(res.material) })
        .catch((e) => { showToast('上传失败: ' + (e instanceof Error ? e.message : String(e))) })
    })
    await Promise.allSettled(tasks)
    setUploading(false)
  }

  const handleQuickGenerate = () => {
    if (materials.length === 0) {
      showToast('请先上传至少一个素材文件', 'info')
    }
    runPipeline({
      theme,
      narrativeType,
      duration: targetDuration,
      materialIds: materials.map((m) => m.id).join(','),
    })
  }

  const handleReset = () => {
    reset()
    setDownloadUrl(null)
  }

  if (currentMode === 'storyboard') {
    return (
      <>
        <StoryboardPage
          theme={theme}
          onThemeChange={setTheme}
          onUploadFiles={handleUpload}
          uploading={uploading}
        />
        <ToastContainer />
      </>
    )
  }

  if (pipelineStatus === 'done' && script) {
    return (
      <>
        <div className="min-h-screen p-6">
          <div className="max-w-4xl mx-auto animate-slide-up">
            <div className="glass-card p-8 mb-6">
              <h1 className="text-2xl font-bold mb-2">{script.theme}</h1>
              <p className="text-gray-400">
                {NARRATIVE_LABELS[script.narrative_type] || script.narrative_type}
                &nbsp;·&nbsp;{script.shots.length} 分镜· {script.target_duration_sec}s
              </p>
            </div>
            <div className="space-y-4">
              {script.shots.map((shot) => {
                const matches = shotMatches[shot.index] || []
                return (
                  <div key={shot.index} className="glass-card p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <span className="text-primary-400 font-bold text-lg mr-3">分镜 {shot.index}</span>
                        <span className="text-gray-400 text-sm">{shot.duration_sec}s · {shot.tone}</span>
                      </div>
                      <span className="text-xs text-gray-500 px-2 py-1 bg-gray-800 rounded">
                        {shot.transition_in} → {shot.transition_out}
                      </span>
                    </div>
                    <p className="text-gray-200 mb-3">{shot.description}</p>
                    {matches.length > 0 && (
                      <div className="flex gap-2 flex-wrap">
                        {matches.map((m) => (
                          <span key={m.material_id} className="text-xs px-3 py-1.5 bg-primary-900/50 text-primary-300 rounded-lg border border-primary-800/50">
                            {m.filename} ({m.score.toFixed(2)})
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {exporting && (
              <div className="glass-card p-5 mt-6">
                <div className="flex items-center gap-3 mb-3">
                  <div className="animate-spin w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full" />
                  <span className="text-gray-300">{exportMessage}</span>
                  <span className="text-gray-500 text-sm ml-auto">{Math.round(exportProgress * 100)}%</span>
                </div>
                <div className="w-full bg-gray-800 rounded-full h-2">
                  <div className="bg-primary-500 h-2 rounded-full transition-all duration-500" style={{ width: `${Math.round(exportProgress * 100)}%` }} />
                </div>
              </div>
            )}

            {downloadUrl && (
              <div className="glass-card p-5 mt-4 flex items-center gap-4">
                <span className="text-green-400">✓ 导出完成</span>
                <a href={downloadUrl} download className="btn-primary text-sm py-1.5 px-4">
                  下载视频
                </a>
              </div>
            )}

            <div className="mt-6 text-center">
              <button onClick={handleReset} className="btn-secondary mr-4">重新生成</button>
              <button
                onClick={() => setExportDialogOpen(true)}
                disabled={exporting}
                className="btn-primary disabled:opacity-50"
              >
                {exporting ? '导出中...' : '导出视频'}
              </button>
            </div>
          </div>
          <ToastContainer />
          <ExportDialog
            open={exportDialogOpen}
            onClose={() => setExportDialogOpen(false)}
            onExport={(opts) => { setExportDialogOpen(false); startExport(opts) }}
            exporting={exporting}
          />
        </div>
      </>
    )
  }

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-2xl mx-auto animate-slide-up">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold mb-2">AI Director</h1>
          <p className="text-gray-400">视频叙事自动化流水线</p>
        </div>

        <div className="flex gap-2 mb-6 justify-center">
          <button
            onClick={() => setMode('quick')}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-all bg-primary-600 text-white"
          >
            一键快剪
          </button>
          <button
            onClick={() => setMode('storyboard')}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-all bg-gray-800 text-gray-400"
          >
            分镜精控
          </button>
        </div>

        <div className="glass-card p-6 mb-6">
          <label className="block text-sm font-medium text-gray-300 mb-2">主题</label>
          <input
            type="text"
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
            placeholder="例如：我的2024年度回顾"
            className="input-field mb-4"
          />
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">叙事模板</label>
              <select value={narrativeType} onChange={(e) => setNarrativeType(e.target.value)} className="input-field">
                <option value="three_act">三幕式 (故事/Vlog)</option>
                <option value="five_stage">五段式 (知识/教程)</option>
                <option value="montage">蒙太奇 (混剪/纪念)</option>
                <option value="highlight_reel">精华集锦 (高光提取)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">目标时长 (秒)</label>
              <input type="number" value={targetDuration} onChange={(e) => setTargetDuration(Number(e.target.value))} min={10} max={600} className="input-field" />
            </div>
          </div>
        </div>

        <div className="glass-card p-6 mb-6">
          <label className="block text-sm font-medium text-gray-300 mb-2">素材 ({materials.length} 个)</label>
          <div
            className="border-2 border-dashed border-gray-700 rounded-xl p-8 text-center hover:border-primary-500 transition-colors cursor-pointer"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); handleUpload(e.dataTransfer.files) }}
            onClick={() => document.getElementById('file-input')?.click()}
          >
            <input id="file-input" type="file" multiple className="hidden" onChange={(e) => handleUpload(e.target.files)} accept="video/*,image/*,audio/*" />
            <p className="text-gray-400">{uploading ? '上传中...' : '拖拽素材到此处，或点击选择文件'}</p>
            <p className="text-gray-600 text-sm mt-1">支持视频、图片、音频</p>
          </div>
          {materials.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {materials.map((m) => (
                <span key={m.id} className="text-xs px-3 py-1.5 bg-gray-800 text-gray-300 rounded-lg flex items-center gap-2">
                  {m.media_type === 'video' ? '🎬' : m.media_type === 'image' ? '📷' : '🎵'}
                  {m.filename}
                </span>
              ))}
            </div>
          )}
        </div>

        {pipelineStatus === 'narrating' || pipelineStatus === 'matching' ? (
          <div className="glass-card p-6 mb-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="animate-spin w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full" />
              <span className="text-gray-300">{pipelineMessage}</span>
            </div>
            <div className="w-full bg-gray-800 rounded-full h-2">
              <div className="bg-primary-500 h-2 rounded-full transition-all duration-500" style={{ width: `${Math.round(pipelineProgress * 100)}%` }} />
            </div>
          </div>
        ) : (
          <div>
            {materials.length === 0 && theme.trim() && (
              <p className="text-center text-gray-500 text-sm mb-3">💡 建议先上传素材，AI 会自动匹配到分镜</p>
            )}
            <button
              onClick={handleQuickGenerate}
              disabled={!theme.trim() || ['narrating', 'matching'].includes(pipelineStatus)}
              className="btn-primary w-full py-4 text-lg"
            >
              生成分镜脚本
            </button>
          </div>
        )}
        {pipelineStatus === 'failed' && (
          <div className="mt-4 p-4 bg-red-900/30 border border-red-800 rounded-xl text-red-300">{pipelineMessage}</div>
        )}
      </div>
      <ToastContainer />
    </div>
  )
}
