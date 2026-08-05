import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Pages reachable without a session — everything else requires one.
const PUBLIC_AUTH_PATHS = ['/login', '/register']

export async function middleware(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  // No Supabase project configured — same "keep the app usable instead of
  // crashing" fallback already used for the AI advisor (see
  // .env.local.example): createServerClient throws immediately on an empty
  // URL/key, which previously 500'd every single route since this
  // middleware runs on nearly every request. Skip the auth gate entirely
  // until real credentials are added.
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.next()
  }

  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        supabaseResponse = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        )
      },
    },
  })

  const { data: { user } } = await supabase.auth.getUser()

  const path = request.nextUrl.pathname
  const isAuthPage = PUBLIC_AUTH_PATHS.some((p) => path === p || path.startsWith(`${p}/`))

  // Already has a session: skip straight past login/register into the
  // normal opening-video / main-menu entry flow.
  if (user && isAuthPage) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  // No session yet: log in first before reaching any game screen.
  if (!user && !isAuthPage) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}