import React, { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { User, AuthState } from '@/types'

interface AuthContextType extends AuthState {
  signUp: (email: string, password: string) => Promise<void>
  signIn: (email: string, password: string) => Promise<void>
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
  updateProfile: (data: Partial<User>) => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    user: null,
    loading: true,
    error: null,
  })

  useEffect(() => {
    let mounted = true

    const initializeAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (mounted && session?.user) {
          const { data: userData } = await supabase
            .from('users')
            .select('*')
            .eq('id', session.user.id)
            .maybeSingle()

          if (mounted) {
            if (userData) {
              setAuthState({
                isAuthenticated: true,
                user: userData,
                loading: false,
                error: null,
              })
            } else {
              await supabase.auth.signOut()
              setAuthState({
                isAuthenticated: false,
                user: null,
                loading: false,
                error: null,
              })
            }
          }
        } else if (mounted) {
          setAuthState(prev => ({ ...prev, loading: false }))
        }
      } catch (error) {
        if (mounted) {
          setAuthState(prev => ({
            ...prev,
            loading: false,
            error: error instanceof Error ? error.message : 'Auth error',
          }))
        }
      }
    }

    initializeAuth()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!mounted) return

        (async () => {
          try {
            if (event === 'SIGNED_IN' && session?.user) {
              const { data: userData } = await supabase
                .from('users')
                .select('*')
                .eq('id', session.user.id)
                .maybeSingle()

              if (userData) {
                setAuthState({
                  isAuthenticated: true,
                  user: userData,
                  loading: false,
                  error: null,
                })
              } else {
                await supabase.auth.signOut()
                setAuthState({
                  isAuthenticated: false,
                  user: null,
                  loading: false,
                  error: null,
                })
              }
            } else if (event === 'SIGNED_OUT') {
              setAuthState({
                isAuthenticated: false,
                user: null,
                loading: false,
                error: null,
              })
            }
          } catch (error) {
            setAuthState(prev => ({
              ...prev,
              loading: false,
              error: error instanceof Error ? error.message : 'Sync error',
            }))
          }
        })()
      }
    )

    return () => {
      mounted = false
      subscription?.unsubscribe()
    }
  }, [])

  const signUp = async (email: string, password: string) => {
    try {
      setAuthState(prev => ({ ...prev, error: null }))

      const { data: { user }, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
      })

      if (signUpError) throw signUpError

      if (user) {
        const { error: insertError } = await supabase.from('users').insert({
          id: user.id,
          email: user.email,
          is_premium: false,
          subscription_tier: 'free',
          premium_until: null,
        })

        if (insertError && !insertError.message.includes('duplicate key')) {
          throw insertError
        }
      }
    } catch (error) {
      let message = 'Sign up failed'

      if (error instanceof Error) {
        if (error.message.toLowerCase().includes('already registered') ||
            error.message.toLowerCase().includes('already exists') ||
            error.message.toLowerCase().includes('already been registered') ||
            error.message.toLowerCase().includes('duplicate key')) {
          message = 'This email is already registered. Please sign in instead.'
        } else {
          message = error.message
        }
      }

      setAuthState(prev => ({ ...prev, error: message }))
      throw error
    }
  }

  const signIn = async (email: string, password: string) => {
    try {
      setAuthState(prev => ({ ...prev, error: null }))

      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) throw error
    } catch (error) {
      let message = 'Sign in failed'

      if (error instanceof Error) {
        if (error.message.toLowerCase().includes('invalid login credentials') ||
            error.message.toLowerCase().includes('invalid credentials')) {
          message = 'Invalid email or password'
        } else if (error.message.toLowerCase().includes('email not confirmed')) {
          message = 'Please verify your email address'
        } else {
          message = error.message
        }
      }

      setAuthState(prev => ({ ...prev, error: message }))
      throw error
    }
  }

  const signInWithGoogle = async () => {
    try {
      setAuthState(prev => ({ ...prev, error: null }))

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: typeof window !== 'undefined' ? window.location.origin : undefined,
        },
      })

      if (error) throw error
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Google sign in failed'
      setAuthState(prev => ({ ...prev, error: message }))
      throw error
    }
  }

  const signOut = async () => {
    try {
      setAuthState(prev => ({ ...prev, error: null }))
      const { error } = await supabase.auth.signOut()
      if (error) throw error
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Sign out failed'
      setAuthState(prev => ({ ...prev, error: message }))
      throw error
    }
  }

  const updateProfile = async (data: Partial<User>) => {
    try {
      if (!authState.user) throw new Error('Not authenticated')

      const { error } = await supabase
        .from('users')
        .update(data)
        .eq('id', authState.user.id)

      if (error) throw error

      setAuthState(prev => ({
        ...prev,
        user: prev.user ? { ...prev.user, ...data } : null,
      }))
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Update failed'
      setAuthState(prev => ({ ...prev, error: message }))
      throw error
    }
  }

  return (
    <AuthContext.Provider
      value={{
        ...authState,
        signUp,
        signIn,
        signInWithGoogle,
        signOut,
        updateProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
