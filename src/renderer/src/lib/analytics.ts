import { createScript, isScriptInjected, track } from '@databuddy/sdk'

type EventProps = Record<string, unknown>

const blockedKeyPattern =
  /(password|token|secret|authorization|cookie|sql|query|connection|database_url|dsn|email|phone|address|ssn|credit)/i

let analyticsEnabled = true
let analyticsReady = false

function envClientId(): string | undefined {
  const meta = import.meta as ImportMeta & { env?: Record<string, string | undefined> }
  return meta.env?.VITE_DATABUDDY_CLIENT_ID
}

function sanitizeProperties(props: EventProps = {}): EventProps {
  const next: EventProps = {}
  for (const [key, value] of Object.entries(props)) {
    if (blockedKeyPattern.test(key)) continue
    if (value === null) {
      next[key] = null
      continue
    }
    const type = typeof value
    if (type === 'string') {
      const stringValue = value as string
      next[key] = stringValue.length > 200 ? stringValue.slice(0, 200) : stringValue
      continue
    }
    if (type === 'number' || type === 'boolean') {
      next[key] = value
      continue
    }
  }
  return next
}

export function setAnalyticsEnabled(enabled: boolean): void {
  analyticsEnabled = enabled
}

export function initAnalytics(enabled: boolean): void {
  analyticsEnabled = enabled
  const clientId = envClientId()
  if (!analyticsEnabled || !clientId || typeof window === 'undefined') return
  if (analyticsReady || isScriptInjected()) {
    analyticsReady = true
    return
  }
  const script = createScript({
    clientId,
    trackErrors: false,
    trackWebVitals: false,
    trackPerformance: false,
    trackInteractions: false,
    trackOutgoingLinks: false
  })
  document.head.appendChild(script)
  analyticsReady = true
}

export function trackEvent(name: string, properties?: EventProps): void {
  if (!analyticsEnabled) return
  if (!envClientId()) return
  track(name, sanitizeProperties(properties))
}

export function toBucket(value: number, bounds: number[]): string {
  for (const bound of bounds) {
    if (value <= bound) return `le_${bound}`
  }
  return `gt_${bounds[bounds.length - 1]}`
}
