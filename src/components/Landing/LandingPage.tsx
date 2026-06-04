import { useState } from 'react'
import { AuthModal } from './AuthModal'
import { TIERS, FREE_TIER, startCheckout } from '@/lib/premiumService'

export function LandingPage() {
  const [modal, setModal] = useState<'signin' | 'signup' | null>(null)
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null)

  const handleCheckout = async (tierId: 'solo-monthly' | 'pro-monthly') => {
    setCheckoutLoading(tierId)
    try {
      const url = await startCheckout(tierId)
      if (url) window.location.href = url
    } finally {
      setCheckoutLoading(null)
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-white via-pink-50 to-pink-100">

      {/* ── Header ─────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 bg-white border-b-4 border-black flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          <img src="/icons/treasure_chest_transparent.png" alt="LnkLokr" className="w-10 h-10 object-contain" />
          <span className="text-2xl font-black tracking-tight italic">LnkLokr</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setModal('signin')}
            className="text-sm font-bold px-4 py-2 border-4 border-black bg-white hover:bg-gray-100 transition"
          >
            Sign In
          </button>
          <button
            onClick={() => setModal('signup')}
            className="text-sm font-bold px-4 py-2 border-4 border-black bg-yellow-200 hover:bg-yellow-300 transition"
            style={{ fontStyle: 'italic' }}
          >
            Try Free →
          </button>
        </div>
      </header>

      <main className="flex-1 border-x-4 border-black max-w-lg mx-auto w-full">

        {/* ── Hero ───────────────────────────────────────────────── */}
        <section className="px-6 pt-10 pb-6 text-center border-b-4 border-black bg-gradient-to-b from-white via-pink-50 to-pink-100">
          <h1 className="text-4xl font-black leading-tight mb-3 italic">
            Save links<br />
            <span className="text-pink-500">WITH&nbsp;IMAGES</span><br />
            on your phone.
          </h1>
          <p className="text-base text-gray-700 mb-6 font-medium">
            Keep · Borrow · Share · Bury<br />
            <span className="text-sm text-gray-500">Your secret sauce for saving the web.</span>
          </p>
          <div className="flex flex-col gap-3">
            <button
              onClick={() => setModal('signup')}
              className="w-full bg-yellow-200 border-4 border-black p-4 text-2xl font-black italic hover:bg-yellow-300 transition shadow-lg"
            >
              Open your LnkLokr — Free →
            </button>
            <button
              onClick={() => setModal('signin')}
              className="w-full bg-white border-4 border-black p-3 text-lg font-bold hover:bg-gray-50 transition"
            >
              Already have an account? Sign In
            </button>
          </div>
        </section>

        {/* ── Workflow buttons (mirrors the dashboard) ────────────── */}
        <section className="border-b-4 border-black">
          <p className="text-center text-xs font-bold uppercase tracking-widest text-gray-500 pt-5 pb-3 px-4">
            The full workflow — all tiers
          </p>

          <div className="px-4 pb-6 space-y-3">
            <div className="w-full bg-yellow-100 border-4 border-black p-5 flex items-center gap-4">
              <img src="/icons/treasure_chest_transparent.png" alt="Keep" className="w-10 h-10 object-contain" />
              <div className="text-left">
                <p className="text-2xl font-black italic">Keep</p>
                <p className="text-sm text-gray-600">Save links + images forever</p>
              </div>
            </div>

            <div className="w-full bg-purple-200 border-4 border-black p-5 flex items-center gap-4">
              <img src="/icons/basket.png" alt="Borrow" className="w-10 h-10 object-contain" />
              <div className="text-left">
                <p className="text-2xl font-black italic">Borrow</p>
                <p className="text-sm text-gray-600">Not sure yet? Park it here</p>
              </div>
            </div>

            <div className="w-full bg-pink-300 border-4 border-black p-5 flex items-center gap-4">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
                <rect x="7" y="11" width="10" height="9" rx="1" stroke="#000" strokeWidth="2"/>
                <path d="M8 11V8C8 5.79086 9.79086 4 12 4C14.2091 4 16 5.79086 16 8V9" stroke="#000" strokeWidth="2"/>
              </svg>
              <div className="text-left">
                <p className="text-2xl font-black italic">Share</p>
                <p className="text-sm text-gray-600">Stage and send to anyone</p>
              </div>
            </div>

            <div className="w-full bg-cyan-200 border-4 border-black p-5 flex items-center gap-4">
              <img src="/icons/combination_lock.png" alt="Bury" className="w-10 h-10 object-contain" />
              <div className="text-left">
                <p className="text-2xl font-black italic">Bury</p>
                <p className="text-sm text-gray-600">Private vault, password-protected</p>
              </div>
            </div>
          </div>
        </section>

        {/* ── Why LnkLokr ────────────────────────────────────────── */}
        <section className="border-b-4 border-black px-4 py-6 bg-amber-50">
          <p className="text-center font-black text-xl italic mb-4">No one else does this.</p>
          <div className="space-y-3">
            {[
              { bg: 'bg-white', label: '🖼️  Links + Images', body: 'Pocket saves text. LnkLokr saves the image too — so you remember what it was.' },
              { bg: 'bg-white', label: '📱  Built for mobile', body: 'Installs as a PWA on iPhone, iPad, or Android. No app store needed.' },
              { bg: 'bg-white', label: '🔒  Truly private', body: 'Bury items behind a password. Your data is never sold.' },
              { bg: 'bg-white', label: '🧩  Chrome extension (Pro)', body: 'Save from any webpage in one click. Desktop + mobile, everything in sync.' },
            ].map(({ bg, label, body }) => (
              <div key={label} className={`${bg} border-4 border-black p-4`}>
                <p className="font-bold text-gray-900 mb-1">{label}</p>
                <p className="text-sm text-gray-600">{body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Pricing ────────────────────────────────────────────── */}
        <section className="border-b-4 border-black px-4 py-6" id="pricing">
          <p className="text-center font-black text-xl italic mb-1">Simple pricing</p>
          <p className="text-center text-sm text-gray-500 mb-5">Start free. Upgrade when you're ready.</p>

          <div className="space-y-4">

            {/* Free */}
            <div className="border-4 border-black p-5 bg-white">
              <div className="flex items-center justify-between mb-3">
                <p className="text-2xl font-black italic">Free</p>
                <p className="text-2xl font-black">$0</p>
              </div>
              <ul className="space-y-1.5 text-sm text-gray-700 mb-4">
                {FREE_TIER.features.map(f => (
                  <li key={f} className="flex gap-2"><span className="text-green-600 font-bold">✓</span>{f}</li>
                ))}
              </ul>
              <button
                onClick={() => setModal('signup')}
                className="w-full border-4 border-black py-3 font-bold text-lg bg-white hover:bg-gray-50 transition"
              >
                Get started free
              </button>
            </div>

            {/* Solo */}
            <div className="border-4 border-pink-500 p-5 bg-pink-50 relative">
              <div className="absolute -top-3 left-4 bg-pink-500 text-white text-xs font-black px-3 py-0.5 border-2 border-black">
                MOST POPULAR
              </div>
              <div className="flex items-center justify-between mb-1">
                <p className="text-2xl font-black italic">Solo</p>
                <p className="text-2xl font-black">$2.99<span className="text-sm font-normal"> / mo</span></p>
              </div>
              <p className="text-xs text-amber-600 font-bold mb-3">or $24.99 / yr — save $11</p>
              <ul className="space-y-1.5 text-sm text-gray-700 mb-4">
                {TIERS['solo-monthly'].features.map(f => (
                  <li key={f} className="flex gap-2"><span className="text-pink-500 font-bold">✓</span>{f}</li>
                ))}
              </ul>
              <button
                onClick={() => handleCheckout('solo-monthly')}
                disabled={checkoutLoading !== null}
                className="w-full border-4 border-black py-3 font-black text-lg bg-pink-300 hover:bg-pink-400 disabled:opacity-60 transition italic"
              >
                {checkoutLoading === 'solo-monthly' ? 'Starting…' : 'Subscribe — $2.99 / mo →'}
              </button>
            </div>

            {/* Pro */}
            <div className="border-4 border-indigo-500 p-5 bg-indigo-50">
              <div className="flex items-center justify-between mb-1">
                <p className="text-2xl font-black italic">Pro</p>
                <p className="text-2xl font-black">$5.99<span className="text-sm font-normal"> / mo</span></p>
              </div>
              <p className="text-xs text-amber-600 font-bold mb-3">or $49.99 / yr — save $22</p>
              <ul className="space-y-1.5 text-sm text-gray-700 mb-4">
                {TIERS['pro-monthly'].features.map(f => (
                  <li key={f} className="flex gap-2"><span className="text-indigo-500 font-bold">✓</span>{f}</li>
                ))}
              </ul>
              <button
                onClick={() => handleCheckout('pro-monthly')}
                disabled={checkoutLoading !== null}
                className="w-full border-4 border-black py-3 font-black text-lg bg-cyan-200 hover:bg-cyan-300 disabled:opacity-60 transition italic"
              >
                {checkoutLoading === 'pro-monthly' ? 'Starting…' : 'Subscribe — $5.99 / mo →'}
              </button>
            </div>
          </div>
        </section>

        {/* ── Final CTA ──────────────────────────────────────────── */}
        <section className="border-b-4 border-black px-4 py-10 text-center bg-yellow-100">
          <img
            src="/icons/treasure_chest_transparent.png"
            alt="Treasure Chest"
            className="w-28 h-28 object-contain mx-auto mb-4 drop-shadow-xl"
          />
          <p className="text-3xl font-black italic mb-2">Your treasure chest awaits.</p>
          <p className="text-sm text-gray-600 mb-6">Free forever. No credit card needed.</p>
          <button
            onClick={() => setModal('signup')}
            className="w-full bg-yellow-200 border-4 border-black p-4 text-2xl font-black italic hover:bg-yellow-300 transition shadow-lg"
          >
            Open your LnkLokr →
          </button>
        </section>
      </main>

      {/* ── Footer ─────────────────────────────────────────────── */}
      <footer className="border-t-4 border-black px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-500 bg-white max-w-lg mx-auto w-full border-x-4">
        <div className="flex items-center gap-2 font-bold text-gray-700">
          <img src="/icons/treasure_chest_transparent.png" alt="" className="w-5 h-5 object-contain" />
          LnkLokr · A Skyland Reach app
        </div>
        <p className="text-gray-400 text-center">Cancel at any time · Your data is yours · Never sold</p>
        <div className="flex gap-4">
          <button onClick={() => setModal('signin')} className="hover:text-pink-600 underline">Sign In</button>
          <button onClick={() => setModal('signup')} className="hover:text-pink-600 underline">Sign Up</button>
          <a href="#pricing" className="hover:text-pink-600 underline">Pricing</a>
        </div>
      </footer>

      {modal && (
        <AuthModal initialMode={modal} onClose={() => setModal(null)} />
      )}
    </div>
  )
}
