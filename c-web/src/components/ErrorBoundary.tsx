import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Icon } from './Icon'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // In production, send to error monitoring (e.g. Sentry)
    console.error('[ErrorBoundary] Uncaught error:', error, info.componentStack)
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback

      return (
        <div
          role="alert"
          style={{
            minHeight: '100dvh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '1.5rem',
            padding: '2rem',
            textAlign: 'center',
            background: 'var(--surface-1, #0f172a)',
            color: 'var(--text-1, #f8fafc)',
          }}
        >
          <span style={{ fontSize: '3rem' }}>
            <Icon name="help" />
          </span>
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem' }}>
              Something went wrong
            </h1>
            <p style={{ opacity: 0.7, maxWidth: '36ch', margin: '0 auto' }}>
              Turiya Mobility encountered an unexpected error. Your bookings and account data are safe.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center' }}>
            <button
              className="button button-primary"
              onClick={this.handleReset}
              type="button"
            >
              Try again
            </button>
            <button
              className="button"
              onClick={() => window.location.assign('/')}
              type="button"
            >
              Go home
            </button>
          </div>
          {import.meta.env.DEV && this.state.error ? (
            <pre
              style={{
                fontSize: '0.75rem',
                opacity: 0.5,
                maxWidth: '60ch',
                overflow: 'auto',
                textAlign: 'left',
                background: 'rgba(0,0,0,0.3)',
                padding: '1rem',
                borderRadius: '8px',
              }}
            >
              {this.state.error.message}
              {this.state.error.stack}
            </pre>
          ) : null}
        </div>
      )
    }

    return this.props.children
  }
}
