// RIDENTIUM Service Worker — PWA + Push Notifications + Offline
// v2: multi-strategy caching for reliable offline experience
const CACHE_STATIC = 'ridentium-static-v2'   // immutable assets: JS, CSS, fonts, icons
const CACHE_PAGES  = 'ridentium-pages-v2'    // navigation HTML (network-first)
const CACHE_IMAGES = 'ridentium-images-v2'   // images (cache-first)
const ALL_CACHES   = [CACHE_STATIC, CACHE_PAGES, CACHE_IMAGES]

// ── Offline fallback HTML (embedded so it works before any page is visited) ──
const OFFLINE_HTML = `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>RIDENTIUM — Offline</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{background:#18130E;color:#C8C0B0;font-family:system-ui,sans-serif;
         display:flex;align-items:center;justify-content:center;min-height:100vh;padding:2rem}
    .card{background:#221C16;border:1px solid #2E2720;border-radius:12px;
          padding:3rem 2.5rem;text-align:center;max-width:400px;width:100%}
    h1{font-family:Georgia,serif;font-size:1.25rem;font-weight:300;
       letter-spacing:.2em;color:#E8E0D0;margin-bottom:.5rem}
    .dot{width:8px;height:8px;background:#C8A95A;border-radius:50%;
         display:inline-block;margin-bottom:2rem}
    p{font-size:.875rem;line-height:1.7;color:#7A6E64;margin-bottom:1.5rem}
    button{background:#C8A95A;color:#18130E;border:none;border-radius:6px;
           padding:.75rem 1.5rem;font-size:.875rem;cursor:pointer;width:100%}
    button:hover{opacity:.85}
  </style>
</head>
<body>
  <div class="card">
    <div class="dot"></div>
    <h1>RIDENTIUM</h1>
    <p>Connessione non disponibile.<br>Torna online per accedere al pannello.</p>
    <button onclick="location.reload()">Riprova</button>
  </div>
</body>
</html>`

// ── Install — pre-cache key assets ─────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    Promise.all([
      caches.open(CACHE_STATIC).then((cache) =>
        cache.addAll([
          '/manifest.json',
          '/icons/icon-192.png',
          '/icons/icon-512.png',
        ])
      ),
      // Pre-cache root page for offline navigation fallback
      caches.open(CACHE_PAGES).then((cache) =>
        cache.add('/').catch(() => {/* ignore if root requires auth redirect */})
      ),
    ])
  )
  self.skipWaiting()
})

// ── Activate — clean old caches ────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => !ALL_CACHES.includes(key))
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  )
})

// ── Helpers ─────────────────────────────────────────────────────────────────
function isNavigation(request) {
  return request.mode === 'navigate'
}

function isStaticAsset(url) {
  return (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname === '/manifest.json'
  )
}

function isImage(url) {
  return /\.(png|jpg|jpeg|gif|webp|svg|ico)$/.test(url.pathname)
}

function isApiOrAuth(url) {
  return (
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/auth/') ||
    url.hostname.includes('supabase.co')
  )
}

// ── Fetch — multi-strategy ─────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return

  const url = new URL(event.request.url)

  // API / auth / Supabase — always network, never cache
  if (isApiOrAuth(url)) return

  // ── Static assets: cache-first, stale-while-revalidate ──────────────────
  if (isStaticAsset(url)) {
    event.respondWith(
      caches.open(CACHE_STATIC).then(async (cache) => {
        const cached = await cache.match(event.request)
        const networkFetch = fetch(event.request).then((res) => {
          if (res.ok) cache.put(event.request, res.clone())
          return res
        }).catch(() => cached)
        // Return cached immediately; update in background
        return cached || networkFetch
      })
    )
    return
  }

  // ── Images: cache-first ──────────────────────────────────────────────────
  if (isImage(url)) {
    event.respondWith(
      caches.open(CACHE_IMAGES).then(async (cache) => {
        const cached = await cache.match(event.request)
        if (cached) return cached
        const res = await fetch(event.request).catch(() => null)
        if (res && res.ok) cache.put(event.request, res.clone())
        return res || new Response('', { status: 404 })
      })
    )
    return
  }

  // ── Navigation (HTML pages): network-first, offline fallback ─────────────
  if (isNavigation(event.request)) {
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          if (res.ok) {
            caches.open(CACHE_PAGES).then((cache) => cache.put(event.request, res.clone()))
          }
          return res
        })
        .catch(async () => {
          // Try cache first
          const cached = await caches.match(event.request)
          if (cached) return cached
          // Return embedded offline page
          return new Response(OFFLINE_HTML, {
            headers: { 'Content-Type': 'text/html; charset=utf-8' },
          })
        })
    )
    return
  }

  // ── Other same-origin GET: network-first, cache fallback ─────────────────
  if (url.origin === self.location.origin) {
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          if (res.ok) {
            caches.open(CACHE_PAGES).then((cache) => cache.put(event.request, res.clone()))
          }
          return res
        })
        .catch(() => caches.match(event.request))
    )
  }
})

// ── Push Notifications ─────────────────────────────────────────────────────
self.addEventListener('push', (event) => {
  if (!event.data) return

  let data
  try {
    data = event.data.json()
  } catch {
    data = { title: 'RIDENTIUM', body: event.data.text() }
  }

  const title = data.title || 'RIDENTIUM'
  const options = {
    body: data.body || '',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: data.tag || 'ridentium-notification',
    data: {
      url: data.url || '/',
      tag: data.tag,
    },
    requireInteraction: data.requireInteraction ?? false,
    actions: data.actions || [],
    vibrate: [200, 100, 200],
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

// ── Notification Click ─────────────────────────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const targetUrl = event.notification.data?.url || '/'

  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients) => {
        for (const client of windowClients) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            client.navigate(targetUrl)
            return client.focus()
          }
        }
        if (clients.openWindow) return clients.openWindow(targetUrl)
      })
  )
})

// ── Push Subscription Change ───────────────────────────────────────────────
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    self.registration.pushManager
      .subscribe(event.oldSubscription.options)
      .then((subscription) =>
        fetch('/api/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(subscription),
        })
      )
  )
})
