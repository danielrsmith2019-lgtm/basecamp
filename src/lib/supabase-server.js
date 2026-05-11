// lib/supabase-server.js
// Server-side Supabase client for Server Components, API routes, and middleware.
// 
// Why is this separate from the browser client?
// On the server, there's no browser cookie jar. We have to manually
// read and write cookies through Next.js's cookies() API so that
// Supabase can maintain the user's auth session across requests.
 
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
 
export async function createServerSupabaseClient() {
  const cookieStore = await cookies()
 
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        // Read all cookies — Supabase needs these to check if
        // the user is logged in on every server request
        getAll() {
          return cookieStore.getAll()
        },
 
        // Write cookies — when Supabase refreshes an auth token,
        // it needs to save the new token as a cookie
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          } catch {
            // setAll is called from Server Components where cookies
            // are read-only. That's fine — the middleware will handle
            // refreshing the session cookie instead. This catch
            // prevents the app from crashing.
          }
        },
      },
    }
  )
}