// RIDENTIUM Service Worker — PWA + Push Notifications + Offline
// v6: robust pushsubscriptionchange auto-resubscribe, saves to DB

const CACHE_STATIC = 'ridentium-static-v6'
const CACHE_IMAGES = 'ridentium-images-v6'
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
    Promise.all([
      caches.keys().then((keys) =>
        Promise.all(
          keys.filter((k) => !ALL_CACHES.includes(k)).map((k) => caches.delete(k))
        )
      ),
      self.clients.claim(),
    ])
  )
})

// ── Helpers ───────────────────────────────────────────────────────────────────
function isNavigation(request) {
  return request.mode === 'navigate'
}
function isStaticAsset(url) {
  return (
    /\.(js|css|woff2?|ttf|otf|eot)(\?|$)/.test(url.pathname) ||
    url.pathname.startsWith('/_next/static/')
  )
}
function isImage(url) {
  return /\.(png|jpg|jpeg|gif|svg|webp|ico)(\?|$)/.test(url.pathname)
}
function isApiOrAuth(url) {
  return (
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/auth/') ||
    url.hostname.includes('supabase')
  )
}

// ── Fetch ─ multi-strategy ────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)

  // v4 fix: bypass navigation — prevents iOS Safari SSL/privacy warning
  if (isNavigation(event.request)) return

  // Never cache API / auth / supabase
  if (isApiOrAuth(url)) return

  if (isStaticAsset(url)) {
    event.respondWith(
      caches.match(event.request).then(
        (cached) =>
          cached ||
          fetch(event.request).then((res) => {
            if (!res || res.status !== 200) return res
            const clone = res.clone()
            caches.open(CACHE_STATIC).then((c) => c.put(event.request, clone))
            return res
          })
      )
    )
    return
  }

  if (isImage(url)) {
    event.respondWith(
      caches.match(event.request).then(
        (cached) =>
          cached ||
          fetch(event.request).then((res) => {
            if (!res || res.status !== 200) return res
            const clone = res.clone()
            caches.open(CACHE_IMAGES).then((c) => c.put(event.request, clone))
            return res
          })
      )
    )
    return
  }
})

// ── Push Notifications ────────────────────────────────────────────────────────
self.addEventListener('push', (event) => {
  let payload = {
    title: 'Ridentium',
    body: '',
    url: '/admin',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
  }

  if (event.data) {
    try {
      const data = event.data.json()
      payload = {
        title: data.title  || payload.title,
        body:  data.body   || '',
        url:   data.url    || '/admin',
        icon:  data.icon   || '/icons/icon-192.png',
        badge: data.badge  || '/icons/icon-192.png',
      }
    } catch {
      payload.body = event.data.text()
    }
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: payload.icon,
      badge: payload.badge,
      data: { url: payload.url },
      vibrate: [200, 100, 200],
      requireInteraction: false,
    })
  )
})

// ── Notification Click ────────────────────────────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const targetUrl = (event.notification.data && event.notification.data.url) || '/'

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clients) => {
        // Focus existing tab if app is already open
        const existing = clients.find(
          (c) => c.url.startsWith(self.registration.scope)
        )
        if (existing) {
          existing.focus()
          return existing.navigate(targetUrl)
        }
        return self.clients.openWindow(targetUrl)
      })
  )
})

// ── Push Subscription Change ──────────────────────────────────────────────────
// Fires when the browser rotates the push subscription (e.g. after long inactivity).
// We re-subscribe and immediately save the new endpoint to the DB so the server
// can keep delivering pushes even when the app is closed.
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    (async () => {
      try {
        const reg = self.registration
        // Re-subscribe using the same VAPID key from the old subscription
        const oldKey =
          event.oldSubscription &&
          event.oldSubscription.options &&
          event.oldSubscription.options.applicationServerKey

        let newSub = await reg.pushManager.getSubscription()
        if (!newSub && oldKey) {
          newSub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: oldKey,
          })
        }

        if (newSub) {
          await fetch('/api/subscribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newSub),
          })
        }
      } catch (err) {
        console.error('[SW] pushsubscriptionchange failed:', err)
      }
    })()
  )
})
