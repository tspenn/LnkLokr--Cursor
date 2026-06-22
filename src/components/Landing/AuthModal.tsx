import React, { useState, useEffect } from 'react'
import { useAuth } from '@/context/AuthContext'
import { Icon } from '../shared/Icon'

interface AuthModalProps {
  initialMode?: 'signin' | 'signup'
  onClose: () => void
}

export function AuthModal({ initialMode = 'signin', onClose }: AuthModalProps) {
  const [mode, setMode] = useState<'signin' | 'signup' | 'forgot'>(initialMode)
  const { signIn, signUp, resetPassword, error, isAuthenticated, confirmationPending, clearConfirmationPending } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [localError, setLocalError] = useState('')
  const [resetSent, setResetSent] = useState(false)
  const [isDuplicateEmail, setIsDuplicateEmail] = useState(false)

  // Close automatically when auth succeeds
  useEffect(() => {
    if (isAuthenticated) onClose()
  }, [isAuthenticated, onClose])

  // Close is suppressed while confirmation is pending — show check-email UI instead

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const switchMode = (next: 'signin' | 'signup' | 'forgot') => {
    setMode(next)
    setLocalError('')
    setIsDuplicateEmail(false)
    setResetSent(false)
    setPassword('')
    setConfirmPassword('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLocalError('')
    setIsDuplicateEmail(false)

    if (mode === 'signup') {
      if (password !== confirmPassword) { setLocalError('Passwords do not match'); return }
      if (password.length < 6) { setLocalError('Password must be at least 6 characters'); return }
    }

    setIsLoading(true)
    try {
      if (mode === 'forgot') {
        await resetPassword(email)
        setResetSent(true)
      } else if (mode === 'signup') {
        await signUp(email, password)
      } else {
        await signIn(email, password)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message.toLowerCase() : ''
      if (
        mode === 'signup' &&
        (msg.includes('already registered') || msg.includes('already exists') || msg.includes('duplicate'))
      ) {
        setIsDuplicateEmail(true)
      }
    } finally {
      setIsLoading(false)
    }
  }

  const displayError = isDuplicateEmail ? null : (localError || error)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(3px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-8 relative animate-fade-in">
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition"
          aria-label="Close"
        >
          <Icon name="x" size={20} />
        </button>

        {/* Check-your-email state */}
        {confirmationPending && (
          <div className="text-center space-y-4 py-4">
            <div className="mx-auto w-14 h-14 rounded-full bg-pink-100 flex items-center justify-center">
              <Icon name="mail" size={28} className="text-pink-500" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">Check your email</h2>
            <p className="text-sm text-gray-600 leading-relaxed">
              We sent a confirmation link to <strong>{email}</strong>.
              Click it to activate your Skyland Reach account.
            </p>
            <p className="text-xs text-gray-400">
              Didn&apos;t get it? Check your spam folder or{' '}
              <button
                type="button"
                onClick={clearConfirmationPending}
                className="text-pink-600 hover:text-pink-700 underline"
              >
                try again
              </button>
              .
            </p>
          </div>
        )}

        {/* Main modal content */}
        {!confirmationPending && <>

        {/* Heading */}
        <h2 className="text-2xl font-bold text-gray-900 text-center mb-1">
          {mode === 'forgot' ? 'Reset your password' : mode === 'signup' ? 'Create your account' : 'Welcome back'}
        </h2>
        <p className="text-xs text-gray-500 text-center mb-6">
          {mode === 'forgot'
            ? "Enter your email and we'll send a reset link."
            : 'One Skyland Reach account for LnkLokr, FRIDAY Canvas, Go Shop & more'}
        </p>

        {/* Reset sent */}
        {resetSent && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-800 text-sm">
            Check your email for a reset link. Use the <strong>latest</strong> one only.
          </div>
        )}

        {/* Duplicate email */}
        {isDuplicateEmail && (
          <div className="mb-4 flex flex-col gap-2 p-3 bg-teal-50 border border-teal-300 rounded-lg text-teal-900 text-sm">
            <div className="flex gap-2 items-start">
              <Icon name="info" size={16} className="flex-shrink-0 mt-0.5 text-teal-600" />
              <span>You already have a Skyland Reach account.</span>
            </div>
            <button
              type="button"
              onClick={() => switchMode('signin')}
              className="self-start ml-6 text-teal-700 hover:text-teal-900 font-medium underline"
            >
              Switch to sign in →
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {displayError && (
            <div className="flex gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              <Icon name="alert-circle" size={16} className="flex-shrink-0 mt-0.5" />
              <span>{displayError}</span>
            </div>
          )}

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <div className="relative">
              <Icon name="mail" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com" required
                disabled={isLoading || resetSent}
                className="w-full pl-9 pr-4 py-2.5 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-400 focus:border-pink-400 transition text-sm"
              />
            </div>
          </div>

          {/* Password */}
          {mode !== 'forgot' && (
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-sm font-medium text-gray-700">Password</label>
                {mode === 'signin' && (
                  <button type="button" onClick={() => switchMode('forgot')}
                    className="text-xs text-pink-600 hover:text-pink-700 underline">
                    Forgot password?
                  </button>
                )}
              </div>
              <div className="relative">
                <Icon name="lock" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type={showPassword ? 'text' : 'password'} value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••" required disabled={isLoading}
                  className="w-full pl-9 pr-10 py-2.5 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-400 focus:border-pink-400 transition text-sm"
                />
                <button type="button" tabIndex={-1}
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  <Icon name={showPassword ? 'eye-off' : 'eye'} size={16} />
                </button>
              </div>
            </div>
          )}

          {/* Confirm password */}
          {mode === 'signup' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Confirm password</label>
              <div className="relative">
                <Icon name="lock" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type={showConfirmPassword ? 'text' : 'password'} value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="••••••••" required disabled={isLoading}
                  className="w-full pl-9 pr-10 py-2.5 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-400 focus:border-pink-400 transition text-sm"
                />
                <button type="button" tabIndex={-1}
                  onClick={() => setShowConfirmPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  <Icon name={showConfirmPassword ? 'eye-off' : 'eye'} size={16} />
                </button>
              </div>
            </div>
          )}

          {/* Submit */}
          <button type="submit"
            disabled={isLoading || !email || (mode !== 'forgot' && !password) || (mode === 'signup' && !confirmPassword) || resetSent}
            className="w-full bg-gradient-to-r from-pink-500 to-orange-400 hover:from-pink-600 hover:to-orange-500 disabled:from-gray-300 disabled:to-gray-300 text-white font-bold py-3 rounded-lg transition shadow-md disabled:cursor-not-allowed text-sm"
          >
            {isLoading
              ? mode === 'forgot' ? 'Sending…' : mode === 'signup' ? 'Creating account…' : 'Signing in…'
              : mode === 'forgot' ? 'Send reset link'
              : mode === 'signup' ? 'Create free account'
              : 'Sign In'}
          </button>

          {mode === 'forgot' && (
            <button type="button" onClick={() => switchMode('signin')}
              className="w-full text-sm text-gray-500 hover:text-gray-700 underline">
              Back to sign in
            </button>
          )}
        </form>


        {/* Footer switch */}
        <p className="text-center text-gray-500 text-xs mt-5">
          {mode === 'signup' ? (
            <>Already have a Skyland Reach account?{' '}
              <button onClick={() => switchMode('signin')} className="text-pink-600 font-medium underline">Sign in</button>
            </>
          ) : mode === 'signin' ? (
            <>Don&apos;t have an account?{' '}
              <button onClick={() => switchMode('signup')} className="text-pink-600 font-medium underline">Create one free</button>
            </>
          ) : null}
        </p>

        </>}
      </div>
    </div>
  )
}
