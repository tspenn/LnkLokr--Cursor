import { Icon } from './Icon'

/** Wide banner in public/ — file: public/header_lnklokr.png */
const HEADER_BANNER_SRC = '/header_lnklokr.png'

interface HeaderProps {
  email?: string
  isPremium?: boolean
  onSettings?: () => void
  onSignOut?: () => void
  onUpgrade?: () => void
  onSignIn?: () => void
  onBack?: () => void
  /** Compact single 100px bar with Menu inline (e.g. Dream Keeper) */
  tall?: boolean
}

function MenuButton({ onBack }: { onBack: () => void }) {
  return (
    <button
      type="button"
      onClick={onBack}
      className="flex items-center gap-1.5 px-3 py-1.5 bg-white border-2 border-black hover:bg-purple-100 rounded-full text-sm font-bold transition shadow-sm shrink-0"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M19 12H5M5 12L12 19M5 12L12 5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
      Menu
    </button>
  )
}

export function Header({
  email,
  isPremium,
  onSettings,
  onSignOut,
  onUpgrade,
  onSignIn,
  onBack,
  tall = false,
}: HeaderProps) {
  // Dream Keeper: one 100px bar — Menu + logo, no pink strip / second toolbar
  if (tall) {
    return (
      <header className="border-b-4 border-black shadow-md shrink-0">
        <div className="h-[100px] min-h-[100px] w-full flex items-center gap-3 px-4 bg-white">
          {onBack && <MenuButton onBack={onBack} />}
          <div className="flex-1 flex items-center justify-center min-w-0">
            <img
              src={HEADER_BANNER_SRC}
              alt="LnkLokr"
              className="h-[70px] w-auto max-w-[min(100%,480px)] object-contain"
            />
          </div>
          {/* Balance the Menu button so the logo stays visually centered */}
          {onBack && <div className="w-[88px] shrink-0" aria-hidden />}
        </div>
      </header>
    )
  }

  const showToolbar = Boolean(email || onBack || onSettings || onSignOut || onUpgrade || onSignIn)

  return (
    <header className="border-b-4 border-black shadow-md shrink-0">
      <div className="w-full min-h-[120px] sm:min-h-[160px] flex items-center justify-center bg-gradient-to-r from-pink-200 via-purple-200 to-orange-200 px-4 py-4 sm:py-6">
        <img
          src={HEADER_BANNER_SRC}
          alt="LnkLokr"
          className="h-24 sm:h-32 md:h-36 w-auto max-w-[min(100%,720px)] object-contain"
        />
      </div>

      {showToolbar && (
        <div className="border-t-2 border-black/15 bg-gradient-to-r from-pink-50 via-purple-50 to-orange-50">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              {onBack && <MenuButton onBack={onBack} />}
              {email && (
                <p className="text-sm sm:text-base font-medium text-gray-800 truncate max-w-[min(100%,200px)]">
                  {email}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              {onSignIn && !email && (
                <button
                  type="button"
                  onClick={onSignIn}
                  className="px-4 py-2 bg-gradient-to-r from-pink-400 to-orange-300 hover:from-pink-500 hover:to-orange-400 text-white border-2 border-pink-400 rounded-full text-sm font-bold transition shadow-sm"
                >
                  Sign in
                </button>
              )}
              {isPremium ? (
                <div className="flex items-center gap-1.5 px-4 py-2 bg-amber-100 border-2 border-amber-400 text-amber-900 rounded-full text-sm font-bold">
                  <Icon name="crown" size={18} />
                  Premium
                </div>
              ) : (
                onUpgrade && (
                  <button
                    type="button"
                    onClick={onUpgrade}
                    className="flex items-center gap-1.5 px-4 py-2 bg-white border-2 border-black text-gray-900 hover:bg-yellow-100 rounded-full text-sm font-bold transition shadow-sm"
                  >
                    <Icon name="crown" size={18} />
                    Upgrade
                  </button>
                )
              )}
              {onSettings && (
                <button
                  type="button"
                  onClick={onSettings}
                  className="p-2.5 sm:p-3 bg-white border-2 border-black hover:bg-pink-100 rounded-xl transition shadow-sm"
                  title="Settings"
                >
                  <Icon name="settings" size={22} className="text-gray-800" />
                </button>
              )}
              {onSignOut && (
                <button
                  type="button"
                  onClick={onSignOut}
                  className="p-2.5 sm:p-3 bg-white border-2 border-black hover:bg-pink-100 rounded-xl transition shadow-sm"
                  title="Sign Out"
                >
                  <Icon name="log-out" size={22} className="text-gray-800" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  )
}
