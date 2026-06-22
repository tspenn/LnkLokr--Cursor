/**
 * ShareTarget — handles incoming shares from the Web Share Target API.
 *
 * When a user taps "Share" in any mobile app (Chrome, Safari, Instagram, etc.)
 * and selects LnkLokr, the OS opens the PWA at:
 *   /share?url=https://...&title=Page+Title&text=optional+text
 *
 * This component reads those params, lets the user pick a category,
 * saves the link, and redirects to the dashboard.
 */

import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { addLink } from '@/lib/dataService'
import { Icon } from './shared/Icon'

type Status = 'keep' | 'borrow' | 'share' | 'bury'

const CATEGORIES: { value: Status; label: string; color: string; desc: string }[] = [
  { value: 'keep',   label: 'Keep',   color: 'bg-yellow-100 border-yellow-400 hover:bg-yellow-200', desc: 'Save permanently' },
  { value: 'borrow', label: 'Borrow', color: 'bg-purple-100 border-purple-400 hover:bg-purple-200', desc: 'Temporary reference' },
  { value: 'share',  label: 'Share',  color: 'bg-pink-100   border-pink-400   hover:bg-pink-200',   desc: 'Pass along to someone' },
  { value: 'bury',   label: 'Bury',   color: 'bg-cyan-100   border-cyan-400   hover:bg-cyan-200',   desc: 'Archive privately' },
]

export function ShareTarget() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { user, isAuthenticated, loading } = useAuth()

  const rawUrl   = searchParams.get('url')   ?? ''
  const rawTitle = searchParams.get('title') ?? ''
  const rawText  = searchParams.get('text')  ?? ''

  // Extract the best URL from whatever the OS passed in
  const resolvedUrl = rawUrl || extractUrl(rawText) || ''
  const resolvedTitle = rawTitle || resolvedUrl

  const [status, setStatus]     = useState<Status>('keep')
  const [title, setTitle]       = useState(resolvedTitle)
  const [saving, setSaving]     = useState(false)
  const [saved, setSaved]       = useState(false)
  const [error, setError]       = useState('')

  // Redirect unauthenticated users to login, preserving the share params
  useEffect(() => {
    if (!loading && !isAuthenticated) {
      sessionStorage.setItem('pendingShare', window.location.search)
      navigate('/', { replace: true })
    }
  }, [loading, isAuthenticated, navigate])

  // After login, if there was a pending share, navigate back to /share
  useEffect(() => {
    if (isAuthenticated) {
      const pending = sessionStorage.getItem('pendingShare')
      if (pending && !rawUrl && !rawText) {
        sessionStorage.removeItem('pendingShare')
        navigate(`/share${pending}`, { replace: true })
      }
    }
  }, [isAuthenticated, navigate, rawUrl, rawText])

  const handleSave = async () => {
    if (!user) return
    if (!resolvedUrl && !title) { setError('Nothing to save.'); return }
    setSaving(true)
    setError('')
    try {
      // Best-effort metadata scrape
      let thumbnail_url: string | null = null
      let icon: string | null = null
      if (resolvedUrl) {
        try {
          const res = await fetch(`/api/scrape?url=${encodeURIComponent(resolvedUrl)}`)
          if (res.ok) {
            const m = await res.json()
            thumbnail_url = m.thumbnail_url ?? null
            icon = m.icon ?? null
            if (!title || title === resolvedUrl) setTitle(m.title || resolvedUrl)
          }
        } catch { /* non-fatal */ }
      }

      await addLink(user.is_premium ?? false, user.id, {
        url: resolvedUrl,
        title: title || resolvedUrl,
        description: rawText && rawText !== resolvedUrl ? rawText : null,
        thumbnail_url,
        icon,
        content_type: 'url',
        status,
        is_favorite: false,
        tags: [],
      })

      setSaved(true)
      setTimeout(() => navigate('/', { replace: true }), 1800)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-b from-cyan-100 via-pink-50 to-pink-200">
        <div className="text-gray-700 font-semibold animate-pulse">Loading…</div>
      </div>
    )
  }

  if (saved) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gradient-to-b from-cyan-100 via-pink-50 to-pink-200 gap-4 px-6">
        <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center shadow-lg">
          <Icon name="check-circle" size={32} className="text-white" />
        </div>
        <p className="text-2xl font-bold text-gray-900">Saved to {CATEGORIES.find(c => c.value === status)?.label}!</p>
        <p className="text-sm text-gray-600">Returning to LnkLokr…</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-pink-100 via-purple-50 to-orange-100 flex flex-col">
      {/* Header */}
      <div className="border-b-4 border-black bg-gradient-to-r from-pink-200 via-purple-200 to-orange-200 px-4 py-5 flex items-center gap-3">
        <img src="/icons/lokr-extension-144.png" alt="LnkLokr" className="w-10 h-10 object-contain" />
        <div>
          <p className="font-bold text-gray-900 text-lg leading-tight">Save to LnkLokr</p>
          <p className="text-xs text-gray-600">Choose where this goes</p>
        </div>
      </div>

      <div className="flex-1 px-4 py-6 max-w-md mx-auto w-full space-y-5">
        {/* What's being saved */}
        <div className="bg-white border-2 border-gray-200 rounded-2xl p-4 space-y-3">
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide">Title</label>
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Title (optional)"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
          {resolvedUrl && (
            <div className="flex items-center gap-2 text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
              <Icon name="globe" size={12} className="flex-shrink-0" />
              <span className="truncate">{resolvedUrl}</span>
            </div>
          )}
          {rawText && rawText !== resolvedUrl && (
            <p className="text-xs text-gray-500 italic line-clamp-2">{rawText}</p>
          )}
        </div>

        {/* Category picker */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide px-1">Save to</p>
          <div className="grid grid-cols-2 gap-2">
            {CATEGORIES.map(cat => (
              <button
                key={cat.value}
                onClick={() => setStatus(cat.value)}
                className={`border-4 rounded-2xl p-4 text-left transition font-bold text-gray-900 ${cat.color} ${
                  status === cat.value ? 'ring-4 ring-black ring-offset-1' : 'border-transparent'
                }`}
              >
                <p className="text-lg">{cat.label}</p>
                <p className="text-xs font-normal text-gray-600 mt-0.5">{cat.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2">{error}</p>
        )}

        {/* Actions */}
        <div className="space-y-3 pt-2">
          <button
            onClick={handleSave}
            disabled={saving || (!resolvedUrl && !title)}
            className="w-full py-4 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white font-bold text-lg rounded-2xl border-4 border-black transition shadow-lg"
          >
            {saving ? 'Saving…' : `Save to ${CATEGORIES.find(c => c.value === status)?.label}`}
          </button>
          <button
            onClick={() => navigate('/', { replace: true })}
            className="w-full py-3 text-gray-600 hover:text-gray-900 font-medium text-sm transition"
          >
            Cancel — go to LnkLokr
          </button>
        </div>
      </div>
    </div>
  )
}

/** Pull the first URL out of a blob of text (e.g. "Check this out: https://...") */
function extractUrl(text: string): string | null {
  try {
    const match = text.match(/https?:\/\/[^\s]+/)
    return match ? match[0] : null
  } catch {
    return null
  }
}
