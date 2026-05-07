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
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            supabaseResponse.cookies.set(name, value, options as any)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const { pathname } = request.nextUrl

  // Queste route gestiscono la propria autenticazione internamente e non usano
  // i cookie Supabase — escluderle qui evita overhead inutile e loop di redirect.
  //
  // /api/crm/contatti — endpoint pubblico per form landing (verifica x-api-key header)
  // /api/notify       — endpoint interni per push notification (verificano x-notify-secret
  //                     header oppure sessione admin; vedi ogni route.ts per dettagli)
  if (pathname.startsWith('/api/crm/contatti') || pathname.startsWith('/api/notify')) {
    return supabaseResponse
  }

  // Rotte pubbliche
  if (pathname.startsWith('/login')) {
    if (user) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
    return supabaseResponse
  }

  // Rotte protette — non loggato → login
  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Protezione rotte admin e staff: entrambe richiedono un profilo valido nel DB.
  // /admin → solo ruolo 'admin'; /staff → qualsiasi ruolo di studio registrato.
  if (pathname.startsWith('/admin') || pathname.startsWith('/staff')) {
    const adminDb = createAdminSupabase(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    const { data: profile } = await adminDb
      .from('profili')
      .select('ruolo')
      .eq('id', user.id)
      .single()

    // Nessun profilo → utente autenticato ma non registrato come membro dello studio
    if (!profile) {
      return NextResponse.redirect(new URL('/login', request.url))
    }

    // /admin richiede ruolo admin esplicito
    if (pathname.startsWith('/admin') && profile.ruolo !== 'admin') {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|html|ico|txt|xml|json)$).*)',
  ],
}
