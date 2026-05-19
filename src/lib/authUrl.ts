const RECOVERY_FLAG = 'lnklokr_password_recovery'
const AWAITING_RESET_FLAG = 'lnklokr_awaiting_reset'

export function markAwaitingPasswordReset(): void {
  if (typeof window !== 'undefined') {
    sessionStorage.setItem(AWAITING_RESET_FLAG, '1')
  }
}

export function clearAwaitingPasswordReset(): void {
  if (typeof window !== 'undefined') {
    sessionStorage.removeItem(AWAITING_RESET_FLAG)
  }
}

export function isAwaitingPasswordReset(): boolean {
  if (typeof window === 'undefined') return false
  return sessionStorage.getItem(AWAITING_RESET_FLAG) === '1'
}

export function markPasswordRecoveryPending(): void {
  if (typeof window !== 'undefined') {
    sessionStorage.setItem(RECOVERY_FLAG, '1')
  }
}

export function clearPasswordRecoveryPending(): void {
  if (typeof window !== 'undefined') {
    sessionStorage.removeItem(RECOVERY_FLAG)
  }
}

export function isPasswordRecoveryPending(): boolean {
  if (typeof window === 'undefined') return false
  return sessionStorage.getItem(RECOVERY_FLAG) === '1'
}

export function isPasswordRecoveryUrl(): boolean {
  if (typeof window === 'undefined') return false

  const { hash, search, pathname } = window.location

  if (isPasswordRecoveryPending()) {
    return true
  }

  if (isAwaitingPasswordReset() && hasAuthCallbackInUrl()) {
    return true
  }

  const params = new URLSearchParams(search)
  const hashParams = new URLSearchParams(hash.replace(/^#/, ''))

  const type =
    params.get('type') ?? hashParams.get('type') ?? ''

  if (type === 'recovery' || type === 'magiclink') {
    return true
  }

  if (hash.includes('type=recovery') || search.includes('type=recovery')) {
    return true
  }

  // PKCE: ?code= on reset-password or right after email link
  if (params.has('code') && (pathname.includes('reset') || isPasswordRecoveryPending())) {
    return true
  }

  return false
}

/** Move user to /reset-password while keeping hash/query for Supabase token exchange. */
export function ensureResetPasswordPath(): void {
  if (typeof window === 'undefined') return
  if (window.location.pathname.endsWith('/reset-password')) return

  if (!isPasswordRecoveryUrl() && !isPasswordRecoveryPending()) return

  markPasswordRecoveryPending()
  const suffix = window.location.hash || window.location.search
  window.history.replaceState(null, '', `/reset-password${suffix}`)
}

export function getAuthErrorFromUrl(): string | null {
  if (typeof window === 'undefined') return null
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''))
  const searchParams = new URLSearchParams(window.location.search)

  const error =
    hashParams.get('error') ?? searchParams.get('error')
  if (!error) return null

  const description =
    hashParams.get('error_description') ?? searchParams.get('error_description')
  if (description) {
    return decodeURIComponent(description.replace(/\+/g, ' '))
  }

  const code = hashParams.get('error_code') ?? searchParams.get('error_code')
  if (code === 'otp_expired') {
    return 'This reset link has expired. Please request a new one.'
  }

  return 'Could not verify the reset link. Please request a new one.'
}

export function hasAuthCallbackInUrl(): boolean {
  if (typeof window === 'undefined') return false
  const { hash, search } = window.location
  return (
    hash.includes('access_token') ||
    hash.includes('type=recovery') ||
    search.includes('code=') ||
    search.includes('type=recovery')
  )
}
