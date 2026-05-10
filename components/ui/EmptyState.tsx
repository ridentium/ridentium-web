import { type LucideIcon } from 'lucide-react'

interface Props {
  icon: LucideIcon
  title: string
  subtitle?: string
  action?: {
    label: string
    onClick: () => void
  }
}

export default function EmptyState({ icon: Icon, title, subtitle, action }: Props) {
  return (
    <div className="card flex flex-col items-center justify-center py-14 text-center">
      <div className="w-12 h-12 rounded-full bg-stone/20 flex items-center justify-center mb-4">
        <Icon size={22} className="text-obsidian/50" />
      </div>
      <p className="text-sm text-obsidian/70 font-medium">{title}</p>
      {subtitle && <p className="text-xs text-obsidian/60 mt-1.5 max-w-xs leading-relaxed">{subtitle}</p>}
      {action && (
        <button
          onClick={action.onClick}
          className="mt-5 btn-primary text-xs"
        >
          {action.label}
        </button>
      )}
    </div>
  )
}
