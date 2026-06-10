import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          )
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Check for hardcoded user bypass cookie
  const bypassCookie = request.cookies.get('samsung_auth_bypass')?.value
  const WHITELISTED_EMAILS = ['m.atwa@samsung.com']
  let isBypassUser = false
  
  if (bypassCookie) {
    try {
      const decodedEmail = atob(bypassCookie)
      isBypassUser = WHITELISTED_EMAILS.includes(decodedEmail)
    } catch {
      // Invalid cookie, ignore
    }
  }

  // Public routes that don't require authentication
  const isPublicRoute = 
    request.nextUrl.pathname.startsWith('/auth')

  // If not authenticated (neither Supabase nor bypass) and not on a public route, redirect to login
  if (!user && !isBypassUser && !isPublicRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/auth/login'
    return NextResponse.redirect(url)
  }

  // If user is logged in and tries to access login page, redirect to dashboard
  if (request.nextUrl.pathname.startsWith('/auth/login') && (user || isBypassUser)) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
