import { useState, useEffect, useCallback } from 'react'

interface ToastItem {
  id: number
  message: string
  type: 'error' | 'success' | 'info'
}

const MAX_TOASTS = 5
let toastId = 0
const listeners: Set<(toasts: ToastItem[]) => void> = new Set()
let currentToasts: ToastItem[] = []
const timerIds: Set<ReturnType<typeof setTimeout>> = new Set()

function notify() {
  listeners.forEach((l) => l([...currentToasts]))
}

export function showToast(message: string, type: ToastItem['type'] = 'error') {
  const id = ++toastId
  currentToasts = [...currentToasts, { id, message, type }].slice(-MAX_TOASTS)
  notify()
  const timerId = setTimeout(() => {
    timerIds.delete(timerId)
    currentToasts = currentToasts.filter((t) => t.id !== id)
    notify()
  }, 5000)
  timerIds.add(timerId)
}

export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  useEffect(() => {
    listeners.add(setToasts)
    return () => {
      listeners.delete(setToasts)
      // 组件卸载时批量清理所有定时器
      timerIds.forEach(clearTimeout)
      timerIds.clear()
    }
  }, [])

  const dismiss = useCallback((id: number) => {
    currentToasts = currentToasts.filter((t) => t.id !== id)
    notify()
  }, [])

  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`px-4 py-3 rounded-lg shadow-lg text-sm animate-slide-up cursor-pointer ${
            toast.type === 'error'
              ? 'bg-red-900/90 border border-red-700 text-red-200'
              : toast.type === 'success'
              ? 'bg-green-900/90 border border-green-700 text-green-200'
              : 'bg-gray-800 border border-gray-700 text-gray-200'
          }`}
          onClick={() => dismiss(toast.id)}
        >
          {toast.message}
        </div>
      ))}
    </div>
  )
}
