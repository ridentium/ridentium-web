import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'RIDENTIUM — Sistema Operativo',
  description: 'Pannello di gestione interno RIDENTIUM',
  robots: 'noindex, nofollow',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it" suppressHydrationWarning>
      <body className="bg-obsidian text-cream antialiased">
        {children}
      </body>
    </html>
  )
}
