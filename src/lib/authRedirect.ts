/** LnkLokr web URL — used when extension popup cannot supply an http(s) origin. */
const LNKLORKR_SITE_URL = 'https://lnk-lokr-cursor.vercel.app'

/** Public site users open in a normal browser (desktop or phone). */
export const LNKLORKR_WEB_URL = 'https://www.lnklokr.com'

export function getPublicAppUrl(path = '/'): string {
  const fromEnv = import.meta.env.VITE_PUBLIC_SITE_URL as string | undefined
  const looksPublic = fromEnv && /^https?:\/\/(www\.)?lnklokr\.com\/?$/i.test(fromEnv)
  const base = (looksPublic ? fromEnv : LNKLORKR_WEB_URL).replace(/\/$/, '')
  return `${base}${path.startsWith('/') ? path : `/${path}`}`
}

export function isExtensionPopup(): boolean {
  return typeof window !== 'undefined' && window.location.protocol === 'chrome-extension:'
}

/** Open a LnkLokr path in a real browser tab instead of the extension popup. */
export function openInBrowser(path: string): void {
  const url = getPublicAppUrl(path)
  const chromeTabs = (
    globalThis as { chrome?: { tabs?: { create: (info: { url: string }) => void } } }
  ).chrome?.tabs
  if (chromeTabs?.create) {
    chromeTabs.create({ url })
    return
  }
  window.open(url, '_blank', 'noopener,noreferrer')
}

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
