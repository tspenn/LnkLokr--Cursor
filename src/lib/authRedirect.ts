/** Where Supabase sends users after password-reset emails (must be allowlisted in Supabase Auth). */
export function getAuthRedirectUrl(path = '/'): string | undefined {
  const siteUrl = import.meta.env.VITE_PUBLIC_SITE_URL as string | undefined
  if (siteUrl) {
    return `${siteUrl.replace(/\/$/, '')}${path}`
  }
  if (typeof window !== 'undefined' && window.location.protocol.startsWith('http')) {
    return `${window.location.origin}${path}`
  }
  return undefined
}
