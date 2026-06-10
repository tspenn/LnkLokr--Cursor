import React, { createContext, useContext, useEffect, useState } from 'react'
import { supabase, syncSessionToBackground } from '@/lib/supabase'
import { getAuthRedirectUrl } from '@/lib/authRedirect'
import {
  clearAwaitingPasswordReset,
  clearPasswordRecoveryPending,
  ensureResetPasswordPath,
  hasAuthCallbackInUrl,
  isAwaitingPasswordReset,
  isPasswordRecoveryPending,
  isPasswordRecoveryUrl,
  markAwaitingPasswordReset,
  markPasswordRecoveryPending,
} from '@/lib/authUrl'
import { normalizeUser } from '@/lib/normalizeUser'
import { User, AuthState } from '@/types'
import type { User as SupabaseUser } from '@supabase/supabase-js'

async function fetchOrCreateUserProfile(authUser: SupabaseUser): Promise<User | null> {
  const { data: userData } = await supabase
    .from('users')
    .select('*')
    .eq('id', authUser.id)
    .maybeSingle()

  if (userData) {
    return normalizeUser(userData as Record<string, unknown>)
  }

  const { data: created, error } = await supabase
    .from('users')
    .insert({
      id: authUser.id,
      email: authUser.email ?? '',
      is_premium: false,
      subscription_tier: 'free',
      premium_until: null,
    })
    .select('*')
    .single()

  if (error) {
    console.error('Could not create user profile:', error.message)

    // If it's a duplicate-key error the row exists but RLS blocked the earlier read.
    // Try one more time to fetch it.
    if (error.code === '23505' || error.message.toLowerCase().includes('duplicate')) {
      const { data: retry } = await supabase
        .from('users')
        .select('*')
        .eq('id', authUser.id)
        .maybeSingle()
      if (retry) return normalizeUser(retry as Record<string, unknown>)
    }

    // Fall back to a minimal user object so sign-in isn't silently blocked
    return normalizeUser({
      id: authUser.id,
      email: authUser.email ?? '',
      is_premium: false,
      subscription_tier: 'free',
      premium_until: null,
    })
  }

  return normalizeUser(created as Record<string, unknown>)
}

interface AuthContextType extends AuthState {
  signUp: (email: string, password: string) => Promise<void>
  signIn: (email: string, password: string) => Promise<void>
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
  resetPassword: (email: string) => Promise<void>
  updatePassword: (password: string) => Promise<void>
  updateProfile: (data: Partial<User>) => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [authState, setAuthState] = useState<AuthState>(() => ({
    isAuthenticated: false,
    user: null,
    loading: hasAuthCallbackInUrl() || isPasswordRecoveryUrl(),
    error: null,
    passwordRecovery: isPasswordRecoveryUrl(),
  }))

  useEffect(() => {
    let mounted = true

    if (isPasswordRecoveryUrl()) {
      markPasswordRecoveryPending()
      ensureResetPasswordPath()
    }

    const initializeAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (mounted && session?.user) {
          const recoveryFromEmail =
            isPasswordRecoveryUrl() ||
            isPasswordRecoveryPending() ||
            (isAwaitingPasswordReset() && Boolean(session))

          if (recoveryFromEmail) {
            markPasswordRecoveryPending()
            ensureResetPasswordPath()
          }

          // During password recovery, skip profile fetch — don't risk killing the session
          if (recoveryFromEmail) {
            setAuthState(prev => ({
              isAuthenticated: true,
              user: prev.user,
              loading: false,
              error: null,
              passwordRecovery: true,
            }))
          } else {
            const profile = await fetchOrCreateUserProfile(session.user)
            if (!mounted) return

            if (profile) {
              setAuthState(prev => ({
                isAuthenticated: true,
                user: profile,
                loading: false,
                error: null,
                passwordRecovery: prev.passwordRecovery,
              }))
            } else {
              await supabase.auth.signOut()
              setAuthState({
                isAuthenticated: false,
                user: null,
                loading: false,
                error: null,
                passwordRecovery: false,
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
      } finally {
        if (mounted) {
          setAuthState(prev => (prev.loading ? { ...prev, loading: false } : prev))
        }
      }
    }

    initializeAuth()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!mounted) return

        (async () => {
          try {
            if (event === 'PASSWORD_RECOVERY' && session?.user) {
              // Don't fetch profile here — just mark recovery and show the form.
              // Fetching profile can fail for shared-project users and would kill the session.
              markPasswordRecoveryPending()
              ensureResetPasswordPath()
              if (!mounted) return
              setAuthState(prev => ({
                ...prev,
                isAuthenticated: true,
                loading: false,
                passwordRecovery: true,
              }))
            } else if (
              (event === 'SIGNED_IN' ||
                event === 'INITIAL_SESSION' ||
                event === 'TOKEN_REFRESHED') &&
              session?.user
            ) {
              // If we're in a recovery flow, don't touch the session
              const onResetPage =
                typeof window !== 'undefined' &&
                window.location.pathname.endsWith('/reset-password')
              if (onResetPage) {
                if (!mounted) return
                setAuthState(prev => ({
                  ...prev,
                  isAuthenticated: true,
                  loading: false,
                }))
                return
              }

              const profile = await fetchOrCreateUserProfile(session.user)
              if (!mounted) return

              if (profile) {
                syncSessionToBackground()
                setAuthState(prev => ({
                  isAuthenticated: true,
                  user: profile,
                  loading: false,
                  error: null,
                  passwordRecovery: prev.passwordRecovery,
                }))
              } else {
                // Profile fetch failed but we still have a valid auth session —
                // don't sign out. The fallback in fetchOrCreateUserProfile should
                // prevent reaching here, but just in case, keep the user signed in.
                setAuthState(prev => ({
                  ...prev,
                  isAuthenticated: true,
                  loading: false,
                  error: 'Could not load your profile. Please refresh.',
                }))
              }
            } else if (event === 'SIGNED_OUT') {
              // Don't clear recovery state if we're in the middle of a password reset
              const onResetPage =
                typeof window !== 'undefined' &&
                window.location.pathname.endsWith('/reset-password')
              if (!onResetPage) {
                clearPasswordRecoveryPending()
                clearAwaitingPasswordReset()
                setAuthState({
                  isAuthenticated: false,
                  user: null,
                  loading: false,
                  error: null,
                  passwordRecovery: false,
                })
              }
            } else {
              setAuthState(prev => ({ ...prev, loading: false }))
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
      clearAwaitingPasswordReset()
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
          redirectTo: getAuthRedirectUrl('/'),
        },
      })

      if (error) throw error
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Google sign in failed'
      setAuthState(prev => ({ ...prev, error: message }))
      throw error
    }
  }

  const resetPassword = async (email: string) => {
    try {
      setAuthState(prev => ({ ...prev, error: null }))

      markAwaitingPasswordReset()

      const redirectTo = getAuthRedirectUrl('/reset-password')
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo,
      })

      if (error) throw error
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not send reset email'
      setAuthState(prev => ({ ...prev, error: message }))
      throw error
    }
  }

  const updatePassword = async (password: string) => {
    try {
      setAuthState(prev => ({ ...prev, error: null }))

      const { data: updateData, error } = await supabase.auth.updateUser({ password })
      if (error) throw error

      clearPasswordRecoveryPending()
      clearAwaitingPasswordReset()

      // Fetch the user profile now (was skipped during recovery to protect the session)
      const authUser = updateData?.user ?? (await supabase.auth.getUser()).data.user
      const profile = authUser ? await fetchOrCreateUserProfile(authUser) : null

      setAuthState(prev => ({
        ...prev,
        passwordRecovery: false,
        isAuthenticated: Boolean(profile),
        user: profile ?? prev.user,
        loading: false,
      }))
    } catch (error) {
      let message = error instanceof Error ? error.message : 'Could not update password'
      if (message.toLowerCase().includes('auth session missing')) {
        message =
          'This reset link has expired or was already used. Go to login, choose Forgot password, and request a new email.'
      }
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
        resetPassword,
        updatePassword,
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
