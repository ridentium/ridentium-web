'use client'

import React from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

interface Props {
  children: React.ReactNode
  fallback?: string
}

interface State {
  hasError: boolean
}

export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error.message, info.componentStack?.slice(0, 200))
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="card flex flex-col items-center justify-center py-12 text-center gap-4">
          <AlertTriangle size={28} className="text-amber-400" />
          <div>
            <p className="text-sm font-medium text-cream">
              {this.props.fallback ?? 'Qualcosa è andato storto'}
            </p>
            <p className="text-xs text-stone mt-1">Prova a ricaricare la pagina</p>
          </div>
          <button
            onClick={() => this.setState({ hasError: false })}
            className="flex items-center gap-1.5 text-xs px-4 py-2 rounded border border-gold/30 bg-gold/10 text-gold hover:bg-gold/20 transition-colors"
          >
            <RefreshCw size={12} /> Riprova
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
