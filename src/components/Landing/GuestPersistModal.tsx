import { AuthModal } from './AuthModal'

export type PersistReason = 'share' | 'bury' | 'dreamkeeper'

const COPY: Record<PersistReason, { title: string; body: string }> = {
  share: {
    title: 'Sign in to Share',
    body: 'Share sends things to other people. Without an account, shared items will not persist — they vanish when you leave.',
  },
  bury: {
    title: 'Sign in to Bury',
    body: 'Bury is your locked vault. Sign in to set a lock. Without an account, buried items will not persist.',
  },
  dreamkeeper: {
    title: 'Sign in to save your dream',
    body: 'Play with the board all you want. Sign in to save it. Without an account, Dream Keeper will not persist.',
  },
}

interface GuestPersistModalProps {
  reason: PersistReason
  onClose: () => void
}

export function GuestPersistModal({ reason, onClose }: GuestPersistModalProps) {
  return (
    <AuthModal
      initialMode="signup"
      persistWarning={COPY[reason]}
      onClose={onClose}
    />
  )
}
