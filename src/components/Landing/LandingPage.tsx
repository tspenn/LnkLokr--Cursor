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
    <div className="min-h-screen flex flex-col bg-white">
      {/* ── Header ─────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 bg-white border-b-4 border-black flex items-center justify-between px-6 py-3">
        <div className="flex items-center gap-3">
          <img src="/icons/treasure_chest_transparent.png" alt="LnkLokr" className="w-9 h-9 object-contain" />
          <span className="text-xl font-black tracking-tight" style={{ fontStyle: 'italic' }}>LnkLokr</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setModal('signin')}
            className="text-sm font-semibold text-gray-700 hover:text-pink-600 transition underline underline-offset-2"
          >
            Sign In
          </button>
          <button
            onClick={() => setModal('signup')}
            className="text-sm font-bold px-4 py-2 bg-gradient-to-r from-pink-500 to-orange-400 hover:from-pink-600 hover:to-orange-500 text-white rounded-lg transition shadow-sm"
          >
            Get started free
          </button>
        </div>
      </header>

      <main className="flex-1">

        {/* ── Hero ───────────────────────────────────────────────── */}
        <section className="bg-gradient-to-b from-pink-50 via-amber-50 to-white border-b-4 border-black px-6 py-16 text-center">
          <div className="max-w-lg mx-auto">
            <img
              src="/icons/treasure_chest_transparent.png"
              alt="LnkLokr treasure chest"
              className="w-32 h-32 object-contain mx-auto mb-6 drop-shadow-xl"
            />
            <h1 className="text-4xl sm:text-5xl font-black leading-tight mb-4" style={{ fontStyle: 'italic' }}>
              Save links<br />
              <span className="text-pink-500">WITH&nbsp;IMAGES</span><br />
              on your phone.
            </h1>
            <p className="text-lg text-gray-600 mb-8">
              The full <strong>Keep · Borrow · Share · Bury</strong> workflow —<br className="hidden sm:block" />
              your secret sauce for saving the web.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={() => setModal('signup')}
                className="px-8 py-4 bg-gradient-to-r from-pink-500 to-orange-400 hover:from-pink-600 hover:to-orange-500 text-white font-black text-lg rounded-xl transition shadow-lg hover:shadow-xl border-4 border-black"
                style={{ fontStyle: 'italic' }}
              >
                Try it free →
              </button>
              <button
                onClick={() => setModal('signin')}
                className="px-8 py-4 bg-white hover:bg-gray-50 text-gray-900 font-bold text-lg rounded-xl transition border-4 border-black"
              >
                Sign In
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-4">Free forever · No credit card needed</p>
          </div>
        </section>

        {/* ── How it works ───────────────────────────────────────── */}
        <section className="px-6 py-16 max-w-2xl mx-auto">
          <h2 className="text-3xl font-black text-center mb-2" style={{ fontStyle: 'italic' }}>The Workflow</h2>
          <p className="text-center text-gray-500 mb-10 text-sm">Four actions. Total control of your saved web.</p>

          <div className="grid grid-cols-2 gap-4">
            {[
              { bg: 'bg-yellow-100', border: 'border-yellow-400', icon: '/icons/treasure_chest_transparent.png', img: true, label: 'Keep', desc: 'Save forever. Links, images, files — all in one place.' },
              { bg: 'bg-purple-100', border: 'border-purple-400', icon: '/icons/basket.png', img: true, label: 'Borrow', desc: 'Not sure yet? Park it here. Decide later.' },
              { bg: 'bg-pink-100', border: 'border-pink-400', icon: null, emoji: '📤', label: 'Share', desc: 'Stage links to send. Share to text, email or social.' },
              { bg: 'bg-cyan-100', border: 'border-cyan-400', icon: '/icons/combination_lock.png', img: true, label: 'Bury', desc: 'Private vault. Password-protected, hidden from view.' },
            ].map(({ bg, border, icon, img, emoji, label, desc }) => (
              <div key={label} className={`${bg} border-4 ${border} border-opacity-60 rounded-2xl p-5 flex flex-col gap-2`}>
                {img && icon
                  ? <img src={icon} alt={label} className="w-10 h-10 object-contain" />
                  : <span className="text-3xl">{emoji}</span>
                }
                <p className="font-black text-lg" style={{ fontStyle: 'italic' }}>{label}</p>
                <p className="text-xs text-gray-700 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Why LnkLokr ────────────────────────────────────────── */}
        <section className="bg-gradient-to-r from-amber-50 to-pink-50 border-y-4 border-black px-6 py-12">
          <div className="max-w-xl mx-auto text-center">
            <h2 className="text-2xl font-black mb-6" style={{ fontStyle: 'italic' }}>
              No one else does this.
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
              {[
                { icon: '🖼️', title: 'Links + Images', body: 'Pocket saves text. LnkLokr saves the image too — so you remember what it was.' },
                { icon: '📱', title: 'Built for mobile', body: 'PWA — installs on iPhone, iPad, or Android. No app store required.' },
                { icon: '🔒', title: 'Truly private', body: 'Bury items behind a password. No algorithm decides what you see.' },
              ].map(({ icon, title, body }) => (
                <div key={title} className="bg-white rounded-xl border-2 border-black p-4">
                  <div className="text-3xl mb-2">{icon}</div>
                  <p className="font-bold text-gray-900 mb-1">{title}</p>
                  <p className="text-gray-600 text-xs leading-relaxed">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Pricing ────────────────────────────────────────────── */}
        <section className="px-6 py-16 max-w-3xl mx-auto" id="pricing">
          <h2 className="text-3xl font-black text-center mb-2" style={{ fontStyle: 'italic' }}>Simple pricing</h2>
          <p className="text-center text-gray-500 mb-10 text-sm">Start free. Upgrade when you're ready.</p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">

            {/* Free */}
            <div className="border-4 border-black rounded-2xl p-6 flex flex-col">
              <p className="font-black text-xl mb-1" style={{ fontStyle: 'italic' }}>Free</p>
              <p className="text-3xl font-black mb-1">$0</p>
              <p className="text-xs text-gray-500 mb-5">forever</p>
              <ul className="space-y-2 text-sm flex-1 mb-6">
                {FREE_TIER.features.map(f => (
                  <li key={f} className="flex gap-2 items-start text-gray-700">
                    <span className="text-green-500 mt-0.5 flex-shrink-0">✓</span>{f}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => setModal('signup')}
                className="w-full py-2.5 border-4 border-black font-bold rounded-xl hover:bg-gray-50 transition text-sm"
              >
                Get started
              </button>
            </div>

            {/* Solo */}
            <div className="border-4 border-pink-400 rounded-2xl p-6 flex flex-col bg-pink-50 relative">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-pink-500 text-white text-xs font-bold px-3 py-1 rounded-full">
                Most popular
              </div>
              <p className="font-black text-xl mb-1" style={{ fontStyle: 'italic' }}>Solo</p>
              <p className="text-3xl font-black mb-0">$2.99</p>
              <p className="text-xs text-gray-500 mb-1">/ month</p>
              <p className="text-xs text-amber-600 font-medium mb-5">or $24.99 / yr — save $11</p>
              <ul className="space-y-2 text-sm flex-1 mb-6">
                {TIERS['solo-monthly'].features.map(f => (
                  <li key={f} className="flex gap-2 items-start text-gray-700">
                    <span className="text-pink-500 mt-0.5 flex-shrink-0">✓</span>{f}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => handleCheckout('solo-monthly')}
                disabled={checkoutLoading !== null}
                className="w-full py-2.5 bg-gradient-to-r from-pink-500 to-orange-400 hover:from-pink-600 hover:to-orange-500 disabled:opacity-60 text-white font-bold rounded-xl transition shadow-md text-sm border-2 border-pink-600"
              >
                {checkoutLoading === 'solo-monthly' ? 'Starting…' : 'Subscribe — $2.99 / mo'}
              </button>
            </div>

            {/* Pro */}
            <div className="border-4 border-indigo-400 rounded-2xl p-6 flex flex-col bg-indigo-50">
              <p className="font-black text-xl mb-1" style={{ fontStyle: 'italic' }}>Pro</p>
              <p className="text-3xl font-black mb-0">$5.99</p>
              <p className="text-xs text-gray-500 mb-1">/ month</p>
              <p className="text-xs text-amber-600 font-medium mb-5">or $49.99 / yr — save $22</p>
              <ul className="space-y-2 text-sm flex-1 mb-6">
                {TIERS['pro-monthly'].features.map(f => (
                  <li key={f} className="flex gap-2 items-start text-gray-700">
                    <span className="text-indigo-500 mt-0.5 flex-shrink-0">✓</span>{f}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => handleCheckout('pro-monthly')}
                disabled={checkoutLoading !== null}
                className="w-full py-2.5 bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 disabled:opacity-60 text-white font-bold rounded-xl transition shadow-md text-sm border-2 border-indigo-600"
              >
                {checkoutLoading === 'pro-monthly' ? 'Starting…' : 'Subscribe — $5.99 / mo'}
              </button>
            </div>
          </div>
        </section>

        {/* ── Final CTA ──────────────────────────────────────────── */}
        <section className="bg-gradient-to-r from-pink-500 to-orange-400 border-y-4 border-black px-6 py-14 text-center">
          <h2 className="text-3xl font-black text-white mb-3" style={{ fontStyle: 'italic' }}>
            Your treasure chest awaits.
          </h2>
          <p className="text-pink-100 mb-8 text-sm">Save links with images today. Free, forever.</p>
          <button
            onClick={() => setModal('signup')}
            className="px-10 py-4 bg-white hover:bg-gray-50 text-pink-600 font-black text-lg rounded-xl transition border-4 border-black shadow-lg"
            style={{ fontStyle: 'italic' }}
          >
            Open your LnkLokr →
          </button>
        </section>
      </main>

      {/* ── Footer ─────────────────────────────────────────────── */}
      <footer className="border-t-4 border-black px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-500 bg-white">
        <div className="flex items-center gap-2">
          <img src="/icons/treasure_chest_transparent.png" alt="LnkLokr" className="w-6 h-6 object-contain" />
          <span className="font-bold text-gray-700">LnkLokr</span>
          <span className="text-gray-300">|</span>
          <span>A Skyland Reach app</span>
        </div>
        <p className="text-gray-400 font-medium">
          Cancel at any time · Your data is yours · Never sold
        </p>
        <div className="flex gap-4">
          <button onClick={() => setModal('signin')} className="hover:text-pink-600 transition underline">Sign In</button>
          <button onClick={() => setModal('signup')} className="hover:text-pink-600 transition underline">Sign Up</button>
          <a href="#pricing" className="hover:text-pink-600 transition underline">Pricing</a>
        </div>
      </footer>

      {/* ── Auth Modal ─────────────────────────────────────────── */}
      {modal && (
        <AuthModal
          initialMode={modal}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  )
}
