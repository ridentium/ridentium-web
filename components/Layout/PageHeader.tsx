import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'

interface PageHeaderProps {
  title: string
  subtitle?: string
  actions?: React.ReactNode
  /** Mostra un link "← Label" sopra il titolo — utile su mobile per navigare a sezioni parent */
  breadcrumb?: { label: string; href: string }
}

export default function PageHeader({ title, subtitle, actions, breadcrumb }: PageHeaderProps) {
  return (
    <div className="mb-7">
      {breadcrumb && (
        <Link
          href={breadcrumb.href}
          className="inline-flex items-center gap-1 text-xs text-stone/50 hover:text-stone transition-colors mb-2 sm:hidden"
        >
          <ChevronLeft size={12} />
          {breadcrumb.label}
        </Link>
      )}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="section-title">{title}</h2>
          {subtitle && (
            <p className="text-stone text-sm mt-1">{subtitle}</p>
          )}
        </div>
        {actions && (
          <div className="flex items-center gap-3 mt-1">{actions}</div>
        )}
      </div>
    </div>
  )
}
