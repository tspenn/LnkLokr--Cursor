import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import { getAuthErrorFromUrl, hasAuthCallbackInUrl } from '@/lib/authUrl'
import { Header } from '../shared/Header'
import { Icon } from '../shared/Icon'

export function ResetPassword() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [validationError, setValidationError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [sessionReady, setSessionReady] = useState(false)
  const [linkError, setLinkError] = useState<string | null>(() => getAuthErrorFromUrl())
  const { updatePassword, error, loading: authLoading } = useAuth()

  useEffect(() => {
    const urlError = getAuthErrorFromUrl()
    if (urlError) {
      setLinkError(urlError)
      return
    }

    let cancelled = false

    const verifySession = async () => {
      // 1. Handle implicit flow: #access_token=...&type=recovery in the URL hash
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''))
      const accessToken = hashParams.get('access_token')
      const refreshToken = hashParams.get('refresh_token') ?? ''
      const hashType = hashParams.get('type')

      if (accessToken && hashType === 'recovery') {
        const { data, error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        })
        if (cancelled) return
        if (sessionError) {
          setLinkError('This reset link has expired. Please request a new one.')
          return
        }
        if (data.session) {
          window.history.replaceState(null, '', '/reset-password')
          setSessionReady(true)
          setLinkError(null)
          return
        }
      }

      // 2. Handle PKCE flow: ?code= in the URL query string
      const params = new URLSearchParams(window.location.search)
      const code = params.get('code')
      if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
        if (cancelled) return
        if (exchangeError) {
          setLinkError('This reset link has expired. Please request a new one.')
          return
        }
        window.history.replaceState(null, '', '/reset-password')
      }

      // 3. Check if session already exists (e.g. already exchanged)
      const { data: { session } } = await supabase.auth.getSession()
      if (cancelled) return

      if (session) {
        setSessionReady(true)
        setLinkError(null)
      } else if (!hasAuthCallbackInUrl()) {
        setLinkError(
          'Open the password reset link from your email. Links expire after a short time — request a new one below.',
        )
      } else {
        // Token in URL but session not ready yet — wait for onAuthStateChange
      }
    }

    verifySession()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') && session) {
        if (!cancelled) {
          setSessionReady(true)
          setLinkError(null)
        }
      }
    })

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setValidationError('')

    if (!sessionReady) {
      setValidationError('Reset session expired. Request a new link from the login page.')
      return
    }

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
      window.history.replaceState(null, '', '/reset-password')
      setDone(true)
    } finally {
      setIsLoading(false)
    }
  }

  const displayError = validationError || error
  const waitingForSession =
    !linkError && !sessionReady && (authLoading || hasAuthCallbackInUrl())

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
                    disabled={isLoading || !sessionReady}
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
                    disabled={isLoading || !sessionReady}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading || !sessionReady || !password || !confirmPassword}
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
