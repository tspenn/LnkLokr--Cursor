import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import { getAuthErrorFromUrl } from '@/lib/authUrl'
import { Header } from '../shared/Header'
import { Icon } from '../shared/Icon'

export function ResetPassword() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [validationError, setValidationError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [sessionReady, setSessionReady] = useState(false)
  const [linkError, setLinkError] = useState<string | null>(null)
  const { updatePassword, error } = useAuth()

  useEffect(() => {
    // Check for error in URL first (e.g. otp_expired)
    const urlError = getAuthErrorFromUrl()
    if (urlError) {
      setLinkError(urlError)
      return
    }

    let cancelled = false

    // detectSessionInUrl fires PASSWORD_RECOVERY automatically when
    // the URL has #access_token=...&type=recovery — listen for it first.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (cancelled) return
        if (
          (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') &&
          session
        ) {
          // Clear the token from the URL so back/refresh doesn't re-trigger
          window.history.replaceState(null, '', '/reset-password')
          setSessionReady(true)
          setLinkError(null)
        }
      },
    )

    // Also check if a session already exists (e.g. INITIAL_SESSION already fired)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled || sessionReady) return
      if (session) {
        window.history.replaceState(null, '', '/reset-password')
        setSessionReady(true)
        setLinkError(null)
      } else {
        // Give detectSessionInUrl up to 4s to fire PASSWORD_RECOVERY
        setTimeout(() => {
          if (cancelled || sessionReady) return
          supabase.auth.getSession().then(({ data: { session: s2 } }) => {
            if (cancelled) return
            if (s2) {
              setSessionReady(true)
              setLinkError(null)
            } else {
              setLinkError(
                'This reset link has expired or was already used. Request a new one below.',
              )
            }
          })
        }, 4000)
      }
    })

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setValidationError('')

    if (password.length < 6) {
      setValidationError('Password must be at least 6 characters')
      return
    }
    if (password !== confirmPassword) {
      setValidationError('Passwords do not match')
      return
    }

    setIsLoading(true)
    try {
      await updatePassword(password)
      setDone(true)
    } finally {
      setIsLoading(false)
    }
  }

  const displayError = validationError || error
  const waitingForSession = !linkError && !sessionReady

  if (waitingForSession) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gradient-to-b from-cyan-100 via-pink-50 to-pink-200 gap-4">
        <img
          src="/icons/lokr-extension-144.png"
          alt="LnkLokr"
          className="w-24 h-24 object-contain animate-pulse drop-shadow-lg"
        />
        <p className="text-gray-700 font-semibold">Preparing password reset...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 bg-gradient-to-b from-cyan-100 via-pink-50 to-pink-200 border-x-4 border-b-4 border-black flex items-center justify-center p-8">
        <div className="w-full max-w-md bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl p-8 border-2 border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900 mb-2 text-center">Set a new password</h2>
          <p className="text-sm text-gray-600 text-center mb-6">
            Choose a new password for your LnkLokr account.
          </p>

          {done ? (
            <div className="text-center space-y-4">
              <p className="text-green-700 font-medium">Your password has been updated.</p>
              <Link
                to="/"
                className="inline-block text-pink-600 hover:text-pink-700 font-medium underline"
              >
                Sign in
              </Link>
            </div>
          ) : linkError ? (
            <div className="space-y-4 text-center">
              <div className="flex gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 text-sm text-left">
                <Icon name="alert-circle" size={16} className="flex-shrink-0 mt-0.5" />
                <span>{linkError}</span>
              </div>
              <Link
                to="/"
                className="inline-block text-pink-600 hover:text-pink-700 font-medium underline"
              >
                Back to login — request a new reset link
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {displayError && (
                <div className="flex gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  <Icon name="alert-circle" size={16} className="flex-shrink-0 mt-0.5" />
                  <span>{displayError}</span>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">New password</label>
                <div className="relative">
                  <Icon name="lock" size={18} className="absolute left-3 top-1/2 -translate-y-1/2 w-[18px] h-[18px]" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    className="w-full pl-10 pr-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-400 focus:border-pink-400 transition"
                    disabled={isLoading}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Confirm password</label>
                <div className="relative">
                  <Icon name="lock" size={18} className="absolute left-3 top-1/2 -translate-y-1/2 w-[18px] h-[18px]" />
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={6}
                    className="w-full pl-10 pr-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-400 focus:border-pink-400 transition"
                    disabled={isLoading}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading || !password || !confirmPassword}
                className="w-full bg-gradient-to-r from-pink-400 to-orange-300 hover:from-pink-500 hover:to-orange-400 disabled:from-gray-300 disabled:to-gray-300 text-white font-bold py-3 rounded-lg transition shadow-md hover:shadow-lg disabled:cursor-not-allowed"
              >
                {isLoading ? 'Saving...' : 'Update password'}
              </button>
            </form>
          )}
        </div>
      </main>
    </div>
  )
}
