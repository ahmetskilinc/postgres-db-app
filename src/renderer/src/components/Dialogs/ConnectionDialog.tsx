import { useState, useEffect } from 'react'
import { useAppStore } from '../../store/useAppStore'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from '../ui/dialog'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/tabs'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { CheckCircle2, Loader2, XCircle, ClipboardPaste } from 'lucide-react'
import { cn } from '../../lib/utils'

const CONNECTION_COLORS = [
  '#6366f1',
  '#8b5cf6',
  '#ec4899',
  '#ef4444',
  '#f97316',
  '#eab308',
  '#22c55e',
  '#14b8a6',
  '#3b82f6',
  '#06b6d4'
]

interface FormState {
  name: string
  host: string
  port: string
  database: string
  username: string
  password: string
  ssl: boolean
  color: string
}

const defaults: FormState = {
  name: '',
  host: 'localhost',
  port: '5432',
  database: 'postgres',
  username: 'postgres',
  password: '',
  ssl: false,
  color: CONNECTION_COLORS[0]
}

function parseConnectionString(raw: string): Partial<FormState> | null {
  try {
    const trimmed = raw.trim()
    if (!trimmed) return null

    if (!/^postgres(ql)?:\/\//i.test(trimmed)) return null
    const url = new URL(trimmed.replace(/^postgres(ql)?:\/\//i, 'http://'))

    const host = url.hostname || 'localhost'
    const port = url.port || '5432'
    const database = url.pathname.replace(/^\//, '') || 'postgres'
    const username = url.username ? decodeURIComponent(url.username) : 'postgres'
    const password = url.password ? decodeURIComponent(url.password) : ''
    const ssl = url.searchParams.get('sslmode') !== 'disable' &&
      (url.searchParams.has('sslmode') || url.searchParams.has('ssl') || host !== 'localhost')

    return { host, port, database, username, password, ssl }
  } catch {
    return null
  }
}

function buildConnectionString(form: FormState): string {
  if (!form.host) return ''
  const password = form.password ? `:${encodeURIComponent(form.password)}` : ''
  const user = form.username ? `${encodeURIComponent(form.username)}${password}@` : ''
  const sslParam = form.ssl ? '?sslmode=require' : ''
  return `postgresql://${user}${form.host}:${form.port}/${form.database}${sslParam}`
}

export function ConnectionDialog(): JSX.Element {
  const { connectionDialogOpen, editingConnectionId, connections, closeConnectionDialog } =
    useAppStore()
  const [tab, setTab] = useState<'fields' | 'string'>('fields')
  const [form, setForm] = useState<FormState>(defaults)
  const [connStr, setConnStr] = useState('')
  const [parseError, setParseError] = useState(false)
  const [testing, setTesting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [testResult, setTestResult] = useState<{
    success: boolean
    latencyMs?: number
    error?: string
  } | null>(null)

  useEffect(() => {
    if (!connectionDialogOpen) {
      setForm(defaults)
      setConnStr('')
      setTab('fields')
      setParseError(false)
      setTestResult(null)
      return
    }
    if (editingConnectionId) {
      const conn = connections.find((c) => c.id === editingConnectionId)
      if (conn) {
        const f: FormState = {
          name: conn.name,
          host: conn.host,
          port: String(conn.port),
          database: conn.database,
          username: conn.username,
          password: '',
          ssl: conn.ssl,
          color: conn.color
        }
        setForm(f)
        setConnStr(buildConnectionString(f))
      }
    } else {
      setForm(defaults)
      setConnStr('')
    }
  }, [connectionDialogOpen, editingConnectionId, connections])

  const field =
    (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value
      if (typeof value === 'string') {
        const parsed = parseConnectionString(value)
        if (parsed) {
          setForm((f) => {
            const next = { ...f, ...parsed }
            setConnStr(buildConnectionString(next))
            return next
          })
          setTab('string')
          setConnStr(value)
          return
        }
      }
      setForm((f) => {
        const next = { ...f, [key]: value }
        setConnStr(buildConnectionString(next))
        return next
      })
    }

  const handleConnStrChange = (value: string): void => {
    setConnStr(value)
    setParseError(false)
    if (!value.trim()) return
    const parsed = parseConnectionString(value)
    if (parsed) {
      setForm((f) => ({ ...f, ...parsed }))
      setParseError(false)
    } else {
      setParseError(true)
    }
  }

  const handleTabChange = (t: string): void => {
    setTab(t as 'fields' | 'string')
    if (t === 'string') {
      setConnStr(buildConnectionString(form))
    }
  }

  const getEffectiveForm = (): FormState => {
    if (tab === 'string' && connStr.trim()) {
      const parsed = parseConnectionString(connStr)
      if (parsed) return { ...form, ...parsed }
    }
    return form
  }

  const handleTest = async (): Promise<void> => {
    setTesting(true)
    setTestResult(null)
    try {
      const effective = getEffectiveForm()
      console.log('[handleTest] tab:', tab, 'connStr:', connStr, 'form.username:', form.username, 'effective.username:', effective.username)
      const result = await window.api.connections.test({
        host: effective.host,
        port: parseInt(effective.port) || 5432,
        database: effective.database,
        username: effective.username,
        password: effective.password,
        ssl: effective.ssl
      })
      setTestResult(result)
    } catch {
      setTestResult({ success: false, error: 'Unexpected error' })
    } finally {
      setTesting(false)
    }
  }

  const handleSave = async (): Promise<void> => {
    setSaving(true)
    try {
      const effective = getEffectiveForm()
      await window.api.connections.save({
        id: editingConnectionId ?? undefined,
        name: effective.name || `${effective.username}@${effective.host}`,
        host: effective.host,
        port: parseInt(effective.port) || 5432,
        database: effective.database,
        username: effective.username,
        password: effective.password,
        ssl: effective.ssl,
        color: effective.color
      })
      closeConnectionDialog()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={connectionDialogOpen} onOpenChange={(o) => !o && closeConnectionDialog()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{editingConnectionId ? 'Edit Connection' : 'New Connection'}</DialogTitle>
          <DialogDescription>
            Connect to a local or remote PostgreSQL database.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-1.5">
          <Label>Name</Label>
          <Input
            placeholder={form.username ? `${form.username}@${form.host}` : 'My Database'}
            value={form.name}
            onChange={field('name')}
          />
        </div>

        <Tabs value={tab} onValueChange={handleTabChange}>
          <TabsList className="w-full">
            <TabsTrigger value="fields" className="flex-1">
              Fields
            </TabsTrigger>
            <TabsTrigger value="string" className="flex-1">
              Connection String
            </TabsTrigger>
          </TabsList>

          <TabsContent value="fields" className="mt-3 space-y-3">
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2 grid gap-1.5">
                <Label>Host</Label>
                <Input placeholder="localhost" value={form.host} onChange={field('host')} />
              </div>
              <div className="grid gap-1.5">
                <Label>Port</Label>
                <Input type="number" placeholder="5432" value={form.port} onChange={field('port')} />
              </div>
            </div>

            <div className="grid gap-1.5">
              <Label>Database</Label>
              <Input placeholder="postgres" value={form.database} onChange={field('database')} />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="grid gap-1.5">
                <Label>Username</Label>
                <Input placeholder="postgres" value={form.username} onChange={field('username')} />
              </div>
              <div className="grid gap-1.5">
                <Label>Password</Label>
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={form.password}
                  onChange={field('password')}
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                id="ssl"
                type="checkbox"
                checked={form.ssl}
                onChange={field('ssl')}
                className="h-3.5 w-3.5 rounded border-input"
              />
              <Label htmlFor="ssl" className="cursor-pointer">
                Use SSL / TLS
              </Label>
            </div>
          </TabsContent>

          <TabsContent value="string" className="mt-3 space-y-3">
            <div className="grid gap-1.5">
              <div className="flex items-center justify-between">
                <Label>Connection String</Label>
                <button
                  onClick={async () => {
                    const text = await navigator.clipboard.readText()
                    handleConnStrChange(text)
                  }}
                  className="flex items-center gap-1 text-2xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ClipboardPaste className="h-3 w-3" />
                  Paste
                </button>
              </div>
              <textarea
                className={cn(
                  'flex min-h-[80px] w-full rounded-md border bg-background px-3 py-2 font-mono text-xs shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none',
                  parseError ? 'border-destructive' : 'border-input'
                )}
                placeholder="postgresql://user:password@host:5432/database?sslmode=require"
                value={connStr}
                onChange={(e) => handleConnStrChange(e.target.value)}
                spellCheck={false}
              />
              {parseError && (
                <p className="text-xs text-destructive">
                  Could not parse connection string. Expected format:
                  postgresql://user:pass@host:port/db
                </p>
              )}
            </div>

            {!parseError && form.host && (
              <div className="rounded-md border border-border bg-muted/40 px-3 py-2 space-y-1">
                {[
                  ['Host', `${form.host}:${form.port}`],
                  ['Database', form.database],
                  ['User', form.username],
                  ['SSL', form.ssl ? 'enabled' : 'disabled']
                ].map(([k, v]) => (
                  <div key={k} className="flex items-center gap-2 text-xs">
                    <span className="w-16 shrink-0 text-muted-foreground">{k}</span>
                    <span className="font-medium truncate">{v}</span>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        <div className="grid gap-1.5">
          <Label>Color</Label>
          <div className="flex gap-2">
            {CONNECTION_COLORS.map((color) => (
              <button
                key={color}
                onClick={() => setForm((f) => ({ ...f, color }))}
                className={cn(
                  'h-5 w-5 rounded-full transition-transform hover:scale-110',
                  form.color === color && 'ring-2 ring-ring ring-offset-2'
                )}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
        </div>

        {testResult && (
          <div
            className={cn(
              'flex items-center gap-2 rounded-md border px-3 py-2 text-xs',
              testResult.success
                ? 'border-green-500/30 bg-green-500/10 text-green-600 dark:text-green-400'
                : 'border-destructive/30 bg-destructive/10 text-destructive'
            )}
          >
            {testResult.success ? (
              <>
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                <span>Connected in {testResult.latencyMs}ms</span>
              </>
            ) : (
              <>
                <XCircle className="h-3.5 w-3.5 shrink-0" />
                <span className="line-clamp-2">{testResult.error}</span>
              </>
            )}
          </div>
        )}

        <div className="flex justify-between gap-2">
          <Button variant="outline" onClick={handleTest} disabled={testing || parseError}>
            {testing && <Loader2 className="h-3 w-3 animate-spin" />}
            Test Connection
          </Button>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={closeConnectionDialog}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving || parseError}>
              {saving && <Loader2 className="h-3 w-3 animate-spin" />}
              Save
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
