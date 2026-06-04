import { useState } from 'react'
import { startCheckout } from '@/lib/premiumService'

// Upgrade prompts
const UPGRADE_MESSAGES = [
  '⚓  Savvy traveler! Upgrade to Solo — smooth seas & no ads.',
  '🗺️  X marks the spot — unlimited links on all yer mobile devices. Solo · $2.99 / mo.',
  '💰  A chest with limits? Break free with LnkLokr Pro — PC, Mac & Chrome extension included.',
  '🏴‍☠️  Free spirits sail the Free tier. Ambitious pirates choose Solo or Pro.',
  '⚡  One-click saves from any page on the web — Chrome extension included with Pro.',
  '🌊  Free tier holds 30 treasures in the cloud. Solo & Pro hold them all — forever.',
  '🔐  Keep · Borrow · Share · Bury — the full workflow, every tier.',
  '🪙  Solo · $2.99 / mo or $24.99 / yr · All mobile devices · 2 GB cloud · No ads.',
  '🏆  Pro · $5.99 / mo · Every device · Chrome extension · 10 GB cloud · No ads.',
]

// Cross-app discovery — other Skyland Reach treasures
interface DiscoveryMessage {
  text: string
  url?: string
}

const DISCOVERY_MESSAGES: DiscoveryMessage[] = [
  {
    text: '🪄  ✦ DISCOVERED TREASURE ✦  FRIDAY Canvas — your AI-powered creative workspace. One Skyland Reach account.',
  },
  {
    text: '🛒  ✦ DISCOVERED TREASURE ✦  Go Shop — smarter shopping lists & deal tracking. Visit my-go-shop.com',
    url: 'https://my-go-shop.com',
  },
  {
    text: '✈️  ✦ DISCOVERED TREASURE ✦  GoTRVL — plan your voyages across the seven seas. Coming soon from Skyland Reach.',
  },
  {
    text: '🕵️  ✦ DISCOVERED TREASURE ✦  Secret Agent — keep your most guarded notes under lock and key. Skyland Reach.',
  },
  {
    text: '📰  ✦ DISCOVERED TREASURE ✦  GoNews — chart the news that matters to you. Visit go-news.app',
    url: 'https://go-news.app',
  },
]

interface TickerMessage {
  text: string
  url?: string
  isDiscovery?: boolean
}

// Interleave upgrades and discoveries so discoveries appear every ~3 messages
const MESSAGES: TickerMessage[] = []
UPGRADE_MESSAGES.forEach((text, i) => {
  MESSAGES.push({ text })
  if ((i + 1) % 3 === 0) {
    const d = DISCOVERY_MESSAGES[Math.floor(i / 3) % DISCOVERY_MESSAGES.length]
    MESSAGES.push({ text: d.text, url: d.url, isDiscovery: true })
  }
})

const SEPARATOR = '     ✦     '

interface TickerTapeAdProps {
  onUpgradeClick?: () => void
}

export function TickerTapeAd({ onUpgradeClick }: TickerTapeAdProps) {
  const [dismissed, setDismissed] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleUpgrade = async () => {
    if (onUpgradeClick) { onUpgradeClick(); return }
    setLoading(true)
    try {
      const url = await startCheckout('solo-monthly')
      if (url) window.location.href = url
    } finally {
      setLoading(false)
    }
  }

  if (dismissed) return null

  return (
    <>
      {/* Keyframe animation injected once */}
      <style>{`
        @keyframes lnklokr-ticker {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .lnklokr-ticker-track {
          display: inline-flex;
          white-space: nowrap;
          animation: lnklokr-ticker 55s linear infinite;
          will-change: transform;
        }
        .lnklokr-ticker-track:hover {
          animation-play-state: paused;
        }
      `}</style>

      {/* Plank wrapper */}
      <div
        className="fixed bottom-0 left-0 right-0 z-40 select-none"
        style={{
          background: 'linear-gradient(180deg, #5c2d0a 0%, #3b1a06 50%, #2a1204 100%)',
          borderTop: '3px solid #c8860a',
          boxShadow: '0 -2px 0 #7a4a10, 0 -4px 8px rgba(0,0,0,0.6)',
        }}
      >
        {/* Rope-notch top edge */}
        <div
          className="w-full"
          style={{
            height: 4,
            backgroundImage:
              'repeating-linear-gradient(90deg, #c8860a 0px, #c8860a 8px, #8b5e15 8px, #8b5e15 16px)',
            opacity: 0.7,
          }}
        />

        <div className="flex items-center gap-0">
          {/* Scrolling track */}
          <div className="flex-1 overflow-hidden py-2" style={{ minWidth: 0 }}>
            <div className="lnklokr-ticker-track">
              {/* duplicate the full message list so the loop is seamless */}
              {[0, 1].map(copyIdx => (
                <span key={copyIdx} style={{ paddingRight: '6rem' }}>
                  {MESSAGES.map((msg, msgIdx) => {
                    const textStyle: React.CSSProperties = {
                      fontFamily: '"Georgia", "Times New Roman", serif',
                      letterSpacing: '0.02em',
                      textShadow: '0 1px 3px rgba(0,0,0,0.9)',
                      color: msg.isDiscovery ? '#fde68a' : '#f5d98a',
                      fontWeight: msg.isDiscovery ? 700 : 500,
                      background: msg.isDiscovery
                        ? 'linear-gradient(90deg, transparent, rgba(255,200,50,0.12), transparent)'
                        : 'none',
                      padding: msg.isDiscovery ? '1px 6px' : '0',
                      borderRadius: msg.isDiscovery ? '3px' : '0',
                      cursor: msg.url ? 'pointer' : 'default',
                      textDecoration: msg.url ? 'underline dotted #c8860a' : 'none',
                    }

                    const inner = (
                      <span className="text-sm" style={textStyle}>
                        {msg.text}
                        {msg.url && (
                          <span style={{ fontSize: '0.65rem', marginLeft: 4, opacity: 0.75 }}>↗</span>
                        )}
                      </span>
                    )

                    return (
                      <span key={`${copyIdx}-${msgIdx}`}>
                        {msg.url ? (
                          <a
                            href={msg.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ textDecoration: 'none' }}
                            onClick={e => e.stopPropagation()}
                          >
                            {inner}
                          </a>
                        ) : inner}
                        <span style={{ color: '#c8860a', padding: '0 0.5rem' }}>{SEPARATOR}</span>
                      </span>
                    )
                  })}
                </span>
              ))}
            </div>
          </div>

          {/* Right-side actions */}
          <div className="flex items-center gap-1 px-2 flex-shrink-0">
            <button
              onClick={handleUpgrade}
              disabled={loading}
              className="text-xs font-bold px-3 py-1.5 rounded transition disabled:opacity-60"
              style={{
                background: 'linear-gradient(135deg, #c8860a 0%, #e6a012 100%)',
                color: '#1a0900',
                fontFamily: '"Georgia", serif',
                border: '1px solid #7a4a10',
                boxShadow: '0 1px 3px rgba(0,0,0,0.5)',
                whiteSpace: 'nowrap',
              }}
            >
              {loading ? '…' : 'Go Ad‑Free →'}
            </button>

            <button
              onClick={() => setDismissed(true)}
              title="Dismiss until next visit"
              className="flex items-center justify-center w-6 h-6 rounded transition opacity-50 hover:opacity-90"
              style={{ color: '#f5d98a' }}
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M1 1L9 9M9 1L1 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
