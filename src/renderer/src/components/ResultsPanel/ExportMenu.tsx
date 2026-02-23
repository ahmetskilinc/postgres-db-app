import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '../ui/dropdown-menu'
import { Button } from '../ui/button'
import { Download, FileText, Braces } from 'lucide-react'
import { toast } from '../../hooks/use-toast'

interface Props {
  rows: Record<string, unknown>[]
  fields: { name: string; dataTypeID: number }[]
}

export function ExportMenu({ rows, fields }: Props): JSX.Element {
  const handleExportCSV = async (): Promise<void> => {
    const result = await window.api.export.csv(
      rows,
      fields.map((f) => ({ name: f.name }))
    )
    if (result?.success) {
      toast({ title: 'Exported', description: `Saved to ${result.path}` })
    }
  }

  const handleExportJSON = async (): Promise<void> => {
    const result = await window.api.export.json(rows)
    if (result?.success) {
      toast({ title: 'Exported', description: `Saved to ${result.path}` })
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-6 gap-1.5">
          <Download className="h-3 w-3" />
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={handleExportCSV} className="gap-2">
          <FileText className="h-3 w-3" />
          Export as CSV
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleExportJSON} className="gap-2">
          <Braces className="h-3 w-3" />
          Export as JSON
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
