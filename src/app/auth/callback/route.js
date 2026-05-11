// app/auth/callback/route.js
// This route handles the redirect after Google OAuth.
//
// Here's what happens:
// 1. User clicks "Sign in with Google"
// 2. They're sent to Google's login page
// 3. After they approve, Google redirects back to YOUR Supabase project
// 4. Supabase processes the auth and redirects to this callback URL
//    with a "code" in the query string
// 5. This route exchanges that code for a session (auth token)
// 6. The user is now logged in and gets redirected to the dashboard
 
import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
 
export async function GET(request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
 
  if (code) {
    const supabase = await createServerSupabaseClient()
    // Exchange the temporary code for a permanent session
    await supabase.auth.exchangeCodeForSession(code)
  }
 
  // Redirect to the dashboard now that they're logged in
  return NextResponse.redirect(`${origin}/`)
}