import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { Header } from '../shared/Header'
import { Icon } from '../shared/Icon'

export function ResetPassword() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [validationError, setValidationError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [done, setDone] = useState(false)
  const { updatePassword, error } = useAuth()

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
