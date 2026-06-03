import { useRef, useEffect, useCallback } from 'react'
import type { ShotSpec } from '../../types'

interface TimelineProps {
  shots: ShotSpec[]
  totalDuration: number
  selectedIndex: number | null
  onSelectShot: (index: number) => void
}

const SHOT_COLORS = [
  '#6366f1', '#8b5cf6', '#a855f7', '#d946ef',
  '#ec4899', '#f43f5e', '#f97316', '#eab308',
]

// 辅助函数：hex 转 rgba
function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

export default function Timeline({ shots, totalDuration, selectedIndex, onSelectShot }: TimelineProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    const dpr = window.devicePixelRatio || 1
    const rect = container.getBoundingClientRect()
    const w = rect.width
    const h = rect.height
    canvas.width = w * dpr
    canvas.height = h * dpr
    canvas.style.width = w + 'px'
    canvas.style.height = h + 'px'

    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.scale(dpr, dpr)

    ctx.clearRect(0, 0, w, h)

    if (shots.length === 0 || totalDuration <= 0) return

    const padding = 4
    const shotH = h - padding * 2
    const radius = 6

    shots.forEach((shot, idx) => {
      const xRatio = shots.slice(0, idx).reduce((s, sh) => s + sh.duration_sec, 0) / totalDuration
      const widthRatio = shot.duration_sec / totalDuration
      const x = padding + xRatio * (w - padding * 2)
      const sw = widthRatio * (w - padding * 2)
      const isSelected = shot.index === selectedIndex

      const color = SHOT_COLORS[idx % SHOT_COLORS.length]

      ctx.beginPath()
      ctx.moveTo(x + radius, padding)
      ctx.lineTo(x + sw - radius, padding)
      ctx.quadraticCurveTo(x + sw, padding, x + sw, padding + radius)
      ctx.lineTo(x + sw, padding + shotH - radius)
      ctx.quadraticCurveTo(x + sw, padding + shotH, x + sw - radius, padding + shotH)
      ctx.lineTo(x + radius, padding + shotH)
      ctx.quadraticCurveTo(x, padding + shotH, x, padding + shotH - radius)
      ctx.lineTo(x, padding + radius)
      ctx.quadraticCurveTo(x, padding, x + radius, padding)
      ctx.closePath()

      ctx.fillStyle = isSelected ? color : hexToRgba(color, 0.25)
      ctx.fill()

      if (isSelected) {
        ctx.strokeStyle = '#fff'
        ctx.lineWidth = 2
        ctx.stroke()
      }

      if (sw > 40) {
        const label = `S${shot.index}`
        ctx.fillStyle = sw > 40 && sw < 60 ? '#a5b4fc' : '#fff'
        ctx.font = sw < 60 ? '9px sans-serif' : '11px sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        const labelX = x + sw / 2
        const labelY = padding + shotH / 2

        if (sw > 60) {
          ctx.fillText(label, labelX, labelY - 7)
          ctx.font = '9px sans-serif'
          ctx.fillStyle = 'rgba(255,255,255,0.6)'
          ctx.fillText(`${shot.duration_sec}s`, labelX, labelY + 7)
        } else {
          ctx.fillText(label, labelX, labelY)
        }
      }
    })
  }, [shots, totalDuration, selectedIndex])

  useEffect(() => {
    draw()
  }, [draw])

  // resize 监听
  useEffect(() => {
    const handleResize = () => draw()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [draw])

  const handleClick = (e: React.MouseEvent) => {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    const x = e.clientX - rect.left
    const w = rect.width
    const padding = 4
    const relativeX = (x - padding) / (w - padding * 2)

    if (relativeX < 0 || relativeX > 1) return

    let accumulated = 0
    for (const shot of shots) {
      const ratio = shot.duration_sec / totalDuration
      if (relativeX >= accumulated && relativeX < accumulated + ratio) {
        onSelectShot(shot.index)
        return
      }
      accumulated += ratio
    }
  }

  return (
    <div className="glass-card p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-gray-300">时间线预览</span>
        <span className="text-xs text-gray-500">总时长: {formatDuration(totalDuration)}</span>
      </div>
      <div
        ref={containerRef}
        onClick={handleClick}
        className="relative w-full h-14 cursor-pointer rounded-lg overflow-hidden bg-gray-900/50"
      >
        <canvas ref={canvasRef} className="absolute inset-0" />
      </div>
    </div>
  )
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}