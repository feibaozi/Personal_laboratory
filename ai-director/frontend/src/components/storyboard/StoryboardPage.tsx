import { useState } from 'react'
import { useProjectStore } from '../../stores/projectStore'
import { api } from '../../api/client'
import type { MatchResult } from '../../types'
import { usePipeline } from '../../hooks/usePipeline'
import { ToastContainer, showToast } from '../Toast'
import StoryboardPanel from './StoryboardPanel'
import MaterialPicker from './MaterialPicker'
import PipelineProgress from '../pipeline/PipelineProgress'
import Timeline from '../timeline/Timeline'

const NARRATIVE_LABELS: Record<string, string> = {
  three_act: '三幕式',
  five_stage: '五段式',
  montage: '蒙太奇',
  highlight_reel: '精彩集锦',
}

interface StoryboardPageProps {
  theme: string
  onThemeChange: (theme: string) => void
  onUploadFiles: (files: FileList | null) => void
  uploading: boolean
}

export default function StoryboardPage({
  theme,
  onThemeChange,
  onUploadFiles,
  uploading,
}: StoryboardPageProps) {
  const {
    materials,
    script,
    shotMatches,
    setShotMatches,
    updateShot,
    reorderShots,
    deleteShot,
    addShot,
    selectedShotIndex,
    setSelectedShot,
    pipelineStatus,
    pipelineProgress,
    pipelineMessage,
    setPipelineStatus,
    assignMaterial,
    narrativeType,
    setNarrativeType,
    targetDuration,
    setTargetDuration,
    setMode,
    exporting,
    exportProgress,
    exportMessage,
    downloadUrl,
    setDownloadUrl,
    reset,
    transitions,
  } = useProjectStore()

  const [matcherOpen, setMatcherOpen] = useState(false)
  const [matchingShot, setMatchingShot] = useState(false)

  const { runPipeline, startExport } = usePipeline()

  const totalDuration = script
    ? script.shots.reduce((sum, s) => sum + s.duration_sec, 0)
    : 0

  const handleGenerate = () => {
    runPipeline({
      theme,
      narrativeType,
      duration: targetDuration,
      materialIds: materials.map((m) => m.id).join(','),
    })
    setSelectedShot(null)
  }

  const handleAutoMatchOne = async (shotIndex: number) => {
    setMatchingShot(true)
    try {
      const description = script?.shots.find(s => s.index === shotIndex)?.description || ''
      const results = await api.get<MatchResult[]>(`/materials/match?description=${encodeURIComponent(description)}&top_k=5`)
      setShotMatches({ ...shotMatches, [shotIndex]: results })
      assignMaterial(shotIndex, results[0]?.material_id || '')
    } catch (e) {
      showToast('素材匹配失败: ' + (e instanceof Error ? e.message : String(e)))
    }
    setMatchingShot(false)
  }

  const handleReset = () => {
    reset()
    setDownloadUrl(null)
  }

  const selectedShot = script?.shots.find((s) => s.index === selectedShotIndex)

  const isDone = pipelineStatus === 'done' && script

  return (
    <div className="h-screen flex flex-col">
      <header className="flex items-center gap-4 px-6 py-3 border-b border-gray-800 bg-gray-950/80 backdrop-blur">
        <h1 className="text-lg font-bold text-primary-400">AI Director</h1>
        <span className="text-gray-600">·</span>
        <div className="flex gap-1">
          <button
            onClick={() => setMode('quick')}
            className="px-3 py-1 rounded-lg text-xs font-medium bg-gray-800 text-gray-400 hover:text-gray-200"
          >
            一键快剪
          </button>
          <button
            className="px-3 py-1 rounded-lg text-xs font-medium bg-primary-600 text-white"
          >
            分镜精控
          </button>
        </div>
        <div className="flex-1" />
        {isDone && (
          <button onClick={handleReset} className="btn-secondary text-sm">
            重新生成
          </button>
        )}
        <button
          onClick={() => startExport()}
          className="btn-primary text-sm disabled:opacity-50"
          disabled={!isDone || exporting}
        >
          {exporting ? '导出中...' : '导出视频'}
        </button>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <div className="w-64 border-r border-gray-800 p-4 overflow-y-auto shrink-0">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">素材篮</h2>
          <div
            className="border-2 border-dashed border-gray-700 rounded-xl p-4 text-center
                       hover:border-primary-500 transition-colors cursor-pointer mb-3"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault()
              onUploadFiles(e.dataTransfer.files)
            }}
            onClick={() => document.getElementById('mat-upload')?.click()}
          >
            <input
              id="mat-upload"
              type="file"
              multiple
              className="hidden"
              onChange={(e) => onUploadFiles(e.target.files)}
              accept="video/*,image/*,audio/*"
            />
            <p className="text-gray-500 text-sm">
              {uploading ? '上传中...' : '拖拽或点击上传素材'}
            </p>
          </div>
          <div className="space-y-1">
            {materials.map((m) => (
              <div
                key={m.id}
                className="px-2 py-1.5 rounded-lg bg-gray-800/50 text-xs text-gray-400 flex items-center gap-2"
              >
                <span>{m.media_type === 'video' ? '🎬' : m.media_type === 'image' ? '📷' : '🎵'}</span>
                <span className="truncate flex-1">{m.filename}</span>
              </div>
            ))}
            {materials.length === 0 && (
              <p className="text-gray-700 text-xs text-center py-4">暂无素材</p>
            )}
          </div>
        </div>

        <div className="flex-1 flex flex-col overflow-hidden">
          {!isDone ? (
            <div className="flex-1 flex items-center justify-center p-8">
              <div className="max-w-lg w-full">
                {pipelineStatus !== 'idle' ? (
                  <PipelineProgress
                    status={pipelineStatus}
                    progress={pipelineProgress}
                    message={pipelineMessage}
                  />
                ) : null}

                <div className="glass-card p-6">
                  <label className="block text-sm font-medium text-gray-300 mb-2">主题</label>
                  <input
                    type="text"
                    value={theme}
                    onChange={(e) => onThemeChange(e.target.value)}
                    placeholder="例如：我的2024年度回顾"
                    className="input-field mb-4"
                  />
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">叙事模板</label>
                      <select
                        value={narrativeType}
                        onChange={(e) => setNarrativeType(e.target.value)}
                        className="input-field"
                      >
                        <option value="three_act">三幕式</option>
                        <option value="five_stage">五段式</option>
                        <option value="montage">蒙太奇</option>
                        <option value="highlight_reel">精华集锦</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">时长 (秒)</label>
                      <input
                        type="number"
                        value={targetDuration}
                        onChange={(e) => setTargetDuration(Number(e.target.value))}
                        min={10}
                        max={600}
                        className="input-field"
                      />
                    </div>
                  </div>
                  <button
                    onClick={handleGenerate}
                    disabled={!theme.trim() || pipelineStatus === 'narrating' || pipelineStatus === 'matching'}
                    className="btn-primary w-full py-3"
                  >
                    生成分镜脚本
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto p-6">
              <div className="mb-4">
                <h2 className="text-lg font-bold">{script.theme}</h2>
                <p className="text-sm text-gray-400">
                  {NARRATIVE_LABELS[script.narrative_type] || script.narrative_type}
                  &nbsp;·&nbsp;{script.shots.length} 分镜&nbsp;·&nbsp;{totalDuration}s
                </p>
              </div>

              <Timeline
                shots={script.shots}
                totalDuration={totalDuration}
                selectedIndex={selectedShotIndex}
                onSelectShot={(idx) => setSelectedShot(idx)}
              />

              {exporting && (
                <div className="glass-card p-4 mt-4">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="animate-spin w-4 h-4 border-2 border-primary-500 border-t-transparent rounded-full" />
                    <span className="text-sm text-gray-300">{exportMessage}</span>
                    <span className="text-xs text-gray-500 ml-auto">{Math.round(exportProgress * 100)}%</span>
                  </div>
                  <div className="w-full bg-gray-800 rounded-full h-1.5">
                    <div className="bg-primary-500 h-1.5 rounded-full transition-all duration-500" style={{ width: `${Math.round(exportProgress * 100)}%` }} />
                  </div>
                </div>
              )}

              {downloadUrl && (
                <div className="glass-card p-4 mt-4 flex items-center gap-4">
                  <span className="text-green-400 text-sm">✓ 导出完成</span>
                  <a href={downloadUrl} download className="btn-primary text-sm py-1.5 px-4">
                    下载视频
                  </a>
                </div>
              )}

              <div className="flex gap-4 mt-4">
                <div className="flex-1">
                  <StoryboardPanel
                    shots={script.shots}
                    selectedIndex={selectedShotIndex}
                    onSelectShot={(idx) => setSelectedShot(idx)}
                    onUpdateShot={(idx, patch) => updateShot(idx, patch)}
                    onReorderShots={(from, to) => reorderShots(from, to)}
                    onDeleteShot={(idx) => deleteShot(idx)}
                    onAddShot={() => addShot(script.shots.length)}
                    onOpenMatcher={(idx) => {
                      setSelectedShot(idx)
                      setMatcherOpen(true)
                    }}
                    transitions={transitions}
                  />
                </div>

                <div className="w-72 shrink-0">
                  {selectedShot ? (
                    <div className="glass-card p-5 sticky top-4">
                      <h3 className="text-sm font-semibold text-gray-300 mb-3">
                        分镜 {selectedShot.index} 详情
                      </h3>
                      <p className="text-sm text-gray-400 mb-4">{selectedShot.description}</p>

                      <div className="space-y-3 text-sm">
                        <div className="flex justify-between text-gray-500">
                          <span>时长</span>
                          <span className="text-gray-300">{selectedShot.duration_sec}s</span>
                        </div>
                        <div className="flex justify-between text-gray-500">
                          <span>情绪</span>
                          <span className="text-gray-300">{selectedShot.tone}</span>
                        </div>
                        <div className="flex justify-between text-gray-500">
                          <span>转场</span>
                          <span className="text-gray-300">
                            {selectedShot.transition_in} → {selectedShot.transition_out}
                          </span>
                        </div>
                      </div>

                      {(shotMatches[selectedShot.index] || []).length > 0 && (
                        <div className="mt-4 pt-4 border-t border-gray-800">
                          <p className="text-xs text-gray-500 mb-2">已匹配素材</p>
                          {shotMatches[selectedShot.index].map((m) => (
                            <div key={m.material_id} className="text-xs text-primary-300 truncate">
                              {m.filename}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="glass-card p-5 text-center text-gray-600 text-sm">
                      <p>选择左侧分镜</p>
                      <p>查看详情</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {matcherOpen && selectedShotIndex !== null && (
        <MaterialPicker
          shotDescription={script?.shots.find((s) => s.index === selectedShotIndex)?.description || ''}
          candidates={shotMatches[selectedShotIndex] || []}
          materials={materials}
          assignedMaterialId={script?.shots.find((s) => s.index === selectedShotIndex)?.assigned_material_id}
          onSelect={(materialId) => {
            assignMaterial(selectedShotIndex, materialId)
            setMatcherOpen(false)
          }}
          onClose={() => setMatcherOpen(false)}
          onAutoMatch={() => handleAutoMatchOne(selectedShotIndex)}
          isMatching={matchingShot}
        />
      )}
      <ToastContainer />
    </div>
  )
}