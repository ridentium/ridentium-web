'use client'

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || ''

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)))
}

export function isPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  )
}

export function getPermissionStatus(): NotificationPermission | null {
  if (typeof window === 'undefined' || !('Notification' in window)) return null
  return Notification.permission
}

export async function registerSW(): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return null
  try {
    const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' })
    return reg
  } catch (err) {
    console.error('[SW] Registration failed:', err)
    return null
  }
}

export async function saveSubscriptionToDB(subscription: PushSubscription): Promise<void> {
  try {
    const res = await fetch('/api/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(subscription),
    })
    if (!res.ok) console.warn('[Push] DB save returned', res.status)
  } catch (err) {
    console.error('[Push] Save to DB failed:', err)
  }
}

export async function subscribeUser(): Promise<PushSubscription | null> {
  if (!isPushSupported()) return null
  if (!VAPID_PUBLIC_KEY) {
    console.warn('[Push] NEXT_PUBLIC_VAPID_PUBLIC_KEY not set')
    return null
  }
  try {
    // Register SW first (idempotent)
    await navigator.serviceWorker.register('/sw.js', { scope: '/' })
    const reg = await navigator.serviceWorker.ready

    const permission = await Notification.requestPermission()
    if (permission !== 'granted') return null

    // Get existing or create new subscription
    let subscription = await reg.pushManager.getSubscription()
    if (!subscription) {
      subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      })
    }

    // Always save to DB to ensure server has current endpoint
    await saveSubscriptionToDB(subscription)
    return subscription
  } catch (err) {
    console.error('[Push] Subscription error:', err)
    return null
  }
}

export async function unsubscribeUser(): Promise<boolean> {
  if (!isPushSupported()) return false
  try {
    const reg = await navigator.serviceWorker.ready
    const sub = await reg.pushManager.getSubscription()
    if (!sub) return true
    await fetch('/api/subscribe', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint: sub.endpoint }),
    })
    return await sub.unsubscribe()
  } catch (err) {
    console.error('[Push] Unsubscribe error:', err)
    return false
  }
}

export async function getCurrentSubscription(): Promise<PushSubscription | null> {
  if (!isPushSupported()) return null
  try {
    const reg = await navigator.serviceWorker.ready
    return await reg.pushManager.getSubscription()
  } catch {
    return null
  }
}
