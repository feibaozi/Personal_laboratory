import { Component, type ReactNode, type ErrorInfo } from 'react'

interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen p-8 flex items-center justify-center bg-gray-950">
          <div className="glass-card p-8 max-w-md w-full text-center">
            <div className="text-4xl mb-4">⚠️</div>
            <h1 className="text-xl font-bold text-red-400 mb-2">应用出错了</h1>
            <p className="text-gray-400 text-sm mb-4">
              {this.state.error?.message || '发生了未知错误'}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="btn-primary text-sm"
            >
              重新加载
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}