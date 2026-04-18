// RIDENTIUM Service Worker — PWA + Push Notifications + Offline
// v4: bypass SW navigation entirely — fixes iOS Safari SSL/privacy warning
const CACHE_STATIC = 'ridentium-static-v5'  // immutable assets: JS, CSS, fonts, icons
const CACHE_IMAGES = 'ridentium-images-v5'  // images (cache-first)
const ALL_CACHES   = [CACHE_STATIC, CACHE_IMAGES]

// ── Install ─ pre-cache key assets ────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_STATIC).then((cache) =>
      cache.addAll([
        '/manifest.json',
        '/icons/icon-192.png',
        '/icons/icon-512.png',
      ])
    )
  )
  self.skipWaiting()
})

// ── Activate ─ clean old caches ───────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => !ALL_CACHES.includes(key))
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  )
})

// ── Helpers ───────────────────────────────────────────────────────────────────
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

// ── Fetch ─ multi-strategy ────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return

  const url = new URL(event.request.url)

  // Navigation requests — bypass SW entirely to avoid iOS Safari SSL warning
  // iOS Safari flags SW-intercepted navigations as "not private connection"
  if (isNavigation(event.request)) return

  // API / auth / Supabase — always network, never cache
  if (isApiOrAuth(url)) return

  // ── Static assets: cache-first, stale-while-revalidate ──────────────────────
  if (isStaticAsset(url)) {
    event.respondWith(
      caches.open(CACHE_STATIC).then(async (cache) => {
        const cached = await cache.match(event.request)
        const networkFetch = fetch(event.request).then((res) => {
          if (res.ok) cache.put(event.request, res.clone())
          return res
        }).catch(() => cached)
        return cached || networkFetch
      })
    )
    return
  }

  // ── Images: cache-first ──────────────────────────────────────────────────────
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

  // ── Other same-origin GET: network-first, cache fallback ────────────────────
  if (url.origin === self.location.origin) {
    event.respondWith(
      fetch(event.request)
        .then((res) => res)
        .catch(() => caches.match(event.request))
    )
  }
})

// ── Push Notifications ────────────────────────────────────────────────────────
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

// ── Notification Click ────────────────────────────────────────────────────────
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

// ── Push Subscription Change ──────────────────────────────────────────────────
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
