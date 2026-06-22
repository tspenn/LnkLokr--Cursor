import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { getAuthErrorFromUrl } from '@/lib/authUrl'

const TIMEOUT_MS = 8000

export function ConfirmEmail() {
  const [status, setStatus] = useState<'waiting' | 'error'>('waiting')
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    const urlError = getAuthErrorFromUrl()
    if (urlError) {
      setErrorMessage(urlError)
      setStatus('error')
      return
    }

    let cancelled = false

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled) return
      if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session) {
        window.history.replaceState(null, '', '/auth/confirm')
        window.location.replace('/')
      }
    })

    // Also check if the session was already established (INITIAL_SESSION already fired)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return
      if (session) {
        window.location.replace('/')
      }
    })

    const timeout = setTimeout(() => {
      if (cancelled) return
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (cancelled) return
        if (session) {
          window.location.replace('/')
        } else {
          setErrorMessage(
            'This confirmation link has expired or was already used. Please sign in or request a new confirmation email.',
          )
          setStatus('error')
        }
      })
    }, TIMEOUT_MS)

    return () => {
      cancelled = true
      clearTimeout(timeout)
      subscription.unsubscribe()
    }
  }, [])

  if (status === 'error') {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gradient-to-b from-cyan-100 via-pink-50 to-pink-200 gap-6 p-8">
        <img
          src="/icons/lokr-extension-144.png"
          alt="LnkLokr"
          className="w-20 h-20 object-contain drop-shadow-lg opacity-60"
        />
        <div className="w-full max-w-sm bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl p-6 border-2 border-amber-200 text-center space-y-4">
          <p className="text-amber-800 text-sm leading-relaxed">{errorMessage}</p>
          <a
            href="/"
            className="inline-block text-pink-600 hover:text-pink-700 font-medium underline text-sm"
          >
            Back to sign in
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-gradient-to-b from-cyan-100 via-pink-50 to-pink-200 gap-4">
      <img
        src="/icons/lokr-extension-144.png"
        alt="LnkLokr"
        className="w-24 h-24 object-contain animate-pulse drop-shadow-lg"
      />
      <p className="text-gray-700 font-semibold">Confirming your email…</p>
    </div>
  )
}
