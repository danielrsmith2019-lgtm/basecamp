// lib/supabase.js
// This file creates Supabase clients for BOTH client and server environments.
// Why two? Next.js renders components on the server AND the browser.
// Each environment handles cookies (for auth sessions) differently.
 
import { createBrowserClient } from '@supabase/ssr'
 
// ============================================================
// BROWSER CLIENT — use this in client components ("use client")
// ============================================================
// This runs in the user's browser. It handles auth cookies
// automatically using the browser's built-in cookie API.
 
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )
}