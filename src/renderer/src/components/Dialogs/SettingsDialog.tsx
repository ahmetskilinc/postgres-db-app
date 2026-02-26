import { useAppStore } from '../../store/useAppStore'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from '../ui/dialog'
import { Separator } from '../ui/separator'
import { Monitor, Moon, Sun } from 'lucide-react'
import { cn } from '../../lib/utils'
import { setAnalyticsEnabled } from '../../lib/analytics'

type ThemeOption = {
  value: 'auto' | 'dark' | 'light'
  label: string
  icon: React.ElementType
  description: string
}

const THEME_OPTIONS: ThemeOption[] = [
  { value: 'auto', label: 'Auto', icon: Monitor, description: 'Follow system' },
  { value: 'light', label: 'Light', icon: Sun, description: 'Always light' },
  { value: 'dark', label: 'Dark', icon: Moon, description: 'Always dark' }
]

const FONT_SIZES = [11, 12, 13, 14, 15, 16]

export function SettingsDialog(): JSX.Element {
  const {
    settingsOpen,
    closeSettings,
    themePreference,
    editorFontSize,
    analyticsEnabled,
    preReleaseUpdates,
    saveSettings
  } =
    useAppStore()

  const handleTheme = async (theme: 'auto' | 'dark' | 'light'): Promise<void> => {
    await saveSettings({ theme })
    if (theme === 'dark') {
      document.documentElement.classList.add('dark')
    } else if (theme === 'light') {
      document.documentElement.classList.remove('dark')
    }
  }

  const handleAnalyticsToggle = async (
    event: React.ChangeEvent<HTMLInputElement>
  ): Promise<void> => {
    const enabled = event.target.checked
    await saveSettings({ analyticsEnabled: enabled })
    setAnalyticsEnabled(enabled)
  }

  const handlePreReleaseToggle = async (
    event: React.ChangeEvent<HTMLInputElement>
  ): Promise<void> => {
    const enabled = event.target.checked
    await saveSettings({ preReleaseUpdates: enabled })
  }

  return (
    <Dialog open={settingsOpen} onOpenChange={(o) => !o && closeSettings()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Preferences</DialogTitle>
          <DialogDescription>Customize Table to your liking.</DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-1">
          <div className="space-y-2">
            <p className="text-xs font-medium text-foreground/70">Appearance</p>
            <div className="grid grid-cols-3 gap-2">
              {THEME_OPTIONS.map(({ value, label, icon: Icon, description }) => (
                <button
                  key={value}
                  onClick={() => handleTheme(value)}
                  className={cn(
                    'flex flex-col items-center gap-2 rounded-lg border px-3 py-3 text-xs transition-colors hover:bg-accent',
                    themePreference === value
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-border text-muted-foreground'
                  )}
                >
                  <Icon className="h-5 w-5" />
                  <div className="text-center">
                    <div className={cn('font-medium', themePreference === value && 'text-primary')}>
                      {label}
                    </div>
                    <div className="text-2xs opacity-70">{description}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <p className="text-xs font-medium text-foreground/70">Editor Font Size</p>
            <div className="flex gap-1.5">
              {FONT_SIZES.map((size) => (
                <button
                  key={size}
                  onClick={() => saveSettings({ editorFontSize: size })}
                  className={cn(
                    'flex h-7 w-10 items-center justify-center rounded-md border text-xs transition-colors',
                    editorFontSize === size
                      ? 'border-primary bg-primary/5 text-primary font-medium'
                      : 'border-border text-muted-foreground hover:bg-accent'
                  )}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>

          <Separator />

          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-xs font-medium text-foreground/70">Usage Analytics</p>
              <p className="text-2xs text-muted-foreground">
                Share anonymous usage data to improve Table.
              </p>
            </div>
            <input
              type="checkbox"
              checked={analyticsEnabled}
              onChange={handleAnalyticsToggle}
              className="h-4 w-4 rounded border-input"
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-xs font-medium text-foreground/70">Pre-release Updates</p>
              <p className="text-2xs text-muted-foreground">
                Receive preview builds before stable releases.
              </p>
            </div>
            <input
              type="checkbox"
              checked={preReleaseUpdates}
              onChange={handlePreReleaseToggle}
              className="h-4 w-4 rounded border-input"
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
