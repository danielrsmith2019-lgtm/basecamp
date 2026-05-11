// middleware.js
// This file lives in the PROJECT ROOT (next to package.json), NOT inside app/.
//
// Middleware runs BEFORE every page load. It checks:
// "Does this person have a valid session?"
// If yes → let them through.
// If no → redirect to /login.
//
// It also refreshes expired tokens automatically, so users don't get
// randomly logged out when their token expires (tokens last ~1 hour,
// but the refresh token extends this seamlessly).
 
import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
 
export async function proxy(request) {
  // Start with a normal response that we'll modify if needed
  let response = NextResponse.next({
    request: { headers: request.headers },
  })
 
  // Create a Supabase client that can read/write cookies in the middleware context
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          // Update cookies on the request (for downstream server components)
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value)
          })
          // Update cookies on the response (sent back to the browser)
          response = NextResponse.next({
            request: { headers: request.headers },
          })
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options)
          })
        },
      },
    }
  )
 
  // This call does two things:
  // 1. Checks if there's a valid session
  // 2. Refreshes the token if it's expired (using the refresh token in the cookie)
  const { data: { user } } = await supabase.auth.getUser()
 
  const path = request.nextUrl.pathname
 
  // If the user is NOT logged in and they're trying to access a protected page,
  // redirect them to /login.
  if (!user && path !== '/login' && path !== '/signup' && !path.startsWith('/auth/')) {
    const loginUrl = new URL('/login', request.url)
    return NextResponse.redirect(loginUrl)
  }
 
  // If the user IS logged in and they're on /login or /signup,
  // redirect them to the dashboard (no reason to see the login page).
  if (user && (path === '/login' || path === '/signup')) {
    const homeUrl = new URL('/', request.url)
    return NextResponse.redirect(homeUrl)
  }
 
  return response
}
 
// Tell Next.js which routes this middleware should run on.
// This matcher excludes static files, images, and API routes
// (you don't want the middleware checking auth on every CSS file request).
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}