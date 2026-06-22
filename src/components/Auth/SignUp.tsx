import React, { useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { Header } from '../shared/Header'
import { Icon } from '../shared/Icon'
import { TREASURE_CHEST_SRC } from '@/lib/chestIcon'

interface SignUpProps {
  onLoginClick: () => void
}

export function SignUp({ onLoginClick }: SignUpProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [validationError, setValidationError] = useState('')
  const [isDuplicateEmail, setIsDuplicateEmail] = useState(false)
  const { signUp, error, confirmationPending, clearConfirmationPending } = useAuth()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setValidationError('')
    setIsDuplicateEmail(false)

    if (password !== confirmPassword) {
      setValidationError('Passwords do not match')
      return
    }

    if (password.length < 6) {
      setValidationError('Password must be at least 6 characters')
      return
    }

    setIsLoading(true)
    try {
      await signUp(email, password)
    } catch (err) {
      const msg = err instanceof Error ? err.message.toLowerCase() : ''
      if (
        msg.includes('already registered') ||
        msg.includes('already exists') ||
        msg.includes('already been registered') ||
        msg.includes('duplicate key')
      ) {
        setIsDuplicateEmail(true)
      }
    } finally {
      setIsLoading(false)
    }
  }

  const displayError = isDuplicateEmail ? null : (validationError || error)

  if (confirmationPending) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 bg-gradient-to-b from-cyan-100 via-pink-50 to-pink-200 border-x-4 border-b-4 border-black flex items-center justify-center p-8">
          <div className="w-full max-w-md bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl p-8 border-2 border-gray-200 text-center space-y-4">
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
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 bg-gradient-to-b from-cyan-100 via-pink-50 to-pink-200 border-x-4 border-b-4 border-black relative flex items-center justify-center p-8">
        <div className="w-full max-w-md bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl p-8 border-2 border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900 mb-1 text-center">Create your Skyland Reach account</h2>
          <p className="text-sm text-gray-500 text-center mb-6">
            One account for Secret Agent, FRIDAY Canvas, Go Shop, GoTRVL &amp; LnkLokr
          </p>

          <div className="mb-6 p-4 bg-blue-50 border-2 border-blue-200 rounded-lg">
            <p className="text-sm text-blue-900 leading-relaxed">
              <strong>Cloud Storage Notice:</strong> By signing up, you agree to store your saved links and images on our secure cloud platform. Free accounts include 500MB storage. Upgrade anytime for unlimited storage.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {isDuplicateEmail && (
              <div className="flex flex-col gap-2 p-3 bg-teal-50 border border-teal-300 rounded-lg text-teal-900 text-sm">
                <div className="flex gap-2 items-start">
                  <Icon name="info" size={16} className="flex-shrink-0 mt-0.5 text-teal-600" />
                  <span>You already have a Skyland Reach account.</span>
                </div>
                <button
                  type="button"
                  onClick={onLoginClick}
                  className="self-start ml-6 text-teal-700 hover:text-teal-900 font-medium underline"
                >
                  Switch to sign in →
                </button>
              </div>
            )}

            {displayError && (
              <div className="flex gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                <Icon name="alert-circle" size={16} className="flex-shrink-0 mt-0.5" />
                <span>{displayError}</span>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <div className="relative">
                <Icon name="mail" size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  className="w-full pl-10 pr-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-400 focus:border-pink-400 transition"
                  disabled={isLoading}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <div className="relative">
                <Icon name="lock" size={18} className="absolute left-3 top-1/2 -translate-y-1/2 w-[18px] h-[18px]" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full pl-10 pr-10 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-400 focus:border-pink-400 transition"
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition"
                  tabIndex={-1}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  <Icon name={showPassword ? 'eye-off' : 'eye'} size={18} />
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Confirm Password
              </label>
              <div className="relative">
                <Icon name="lock" size={18} className="absolute left-3 top-1/2 -translate-y-1/2 w-[18px] h-[18px]" />
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full pl-10 pr-10 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-400 focus:border-pink-400 transition"
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition"
                  tabIndex={-1}
                  aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                >
                  <Icon name={showConfirmPassword ? 'eye-off' : 'eye'} size={18} />
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading || !email || !password || !confirmPassword}
              className="w-full bg-gradient-to-r from-pink-400 to-orange-300 hover:from-pink-500 hover:to-orange-400 disabled:from-gray-300 disabled:to-gray-300 text-white font-bold py-3 rounded-lg transition shadow-md hover:shadow-lg disabled:cursor-not-allowed"
            >
              {isLoading ? 'Creating account...' : 'Sign Up'}
            </button>
          </form>

          <p className="text-center text-gray-600 text-sm mt-6">
            Already have a Skyland Reach account?{' '}
            <button
              onClick={onLoginClick}
              className="text-pink-600 hover:text-pink-700 font-medium underline"
            >
              Sign in
            </button>
          </p>

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
