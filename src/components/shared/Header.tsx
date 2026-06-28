import { Icon } from './Icon'

/** Wide banner in public/ — file: public/header_lnklokr.png */
const HEADER_BANNER_SRC = '/header_lnklokr.png'

interface HeaderProps {
  email?: string
  isPremium?: boolean
  onSettings?: () => void
  onSignOut?: () => void
  onUpgrade?: () => void
  onBack?: () => void
}

export function Header({
  email,
  isPremium,
  onSettings,
  onSignOut,
  onUpgrade,
  onBack,
}: HeaderProps) {
  const showToolbar = Boolean(email)

  return (
    <header className="border-b-4 border-black shadow-md shrink-0">
      <div className="w-full min-h-[120px] sm:min-h-[160px] flex items-center justify-center bg-gradient-to-r from-pink-200 via-purple-200 to-orange-200 px-4 py-4 sm:py-6">
        <img
          src={HEADER_BANNER_SRC}
          alt="Lnk Lokr"
          className="h-24 sm:h-32 md:h-36 w-auto max-w-[min(100%,720px)] object-contain"
        />
      </div>

      {showToolbar && (
        <div className="border-t-2 border-black/15 bg-gradient-to-r from-pink-50 via-purple-50 to-orange-50">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              {onBack && (
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
              )}
              <p className="text-sm sm:text-base font-medium text-gray-800 truncate max-w-[min(100%,200px)]">
                {email}
              </p>
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
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
