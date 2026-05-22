import { Icon } from './Icon'

/** Wide banner in public/ — file: public/header_lnklokr.png */
const HEADER_BANNER_SRC = '/header_lnklokr.png'

interface HeaderProps {
  email?: string
  isPremium?: boolean
  inboxCount?: number
  onInbox?: () => void
  onSettings?: () => void
  onSignOut?: () => void
  onUpgrade?: () => void
}

export function Header({
  email,
  isPremium,
  inboxCount = 0,
  onInbox,
  onSettings,
  onSignOut,
  onUpgrade,
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
            <p className="text-sm sm:text-base font-medium text-gray-800 truncate max-w-[min(100%,280px)]">
              {email}
            </p>
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
              {onInbox && (
                <button
                  type="button"
                  onClick={onInbox}
                  className="relative p-2.5 sm:p-3 bg-white border-2 border-black hover:bg-indigo-100 rounded-xl transition shadow-sm"
                  title="Inbox"
                >
                  <Icon name="mail" size={22} className="text-gray-800" />
                  {inboxCount > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">
                      {inboxCount > 9 ? '9+' : inboxCount}
                    </span>
                  )}
                </button>
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
