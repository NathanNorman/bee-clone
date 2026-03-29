import { useState, useEffect } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../supabase/client'

export type AuthState =
  | { status: 'loading' }
  | { status: 'authenticated'; user: User }
  | { status: 'unauthenticated' }

export default function useAuth() {
  const [authState, setAuthState] = useState<AuthState>({ status: 'loading' })

  useEffect(() => {
    // onAuthStateChange fires INITIAL_SESSION on setup, then TOKEN_REFRESHED
    // automatically — no need for a separate getSession() call which can
    // return stale data before the refresh completes.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setAuthState({ status: 'authenticated', user: session.user })
      } else {
        setAuthState({ status: 'unauthenticated' })
      }
    })

    // Safety net: if INITIAL_SESSION never fires (older Supabase versions),
    // fall back to getSession after a short delay to avoid stuck loading state
    const fallback = setTimeout(async () => {
      if (authState.status !== 'loading') return
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        setAuthState({ status: 'authenticated', user: session.user })
      } else {
        setAuthState({ status: 'unauthenticated' })
      }
    }, 2000)

    return () => {
      subscription.unsubscribe()
      clearTimeout(fallback)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function signInWithEmail(email: string): Promise<{ error: string | null }> {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    })
    return { error: error?.message ?? null }
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  return { authState, signInWithEmail, signOut }
}
