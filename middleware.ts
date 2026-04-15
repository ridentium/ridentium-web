import { createServerClient } from '@supabase/ssr'
import { createClient as createAdminSupabase } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const { pathname } = request.nextUrl

  // ── Rotte pubbliche: login ──────────────────────────────────────────────────
  if (pathname.startsWith('/login')) {
    if (user) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
    return supabaseResponse
  }

  // ── API pubblica: ricezione lead da landing page esterne ────────────────────
  // POST /api/crm/contatti  →  non richiede autenticazione
  // OPTIONS                 →  preflight CORS
  if (
    pathname === '/api/crm/contatti' &&
    (request.method === 'POST' || request.method === 'OPTIONS')
  ) {
    return supabaseResponse
  }

  // ── Rotte protette: richiede autenticazione ─────────────────────────────────
  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // ── Protezione rotte admin ──────────────────────────────────────────────────
  if (pathname.startsWith('/admin')) {
    const adminDb = createAdminSupabase(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    const { data: profile } = await adminDb
      .from('profili')
      .select('ruolo')
      .eq('id', user.id)
      .single()

    if (profile?.ruolo !== 'admin') {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
