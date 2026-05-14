// components/shared/LogoutButton.jsx
'use client'

import { useAuth } from '@/lib/auth'
import { useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'

export default function LogoutButton() {
  const { user, signOut } = useAuth()
  const router = useRouter()

  async function handleLogout() {
    await signOut()
    router.push('/login')
  }

  if (!user) return null

  return (
    <button
      onClick={handleLogout}
      className="flex items-center gap-2 px-3 py-1.5 text-gray-400 hover:text-primary text-xs rounded-lg hover:bg-white/5 transition-colors"
      title="Sign out"
    >
      <LogOut size={14} />
      <span className="hidden sm:inline">Sign out</span>
    </button>
  )
}
