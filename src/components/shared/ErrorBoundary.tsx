import React from 'react'

interface State {
  error: Error | null
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  State
> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-cyan-100 via-pink-50 to-pink-200 p-8">
          <div className="max-w-md bg-white rounded-xl shadow-lg p-6 border-2 border-red-200">
            <h1 className="text-lg font-bold text-red-800 mb-2">Something went wrong</h1>
            <p className="text-sm text-gray-700 mb-4">{this.state.error.message}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="text-pink-600 underline text-sm font-medium"
            >
              Reload page
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
