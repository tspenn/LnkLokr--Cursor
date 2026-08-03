import { useState, useEffect } from 'react'
import { AuthModal } from './AuthModal'
import { TIERS, FREE_TIER } from '@/lib/premiumService'

export function LandingPage() {
  const [modal, setModal] = useState<'signin' | 'signup' | null>(null)
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null)
  const [checkoutError, setCheckoutError] = useState<string | null>(null)
  const [checkoutSuccess, setCheckoutSuccess] = useState(false)

  // If returning from Stripe checkout, prompt unauthenticated users to create / sign in
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('checkout') === 'success') {
      setCheckoutSuccess(true)
      setModal('signup')
    }
  }, [])

  const handleCheckout = async (tierId: 'solo-monthly' | 'pro-monthly') => {
    setCheckoutLoading(tierId)
    setCheckoutError(null)
    try {
      const res = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier: tierId }),
      })
      const data = await res.json() as { url?: string; error?: string }
      if (!res.ok || data.error) {
        setCheckoutError(data.error ?? 'Checkout failed. Please try again.')
        return
      }
      if (data.url) window.location.href = data.url
    } catch {
      setCheckoutError('Unable to connect. Please check your internet connection.')
    } finally {
      setCheckoutLoading(null)
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-pink-50 via-purple-50 to-orange-50">

      {/* ── Post-checkout success banner ────────────────────────── */}
      {checkoutSuccess && (
        <div className="bg-green-500 text-white text-center text-sm font-semibold py-3 px-4">
          🎉 Payment successful! Create your account below to access your subscription.
        </div>
      )}

      {/* ── Header — same banner as the app ─────────────────────── */}
      <header className="border-b-4 border-black shadow-md shrink-0">
        <div className="w-full min-h-[120px] flex items-center justify-center bg-gradient-to-r from-pink-200 via-purple-200 to-orange-200 px-4 py-4 relative">
          <img
            src="/header_lnklokr.png"
            alt="LnkLokr"
            className="h-24 w-auto max-w-[min(100%,480px)] object-contain"
          />
          {/* Subtle sign-in link top-right */}
          <button
            onClick={() => setModal('signin')}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-gray-600 hover:text-pink-600 transition bg-white/70 hover:bg-white px-3 py-1.5 rounded-full border border-gray-300 shadow-sm"
          >
            Sign in
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-lg mx-auto w-full border-x-4 border-black">

        {/* ── Hero ───────────────────────────────────────────────── */}
        <section className="px-6 pt-10 pb-8 text-center border-b-4 border-black">
          <p className="text-sm font-medium text-gray-500 tracking-widest uppercase mb-3">
            Save the web your way
          </p>
          <h1 className="text-3xl font-bold leading-snug mb-3 text-gray-900">
            Save links<br />
            <span className="text-pink-500 font-extrabold">with images</span><br />
            on your phone.
          </h1>
          <p className="text-sm text-gray-500 mb-8">
            Keep · Borrow · Share · Bury · Dream Keeper — the full workflow, free forever.
          </p>

          <div className="flex flex-col gap-3">
            <button
              onClick={() => setModal('signup')}
              className="w-full py-3.5 px-6 rounded-full bg-gradient-to-r from-pink-400 to-orange-300 hover:from-pink-500 hover:to-orange-400 text-white font-semibold text-base transition shadow-md hover:shadow-lg border-2 border-pink-400"
            >
              Try it free — no card needed
            </button>
            <button
              onClick={() => setModal('signin')}
              className="w-full py-3 px-6 rounded-full bg-white hover:bg-gray-50 text-gray-700 font-medium text-sm transition border-2 border-gray-300 shadow-sm"
            >
              Already have an account? Sign in →
            </button>
          </div>
        </section>

        {/* ── Workflow preview ────────────────────────────────────── */}
        <section className="border-b-4 border-black px-5 py-7 bg-white/60">
          <p className="text-xs font-semibold text-gray-400 tracking-widest uppercase text-center mb-5">
            The full workflow — all tiers
          </p>

          <div className="space-y-2.5">
            {[
              { bg: 'bg-yellow-100', border: 'border-yellow-300', icon: '/icons/treasure_chest_transparent.png', img: true, label: 'Keep', desc: 'Save links + images forever' },
              { bg: 'bg-purple-100', border: 'border-purple-300', icon: '/icons/basket.png', img: true, label: 'Borrow', desc: 'Not sure yet? Park it here' },
              { bg: 'bg-pink-100', border: 'border-pink-300', icon: null, emoji: '📤', label: 'Share', desc: 'Stage and send to anyone' },
              { bg: 'bg-cyan-100', border: 'border-cyan-300', icon: '/icons/combination_lock.png', img: true, label: 'Bury', desc: 'Private vault, password-protected' },
              { bg: 'bg-amber-100', border: 'border-amber-300', icon: null, emoji: '📋', label: 'Dream Keeper', desc: 'Build a vision-board collage of your dream' },
            ].map(({ bg, border, icon, img, emoji, label, desc }) => (
              <div key={label} className={`${bg} border-2 ${border} rounded-xl px-4 py-3.5 flex items-center gap-4`}>
                {img && icon
                  ? <img src={icon} alt={label} className="w-8 h-8 object-contain flex-shrink-0" />
                  : <span className="text-2xl flex-shrink-0">{emoji}</span>
                }
                <div>
                  <p className="font-bold text-gray-900">{label}</p>
                  <p className="text-xs text-gray-500">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Why LnkLokr ─────────────────────────────────────────── */}
        <section className="border-b-4 border-black px-5 py-7 bg-amber-50/60">
          <p className="text-xs font-semibold text-gray-400 tracking-widest uppercase text-center mb-5">
            Why LnkLokr
          </p>
          <div className="space-y-3">
            {[
              { emoji: '🖼️', label: 'Links + images', body: 'Other apps save the URL. LnkLokr saves the image too — so you remember what it was.' },
              { emoji: '📱', label: 'Built for mobile', body: 'Installs as a PWA on iPhone, iPad, or Android. No app store needed.' },
              { emoji: '🔒', label: 'Truly private', body: 'Bury items behind a password. Your data is never sold.' },
              { emoji: '📋', label: 'Dream Keeper', body: 'Collage images and notes into a vision board — arrange, edit, and export your dream.' },
              { emoji: '🧩', label: 'Chrome extension', body: 'Pro includes LnkLokr Saver — right-click to save links and images from any page.' },
            ].map(({ emoji, label, body }) => (
              <div key={label} className="flex gap-3 items-start p-3 bg-white/80 rounded-xl border border-gray-200">
                <span className="text-2xl flex-shrink-0 mt-0.5">{emoji}</span>
                <div>
                  <p className="font-semibold text-gray-900 text-sm">{label}</p>
                  <p className="text-xs text-gray-500 leading-relaxed mt-0.5">{body}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Pricing ─────────────────────────────────────────────── */}
        <section className="border-b-4 border-black px-5 py-7" id="pricing">
          <p className="text-xs font-semibold text-gray-400 tracking-widest uppercase text-center mb-1">
            Pricing
          </p>
          <p className="text-center text-sm text-gray-500 mb-6">Start free. Upgrade when you're ready.</p>

          {checkoutError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 text-center">
              {checkoutError}
            </div>
          )}

          <div className="space-y-4">

            {/* Free */}
            <div className="border-2 border-gray-200 rounded-2xl p-5 bg-white">
              <div className="flex items-center justify-between mb-3">
                <p className="text-lg font-bold text-gray-900">Free</p>
                <p className="text-xl font-bold text-gray-700">$0</p>
              </div>
              <ul className="space-y-1.5 text-xs text-gray-600 mb-4">
                {FREE_TIER.features.map(f => (
                  <li key={f} className="flex gap-2"><span className="text-green-500">✓</span>{f}</li>
                ))}
              </ul>
              <button
                onClick={() => setModal('signup')}
                className="w-full py-2.5 rounded-full border-2 border-gray-300 bg-white hover:bg-gray-50 text-gray-700 font-medium text-sm transition"
              >
                Get started free
              </button>
            </div>

            {/* Solo */}
            <div className="border-2 border-pink-300 rounded-2xl p-5 bg-pink-50 relative">
              <div className="absolute -top-2.5 left-5 bg-pink-400 text-white text-xs font-semibold px-3 py-0.5 rounded-full">
                Most popular
              </div>
              <div className="flex items-center justify-between mb-1">
                <p className="text-lg font-bold text-gray-900">Solo</p>
                <p className="text-xl font-bold text-gray-700">$2.99<span className="text-xs font-normal text-gray-500"> / mo</span></p>
              </div>
              <p className="text-xs text-amber-600 font-medium mb-3">or $24.99 / yr — save $11</p>
              <ul className="space-y-1.5 text-xs text-gray-600 mb-4">
                {TIERS['solo-monthly'].features.map(f => (
                  <li key={f} className="flex gap-2"><span className="text-pink-400">✓</span>{f}</li>
                ))}
              </ul>
              <button
                onClick={() => handleCheckout('solo-monthly')}
                disabled={checkoutLoading !== null}
                className="w-full py-2.5 rounded-full bg-gradient-to-r from-pink-400 to-orange-300 hover:from-pink-500 hover:to-orange-400 disabled:opacity-60 text-white font-semibold text-sm transition shadow-sm border-2 border-pink-400"
              >
                {checkoutLoading === 'solo-monthly' ? 'Starting…' : 'Subscribe · $2.99 / mo'}
              </button>
            </div>

            {/* Pro */}
            <div className="border-2 border-indigo-200 rounded-2xl p-5 bg-indigo-50">
              <div className="flex items-center justify-between mb-1">
                <p className="text-lg font-bold text-gray-900">Pro</p>
                <p className="text-xl font-bold text-gray-700">$5.99<span className="text-xs font-normal text-gray-500"> / mo</span></p>
              </div>
              <p className="text-xs text-amber-600 font-medium mb-3">or $49.99 / yr — save $22</p>
              <ul className="space-y-1.5 text-xs text-gray-600 mb-4">
                {TIERS['pro-monthly'].features.map(f => (
                  <li key={f} className="flex gap-2"><span className="text-indigo-400">✓</span>{f}</li>
                ))}
              </ul>
              <button
                onClick={() => handleCheckout('pro-monthly')}
                disabled={checkoutLoading !== null}
                className="w-full py-2.5 rounded-full bg-gradient-to-r from-indigo-400 to-purple-400 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-60 text-white font-semibold text-sm transition shadow-sm border-2 border-indigo-400"
              >
                {checkoutLoading === 'pro-monthly' ? 'Starting…' : 'Subscribe · $5.99 / mo'}
              </button>
            </div>
          </div>
        </section>

        {/* ── Gentle final CTA ────────────────────────────────────── */}
        <section className="px-6 py-12 text-center border-b-4 border-black bg-gradient-to-b from-pink-50 to-purple-50">
          <img
            src="/icons/treasure_chest_transparent.png"
            alt="Treasure Chest"
            className="w-20 h-20 object-contain mx-auto mb-4 drop-shadow-md opacity-90"
          />
          <p className="text-xl font-semibold text-gray-800 mb-1">Your treasure chest awaits.</p>
          <p className="text-sm text-gray-500 mb-6">Free forever. No credit card needed.</p>
          <button
            onClick={() => setModal('signup')}
            className="px-8 py-3 rounded-full bg-gradient-to-r from-pink-400 to-orange-300 hover:from-pink-500 hover:to-orange-400 text-white font-semibold text-sm transition shadow-md border-2 border-pink-400"
          >
            Open your LnkLokr →
          </button>
        </section>
      </main>

      {/* ── Footer ──────────────────────────────────────────────── */}
      <footer className="border-t-4 border-black px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-400 bg-white max-w-lg mx-auto w-full border-x-4">
        <span className="font-medium text-gray-500">LnkLokr · A Skyland Reach app</span>
        <span className="text-center">Cancel at any time · Your data is yours · Never sold</span>
        <div className="flex gap-4">
          <button onClick={() => setModal('signin')} className="hover:text-pink-500 underline">Sign in</button>
          <button onClick={() => setModal('signup')} className="hover:text-pink-500 underline">Sign up</button>
          <a href="#pricing" className="hover:text-pink-500 underline">Pricing</a>
        </div>
      </footer>

      {modal && <AuthModal initialMode={modal} onClose={() => setModal(null)} />}
    </div>
  )
}
