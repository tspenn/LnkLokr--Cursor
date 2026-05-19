import React, { useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { getAuthErrorFromUrl } from '@/lib/authUrl'
import { Header } from '../shared/Header'
import { Icon } from '../shared/Icon'
import { TREASURE_CHEST_SRC } from '@/lib/chestIcon'

interface LoginProps {
  onSignUpClick: () => void
}

export function Login({ onSignUpClick }: LoginProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [mode, setMode] = useState<'signin' | 'forgot'>('signin')
  const [resetSent, setResetSent] = useState(false)
  const [linkError, setLinkError] = useState<string | null>(null)
  const { signIn, resetPassword, error } = useAuth()

  useEffect(() => {
    const urlError = getAuthErrorFromUrl()
    if (urlError) {
      setLinkError(urlError)
      setMode('forgot')
      window.history.replaceState(null, '', window.location.pathname)
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    try {
      if (mode === 'forgot') {
        await resetPassword(email)
        setResetSent(true)
      } else {
        await signIn(email, password)
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 bg-gradient-to-b from-cyan-100 via-pink-50 to-pink-200 border-x-4 border-b-4 border-black relative flex items-center justify-center p-8">
        <div className="w-full max-w-md bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl p-8 border-2 border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">
            {mode === 'forgot' ? 'Reset password' : 'Welcome Back'}
          </h2>

          {linkError && (
            <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 text-sm">
              {linkError} Request a new link below. If you use Outlook or corporate email, copy the
              link and paste it into the browser instead of clicking (email scanners can break links).
            </div>
          )}

          {mode === 'forgot' && resetSent && !linkError && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-800 text-sm">
              Check your email for a reset link. Use the <strong>latest</strong> email only. Open the
              link once — if it fails, request another reset here.
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && !resetSent && (
              <div className="flex gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                <Icon name="alert-circle" size={16} className="flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <div className="relative">
                <Icon name="mail" size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  className="w-full pl-10 pr-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-400 focus:border-pink-400 transition"
                  disabled={isLoading || resetSent}
                />
              </div>
            </div>

            {mode === 'signin' && (
              <>
                <div className="flex justify-end -mt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setMode('forgot')
                      setResetSent(false)
                    }}
                    className="text-sm text-pink-600 hover:text-pink-700 underline"
                  >
                    Forgot password?
                  </button>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                  <div className="relative">
                    <Icon name="lock" size={18} className="absolute left-3 top-1/2 -translate-y-1/2 w-[18px] h-[18px]" />
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      className="w-full pl-10 pr-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-400 focus:border-pink-400 transition"
                      disabled={isLoading}
                    />
                  </div>
                </div>
              </>
            )}

            {mode === 'forgot' && !resetSent && (
              <p className="text-sm text-gray-600">
                Enter your email and we&apos;ll send you a link to reset your password.
              </p>
            )}

            <button
              type="submit"
              disabled={isLoading || !email || (mode === 'signin' && !password) || resetSent}
              className="w-full bg-gradient-to-r from-pink-400 to-orange-300 hover:from-pink-500 hover:to-orange-400 disabled:from-gray-300 disabled:to-gray-300 text-white font-bold py-3 rounded-lg transition shadow-md hover:shadow-lg disabled:cursor-not-allowed"
            >
              {isLoading
                ? mode === 'forgot'
                  ? 'Sending...'
                  : 'Signing in...'
                : mode === 'forgot'
                  ? 'Send reset link'
                  : 'Sign In'}
            </button>

            {mode === 'forgot' && (
              <button
                type="button"
                onClick={() => {
                  setMode('signin')
                  setResetSent(false)
                }}
                className="w-full text-sm text-gray-600 hover:text-gray-800 underline"
              >
                Back to sign in
              </button>
            )}
          </form>

          {mode === 'signin' && (
            <p className="text-center text-gray-600 text-sm mt-6">
              Don&apos;t have an account?{' '}
              <button
                onClick={onSignUpClick}
                className="text-pink-600 hover:text-pink-700 font-medium underline"
              >
                Sign up
              </button>
            </p>
          )}
        </div>

        <div className="absolute bottom-4 right-4 pointer-events-none z-0">
          <img
            src={TREASURE_CHEST_SRC}
            alt="Lockbox"
            width="96"
            height="96"
            className="w-24 h-24 object-contain drop-shadow-lg"
          />
        </div>
      </main>
    </div>
  )
}
