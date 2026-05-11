// lib/auth.js
// AuthProvider — wraps your entire app and provides the current user to every component.
//
// How to use it:
//   In any client component: const { user, loading, signOut } = useAuth()
//   user is null if not logged in, or the full user object if logged in.
//   loading is true while we're checking the session (show a spinner).
 
'use client'
 
import { createContext, useContext, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
 
// Create a React context — this is how data gets shared across components
// without passing props down through every level.
const AuthContext = createContext({})
 
// Custom hook so components can access auth with: const { user } = useAuth()
export function useAuth() {
  return useContext(AuthContext)
}
 
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true) // true until we've checked the session
  const supabase = createClient()
 
  useEffect(() => {
    // On first load, check if there's already a session (user previously logged in)
    async function getSession() {
      const { data: { session } } = await supabase.auth.getSession()
      setUser(session?.user ?? null)
      setLoading(false)
    }
    getSession()
 
    // Listen for auth changes (login, logout, token refresh).
    // This fires whenever the auth state changes so the UI updates instantly.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null)
        setLoading(false)
      }
    )
 
    // Clean up the listener when the component unmounts
    return () => subscription.unsubscribe()
  }, [])
 
  // Sign out function — call this from your logout button
  async function signOut() {
    await supabase.auth.signOut()
    setUser(null)
  }
 
  return (
    <AuthContext.Provider value={{ user, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}