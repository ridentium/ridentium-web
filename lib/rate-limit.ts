/**
 * Rate limiter in-memory con sliding window.
 *
 * ARCHITETTURA: lo state è per-istanza serverless e non persiste tra cold start
 * o istanze Vercel parallele. Per questo progetto (studio singolo, <50 req/min
 * su qualsiasi endpoint) è una protezione sufficiente contro spam di base da
 * singolo IP e abuso da parte di utenti autenticati.
 *
 * UPGRADE PATH: per rate limiting cross-instance garantito, sostituire il Map
 * con Upstash Redis (@upstash/ratelimit) o Vercel KV — le firme delle funzioni
 * esportate rimangono identiche.
 */

type WindowEntry = {
  count: number
  resetAt: number   // timestamp ms
}

const _store = new Map<string, WindowEntry>()

// Cleanup leggero ogni 500 chiamate per non accumulare entry scadute in memoria
let _ticker = 0
function _sweep() {
  if (++_ticker % 500 !== 0) return
  const now = Date.now()
  // forEach è sicuro per delete-while-iterating e non richiede downlevelIteration
  _store.forEach((v, k) => { if (v.resetAt < now) _store.delete(k) })
}

// ── Tipi pubblici ─────────────────────────────────────────────────────────────

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  retryAfterSeconds: number  // 0 se allowed === true
}

// ── Core ──────────────────────────────────────────────────────────────────────

/**
 * Controlla e registra una richiesta nel rate limiter.
 *
 * @param key      - Chiave univoca (IP, userId, "ip:endpoint", ecc.)
 * @param limit    - Numero massimo di richieste consentite nella finestra
 * @param windowMs - Durata della finestra in millisecondi
 */
export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): RateLimitResult {
  _sweep()
  const now = Date.now()
  const entry = _store.get(key)

  // Finestra scaduta o assente → nuova finestra
  if (!entry || entry.resetAt < now) {
    _store.set(key, { count: 1, resetAt: now + windowMs })
    return { allowed: true, remaining: limit - 1, retryAfterSeconds: 0 }
  }

  // Limite raggiunto
  if (entry.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.ceil((entry.resetAt - now) / 1000),
    }
  }

  // Incrementa contatore nella finestra corrente
  entry.count++
  return { allowed: true, remaining: limit - entry.count, retryAfterSeconds: 0 }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Estrae l'IP reale dalla richiesta, tenendo conto dei proxy Vercel/Cloudflare.
 * Ritorna 'unknown' se non disponibile (es. ambiente locale senza proxy).
 */
export function getClientIp(headers: Headers): string {
  const xff = headers.get('x-forwarded-for')
  if (xff) return xff.split(',')[0].trim()
  const realIp = headers.get('x-real-ip')
  if (realIp) return realIp.trim()
  return 'unknown'
}
