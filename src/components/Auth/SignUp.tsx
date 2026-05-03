import React, { useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { Header } from '../shared/Header'
import { Icon } from '../shared/Icon'

interface SignUpProps {
  onLoginClick: () => void
}

export function SignUp({ onLoginClick }: SignUpProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [validationError, setValidationError] = useState('')
  const { signUp, error } = useAuth()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setValidationError('')

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
    } finally {
      setIsLoading(false)
    }
  }

  const displayError = validationError || error

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 bg-gradient-to-b from-cyan-100 via-pink-50 to-pink-200 border-x-4 border-b-4 border-black relative flex items-center justify-center p-8">
        <div className="w-full max-w-md bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl p-8 border-2 border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">Create Account</h2>

          <div className="mb-6 p-4 bg-blue-50 border-2 border-blue-200 rounded-lg">
            <p className="text-sm text-blue-900 leading-relaxed">
              <strong>Cloud Storage Notice:</strong> By signing up, you agree to store your saved links and images on our secure cloud platform. Free accounts include 500MB storage. Upgrade anytime for unlimited storage.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
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

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Confirm Password
              </label>
              <div className="relative">
                <Icon name="lock" size={18} className="absolute left-3 top-1/2 -translate-y-1/2 w-[18px] h-[18px]" />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full pl-10 pr-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-400 focus:border-pink-400 transition"
                  disabled={isLoading}
                />
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
            Already have an account?{' '}
            <button
              onClick={onLoginClick}
              className="text-pink-600 hover:text-pink-700 font-medium underline"
            >
              Sign in
            </button>
          </p>
        </div>

        <div className="absolute bottom-8 right-8">
          <img
            src="/level_lock_box.png"
            alt="Lockbox"
            width="180"
            height="180"
            className="drop-shadow-lg"
          />
        </div>
      </main>
    </div>
  )
}
