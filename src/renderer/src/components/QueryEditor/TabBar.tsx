import { useAppStore } from '../../store/useAppStore'
import { Button } from '../ui/button'
import { Plus, X, Table2, Code2 } from 'lucide-react'
import { cn } from '../../lib/utils'

export function TabBar(): JSX.Element {
  const { tabs, activeTabId, addTab, closeTab, setActiveTab } = useAppStore()

  return (
    <div className="flex h-8 items-center border-b border-border bg-background px-2 gap-0.5 overflow-x-auto shrink-0">
      <div className="flex items-center gap-0.5 overflow-x-auto">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'group flex h-7 max-w-[160px] cursor-pointer items-center gap-1.5 rounded-md px-2.5 text-xs transition-colors shrink-0',
              activeTabId === tab.id
                ? 'bg-accent text-foreground'
                : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
            )}
          >
            {tab.mode === 'table' ? (
              <Table2 className="h-3 w-3 shrink-0 text-muted-foreground" />
            ) : (
              <Code2 className="h-3 w-3 shrink-0 text-muted-foreground" />
            )}
            <span className="truncate max-w-[100px]">{tab.title}</span>
            <button
              onClick={(e) => {
                e.stopPropagation()
                closeTab(tab.id)
              }}
              className={cn(
                'ml-auto flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground transition-colors',
                activeTabId === tab.id ? 'opacity-60 hover:opacity-100' : 'opacity-0 group-hover:opacity-60 hover:!opacity-100'
              )}
            >
              <X className="h-2.5 w-2.5" />
            </button>
          </div>
        ))}
      </div>

      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 shrink-0 text-muted-foreground"
        onClick={() => addTab()}
      >
        <Plus className="h-3.5 w-3.5" />
      </Button>
    </div>
  )
}
