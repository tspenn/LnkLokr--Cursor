/** LnkLokr web URL — used when extension popup cannot supply an http(s) origin. */
const LNKLORKR_SITE_URL = 'https://lnk-lokr-cursor.vercel.app'

/**
 * Where Supabase sends users after password-reset / OAuth (must be allowlisted in Supabase Auth).
 * Extension popups use chrome-extension:// origins, so we always fall back to the LnkLokr site URL.
 */
export function getAuthRedirectUrl(path = '/'): string {
  const fromEnv = import.meta.env.VITE_PUBLIC_SITE_URL as string | undefined
  const fromWindow =
    typeof window !== 'undefined' && window.location.protocol.startsWith('http')
      ? window.location.origin
      : undefined

  const siteUrl = (fromEnv || fromWindow || LNKLORKR_SITE_URL).replace(/\/$/, '')
  return `${siteUrl}${path.startsWith('/') ? path : `/${path}`}`
}

/**
 * Where Supabase sends users after email confirmation.
 * Reads VITE_APP_URL first, falls back to window.location.origin, then the hardcoded site URL.
 * The resulting URL must be allowlisted in Supabase Auth → URL Configuration → Redirect URLs.
 */
export function getConfirmRedirectUrl(): string {
  const fromEnv = import.meta.env.VITE_APP_URL as string | undefined
  const fromWindow =
    typeof window !== 'undefined' && window.location.protocol.startsWith('http')
      ? window.location.origin
      : undefined

  const base = (fromEnv || fromWindow || LNKLORKR_SITE_URL).replace(/\/$/, '')
  return `${base}/auth/confirm`
}
