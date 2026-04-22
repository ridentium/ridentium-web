import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'RIDENTIUM — Sistema Operativo',
  description: 'Pannello di gestione interno RIDENTIUM',
  robots: 'noindex, nofollow',
  manifest: '/manifest.json',
  applicationName: 'RIDENTIUM',
  appleWebApp: {
    capable: true,
    title: 'RIDENTIUM',
    statusBarStyle: 'black-translucent',
  },
  formatDetection: {
    telephone: false,
    email: false,
    address: false,
  },
  icons: {
    icon: [
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/icons/icon-192.png', sizes: '180x180', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    shortcut: '/icons/icon-192.png',
  },
  other: {
    'mobile-web-app-capable': 'yes',
    'msapplication-TileColor': '#18130E',
    'msapplication-config': 'none',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: 'cover',
  themeColor: '#18130E',
  colorScheme: 'dark',
}

const SPLASH_STYLES = `
  #ri-splash { position:fixed;inset:0;z-index:9999;background:#1A1009;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:32px;transition:opacity 0.6s ease;padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom); }
  @keyframes ri-dot { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.2;transform:scale(0.65)} }
  #ri-d1{animation:ri-dot 1.2s ease-in-out 0s infinite}
  #ri-d2{animation:ri-dot 1.2s ease-in-out 0.22s infinite}
  #ri-d3{animation:ri-dot 1.2s ease-in-out 0.44s infinite}
`
const SPLASH_SCRIPT = `
  (function(){var t=Date.now(),M=1200;function h(){var e=document.getElementById('ri-splash');if(!e||e.style.opacity==='0')return;var d=Math.max(0,M-(Date.now()-t));setTimeout(function(){e.style.opacity='0';setTimeout(function(){if(e.parentNode)e.parentNode.removeChild(e);},600);},d);}
  window.addEventListener('load',h);setTimeout(h,4000);})();
`

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it" suppressHydrationWarning>
      <head><style dangerouslySetInnerHTML={{ __html: SPLASH_STYLES }} /></head>
      <body className="bg-ivory-dark text-obsidian antialiased">
        <div id="ri-splash" suppressHydrationWarning>
          <div style={{ textAlign:'center' }}>
            <p style={{ fontFamily:'"Cormorant Garamond",Georgia,serif',letterSpacing:'0.45em',color:'#EDE0CC',fontSize:'1.6rem',fontWeight:300,margin:0,lineHeight:1 }}>RIDENTIUM</p>
            <p style={{ fontFamily:'system-ui,sans-serif',letterSpacing:'0.35em',color:'rgba(201,168,76,0.65)',fontSize:'0.52rem',fontWeight:400,margin:'10px 0 0 0',textTransform:'uppercase' as const }}>Sistema Operativo</p>
          </div>
          <div style={{ width:'40px',height:'1px',background:'linear-gradient(90deg,transparent,#C9A84C,transparent)' }} />
          <div style={{ display:'flex',gap:'10px',alignItems:'center' }}>
            <div id="ri-d1" style={{ width:'8px',height:'8px',borderRadius:'50%',background:'#C9A84C' }} />
            <div id="ri-d2" style={{ width:'8px',height:'8px',borderRadius:'50%',background:'#C9A84C' }} />
            <div id="ri-d3" style={{ width:'8px',height:'8px',borderRadius:'50%',background:'#C9A84C' }} />
          </div>
        </div>
        <script dangerouslySetInnerHTML={{ __html: SPLASH_SCRIPT }} />
        {children}
      </body>
    </html>
  )
}
