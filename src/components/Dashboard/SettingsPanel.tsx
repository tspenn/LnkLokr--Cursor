import { useState, useEffect } from 'react'
import { TIERS, startCheckout, openBillingPortal, resolveTierKey, type TierId } from '@/lib/premiumService'
import { supabase } from '@/lib/supabase'
import { opfsStore } from '@/lib/opfsStore'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'
import { Icon } from '../shared/Icon'

interface SettingsPanelProps {
  onClose: () => void
  onExportClick: () => void
}

export function SettingsPanel({ onClose, onExportClick }: SettingsPanelProps) {
  const { user } = useAuth()
  const toast = useToast()
  const [isPremium, setIsPremium] = useState(false)
  const [stats, setStats] = useState({ total_links: 0, total_folders: 0, local_files: 0 })
  const [newBuryPassword, setNewBuryPassword] = useState('')
  const [confirmBuryPassword, setConfirmBuryPassword] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)
  const [hasBuryPassword, setHasBuryPassword] = useState(false)
  const [checkoutLoading, setCheckoutLoading] = useState<TierId | null>(null)
  const [portalLoading, setPortalLoading] = useState(false)
  const tierKey = resolveTierKey(isPremium, user?.subscription_tier)

  useEffect(() => {
    const loadStatus = async () => {
      setIsPremium(user?.is_premium ?? false)

      if (user) {
        const [linksRes, foldersRes, fileIds, buryRes] = await Promise.all([
          supabase.from('links').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
          supabase.from('folders').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
          opfsStore.isSupported() ? opfsStore.listFileIds(user.id) : Promise.resolve([]),
          supabase.from('users').select('bury_password').eq('id', user.id).maybeSingle(),
        ])
        setStats({
          total_links: linksRes.count ?? 0,
          total_folders: foldersRes.count ?? 0,
          local_files: fileIds.length,
        })
        if (buryRes.data?.bury_password) setHasBuryPassword(true)
      }
    }
    loadStatus()
  }, [user])

  const handleCheckout = async (tier: TierId) => {
    setCheckoutLoading(tier)
    try {
      const url = await startCheckout(tier, user?.email, user?.id)
      if (url) {
        window.location.href = url
      } else {
        alert('Could not start checkout. Please try again.')
      }
    } finally {
      setCheckoutLoading(null)
    }
  }

  const handleManageSubscription = async () => {
    if (!user?.email) return
    setPortalLoading(true)
    try {
      await openBillingPortal(user.email)
    } finally {
      setPortalLoading(false)
    }
  }

  const handleSaveBuryPassword = async () => {
    if (!user) return

    if (newBuryPassword !== confirmBuryPassword) {
      alert('Passwords do not match!')
      return
    }

    if (newBuryPassword.length < 4) {
      alert('Password must be at least 4 characters long')
      return
    }

    setSavingPassword(true)

    try {
      const { error } = await supabase
        .from('users')
        .update({ bury_password: newBuryPassword })
        .eq('id', user.id)

      if (error) throw error

      setHasBuryPassword(true)
      setNewBuryPassword('')
      setConfirmBuryPassword('')
      toast.success('Bury password saved')
    } catch (error) {
      toast.error('Failed to save password. Please try again.')
    } finally {
      setSavingPassword(false)
    }
  }

  const handleRemoveBuryPassword = async () => {
    if (!user) return
    if (!confirm('Remove Bury password protection? Your buried items will be accessible without a password.')) return

    try {
      const { error } = await supabase
        .from('users')
        .update({ bury_password: null })
        .eq('id', user.id)

      if (error) throw error

      setHasBuryPassword(false)
      setNewBuryPassword('')
      setConfirmBuryPassword('')
      toast.success('Bury password removed')
    } catch (error) {
      toast.error('Failed to remove password. Please try again.')
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="bg-white rounded-lg max-w-md w-full max-h-screen overflow-y-auto">
        <div className="sticky top-0 flex items-center justify-between p-6 border-b border-gray-200 bg-white">
          <h2 className="text-xl font-bold text-gray-900">Settings</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded transition"
          >
            <Icon name="x" size={24} className="text-gray-600" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <Icon name="database" size={16} />
              Your Collection
            </h3>
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div className="p-3 bg-blue-50 rounded-lg text-center">
                <p className="text-xl font-bold text-blue-700">{stats.total_links}</p>
                <p className="text-xs text-gray-600">Links</p>
              </div>
              <div className="p-3 bg-green-50 rounded-lg text-center">
                <p className="text-xl font-bold text-green-700">{stats.total_folders}</p>
                <p className="text-xs text-gray-600">Folders</p>
              </div>
              <div className="p-3 bg-indigo-50 rounded-lg text-center">
                <p className="text-xl font-bold text-indigo-700">{stats.local_files}</p>
                <p className="text-xs text-gray-600">Local files</p>
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-2 text-center">Links sync to cloud · Files stored on this device</p>
          </div>

          {/* ── Subscription / upgrade section ── */}
          {tierKey === 'free' ? (
            <div className="p-4 bg-gradient-to-br from-pink-50 to-orange-50 border-2 border-pink-200 rounded-lg space-y-3">
              <div className="flex items-center gap-2">
                <Icon name="crown" size={20} />
                <h3 className="font-semibold text-pink-900">Upgrade LnkLokr</h3>
              </div>

              {/* Solo */}
              <div className="bg-white border-2 border-pink-200 rounded-lg p-3">
                <div className="flex items-center justify-between mb-1">
                  <p className="font-bold text-gray-900">Solo</p>
                  <span className="text-xs bg-pink-100 text-pink-700 px-2 py-0.5 rounded-full font-medium">Mobile</span>
                </div>
                <p className="text-xs text-gray-600 mb-2">All mobile devices · 2 GB cloud · No ads</p>
                <div className="grid grid-cols-2 gap-2">
                  {(['solo-monthly', 'solo-yearly'] as const).map(id => {
                    const t = TIERS[id]
                    return (
                      <button key={id} onClick={() => handleCheckout(id)} disabled={checkoutLoading !== null}
                        className={`text-left p-2 border-2 rounded-lg transition disabled:opacity-60 ${id === 'solo-yearly' ? 'border-amber-300 bg-amber-50' : 'border-gray-200 bg-white hover:border-pink-400'}`}>
                        <p className="text-sm font-bold text-gray-900">{checkoutLoading === id ? 'Starting…' : t.priceLabel}</p>
                        {t.annualSavings && <p className="text-xs text-amber-600 font-medium">{t.annualSavings}</p>}
                        {t.yearlyEquivalent && <p className="text-xs text-gray-500">{t.yearlyEquivalent}</p>}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Pro */}
              <div className="bg-white border-2 border-indigo-200 rounded-lg p-3">
                <div className="flex items-center justify-between mb-1">
                  <p className="font-bold text-gray-900">Pro</p>
                  <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-medium">All devices + Extension</span>
                </div>
                <p className="text-xs text-gray-600 mb-2">PC · Mac · Chromebook · Chrome extension · 10 GB cloud</p>
                <div className="grid grid-cols-2 gap-2">
                  {(['pro-monthly', 'pro-yearly'] as const).map(id => {
                    const t = TIERS[id]
                    return (
                      <button key={id} onClick={() => handleCheckout(id)} disabled={checkoutLoading !== null}
                        className={`text-left p-2 border-2 rounded-lg transition disabled:opacity-60 ${id === 'pro-yearly' ? 'border-amber-300 bg-amber-50' : 'border-gray-200 bg-white hover:border-indigo-400'}`}>
                        <p className="text-sm font-bold text-gray-900">{checkoutLoading === id ? 'Starting…' : t.priceLabel}</p>
                        {t.annualSavings && <p className="text-xs text-amber-600 font-medium">{t.annualSavings}</p>}
                        {t.yearlyEquivalent && <p className="text-xs text-gray-500">{t.yearlyEquivalent}</p>}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="p-4 bg-gradient-to-br from-amber-50 to-yellow-50 border-2 border-amber-200 rounded-lg">
              <div className="flex items-center gap-2 mb-3">
                <Icon name="crown" size={20} />
                <h3 className="font-semibold text-amber-900">
                  LnkLokr {tierKey === 'pro' ? 'Pro' : 'Solo'} — Active
                </h3>
              </div>
              <p className="text-xs text-amber-800 mb-3">
                {tierKey === 'pro'
                  ? 'All devices · Chrome extension · 10 GB cloud storage'
                  : 'All mobile devices · 2 GB cloud storage · No ads'}
              </p>
              <div className="space-y-2">
                <button
                  onClick={handleManageSubscription}
                  disabled={portalLoading}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-white border-2 border-amber-300 hover:bg-amber-50 text-amber-900 rounded-lg text-sm font-medium transition disabled:opacity-50"
                >
                  <Icon name="settings" size={16} />
                  {portalLoading ? 'Opening…' : 'Manage / Change plan'}
                </button>
                <button
                  onClick={handleManageSubscription}
                  disabled={portalLoading}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-white border border-red-200 hover:bg-red-50 text-red-600 rounded-lg text-sm transition disabled:opacity-50"
                >
                  {portalLoading ? 'Opening…' : 'Cancel subscription'}
                </button>
                <p className="text-xs text-center text-gray-400">Both open the Stripe portal — cancel is inside.</p>
              </div>
            </div>
          )}

          <div className="p-4 bg-gradient-to-br from-cyan-50 to-blue-50 border-2 border-cyan-200 rounded-lg">
            <div className="flex items-center gap-2 mb-3">
              <Icon name="lock" size={20} className="w-5 h-5" />
              <h3 className="font-semibold text-cyan-900">Bury Password Protection</h3>
            </div>
            <p className="text-sm text-cyan-800 mb-4">
              {hasBuryPassword
                ? 'Password protection is active for your buried items.'
                : 'Set a password to protect your buried items.'}
            </p>

            {hasBuryPassword ? (
              <div className="space-y-3">
                <div className="p-3 bg-white rounded-lg">
                  <p className="text-sm text-gray-600 mb-2">Current password: ****</p>
                  <button
                    onClick={handleRemoveBuryPassword}
                    className="text-sm text-red-600 hover:text-red-700 font-medium"
                  >
                    Remove password protection
                  </button>
                </div>

                <div className="pt-3 border-t border-cyan-200">
                  <p className="text-sm font-medium text-cyan-900 mb-2">Change password:</p>
                  <div className="space-y-2">
                    <input
                      type="password"
                      value={newBuryPassword}
                      onChange={(e) => setNewBuryPassword(e.target.value)}
                      placeholder="New password"
                      className="w-full px-3 py-2 border border-cyan-300 rounded-lg text-sm focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                    />
                    <input
                      type="password"
                      value={confirmBuryPassword}
                      onChange={(e) => setConfirmBuryPassword(e.target.value)}
                      placeholder="Confirm new password"
                      className="w-full px-3 py-2 border border-cyan-300 rounded-lg text-sm focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                    />
                    <button
                      onClick={handleSaveBuryPassword}
                      disabled={savingPassword || !newBuryPassword || !confirmBuryPassword}
                      className="w-full px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {savingPassword ? 'Saving...' : 'Change Password'}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <input
                  type="password"
                  value={newBuryPassword}
                  onChange={(e) => setNewBuryPassword(e.target.value)}
                  placeholder="Create password"
                  className="w-full px-3 py-2 border border-cyan-300 rounded-lg text-sm focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                />
                <input
                  type="password"
                  value={confirmBuryPassword}
                  onChange={(e) => setConfirmBuryPassword(e.target.value)}
                  placeholder="Confirm password"
                  className="w-full px-3 py-2 border border-cyan-300 rounded-lg text-sm focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                />
                <button
                  onClick={handleSaveBuryPassword}
                  disabled={savingPassword || !newBuryPassword || !confirmBuryPassword}
                  className="w-full px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {savingPassword ? 'Saving...' : 'Set Password'}
                </button>
              </div>
            )}
          </div>

          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Storage & Export</h3>
            <button
              onClick={() => {
                onClose()
                onExportClick()
              }}
              className="w-full flex items-center gap-3 p-4 bg-gradient-to-r from-green-50 to-emerald-50 hover:from-green-100 hover:to-emerald-100 border-2 border-green-200 rounded-lg transition"
            >
              <Icon name="upload" size={20} className="text-green-600" />
              <div className="text-left flex-1">
                <p className="font-medium text-gray-900">Export Data</p>
                <p className="text-xs text-gray-600">Download your links and images</p>
              </div>
            </button>
          </div>

          {/* ── Storage tiers ── */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-1 flex items-center gap-2">
              <Icon name="hard-drive" size={16} />
              How Your Data Is Saved
            </h3>
            <p className="text-xs text-gray-500 mb-3">Each plan is honest about what it does.</p>
            <div className="space-y-2 text-sm">

              {/* Free */}
              <div className={`p-3 rounded-lg border-2 ${!isPremium ? 'border-purple-300 bg-purple-50' : 'border-gray-200 bg-gray-50'}`}>
                <div className="flex items-center justify-between mb-2">
                  <p className="font-semibold text-gray-900">Free — One device</p>
                  {!isPremium && <span className="text-[10px] bg-purple-500 text-white px-2 py-0.5 rounded-full font-medium">Your plan</span>}
                </div>
                <p className="text-xs text-gray-600 mb-2">
                  Great for organizing on a single device. Everything stays on <strong>this device</strong> — nothing is shared to other devices except saved URLs.
                </p>
                <ul className="space-y-1 text-gray-600 text-xs">
                  <li>✓ Saved URLs backed up to cloud (safe if you reinstall)</li>
                  <li>✓ Images &amp; files stored locally — fast, private, no cloud cost</li>
                  <li>✓ Keep, Borrow, Share, Bury &amp; Dream Keeper — full app</li>
                  <li className="text-gray-400">— Files stay on this device only</li>
                  <li className="text-gray-400">— No Chrome extension</li>
                </ul>
              </div>

              {/* Solo */}
              <div className={`p-3 rounded-lg border-2 ${isPremium && tierKey === 'solo' ? 'border-pink-300 bg-pink-50' : 'border-gray-200 bg-gray-50'}`}>
                <div className="flex items-center justify-between mb-2">
                  <p className="font-semibold text-gray-900">Solo — All your devices</p>
                  {isPremium && tierKey === 'solo' && <span className="text-[10px] bg-pink-500 text-white px-2 py-0.5 rounded-full font-medium">Your plan</span>}
                </div>
                <p className="text-xs text-gray-600 mb-2">
                  Everything syncs. Open LnkLokr on your phone, tablet, or another computer and see the same collection.
                </p>
                <ul className="space-y-1 text-gray-600 text-xs">
                  <li>✓ Images &amp; files uploaded to cloud — any device, any time</li>
                  <li>✓ 2 GB cloud storage</li>
                  <li>✓ No ads</li>
                  <li className="text-gray-400">— No Chrome extension</li>
                </ul>
              </div>

              {/* Pro */}
              <div className={`p-3 rounded-lg border-2 ${isPremium && tierKey === 'pro' ? 'border-indigo-300 bg-indigo-50' : 'border-gray-200 bg-gray-50'}`}>
                <div className="flex items-center justify-between mb-2">
                  <p className="font-semibold text-gray-900">Pro — Full power</p>
                  {isPremium && tierKey === 'pro' && <span className="text-[10px] bg-indigo-500 text-white px-2 py-0.5 rounded-full font-medium">Your plan</span>}
                </div>
                <p className="text-xs text-gray-600 mb-2">
                  The Chrome extension is what makes LnkLokr really click — right-click anything on the web and it's saved instantly.
                </p>
                <ul className="space-y-1 text-gray-600 text-xs">
                  <li>✓ Everything in Solo</li>
                  <li>✓ Chrome extension — save from any website in one click</li>
                  <li>✓ 10 GB cloud storage</li>
                  <li>✓ PC, Mac, Chromebook</li>
                </ul>
              </div>
            </div>
          </div>

          {/* ── Chrome Extension section ── */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <Icon name="globe" size={16} />
              Chrome Extension
            </h3>
            <div className="p-4 bg-blue-50 border-2 border-blue-200 rounded-lg space-y-3">
              <p className="text-sm text-blue-900 font-medium">The scraper — saves from any website</p>
              <p className="text-sm text-blue-800">
                LnkLokr is a PWA and cannot access other websites on its own. The Chrome extension bridges that gap — it runs inside your browser and can capture any link, image, or page you're looking at.
              </p>
              <div className="space-y-1.5 text-xs text-blue-700">
                <p className="font-semibold text-blue-800">What it does:</p>
                <p>• Right-click any link → <strong>Save to LnkLokr</strong> → goes to Keep</p>
                <p>• Right-click any image → saves image + page info to your collection</p>
                <p>• Right-click selected text → saves as a note</p>
                <p>• All saves are organised by Keep / Borrow / Share / Bury automatically</p>
              </div>
              <div className="space-y-1.5 text-xs text-blue-700">
                <p className="font-semibold text-blue-800">How to set up:</p>
                <p>① Install from the Chrome Web Store</p>
                <p>② Click the LnkLokr icon → sign in with your email &amp; password</p>
                <p>③ Right-click anything on any page to save it</p>
              </div>
              {tierKey === 'pro' ? (
                <a
                  href="https://chrome.google.com/webstore/detail/lnklokr"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition justify-center"
                >
                  <Icon name="external-link" size={14} />
                  Get the Extension
                </a>
              ) : (
                <div className="p-3 bg-white border border-blue-200 rounded-lg">
                  <p className="text-xs text-blue-800 font-medium mb-1">Requires Pro plan</p>
                  <p className="text-xs text-blue-600">
                    The Chrome extension is a Pro feature — it gives you the full scraping capability across every website you visit.{' '}
                    <button onClick={onClose} className="underline font-medium">Upgrade to Pro →</button>
                  </p>
                </div>
              )}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Help</h3>
            <a
              href="mailto:Support@SkylandApps.com?subject=LnkLokr%20Support"
              className="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition"
            >
              <div className="w-9 h-9 rounded-lg bg-pink-100 flex items-center justify-center flex-shrink-0">
                <Icon name="mail" size={18} className="text-pink-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">Contact Support</p>
                <p className="text-xs text-gray-500">Support@SkylandApps.com</p>
              </div>
            </a>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-3">About</h3>
            <div className="space-y-2 text-sm text-gray-600">
              <p>LnkLokr v1.5.1</p>
              <p>Save links with images. Keep · Borrow · Share · Bury.</p>
              <p className="text-xs text-gray-400 mt-1">Cancel at any time · Your data is yours · Never sold</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-full py-3 rounded-xl border-2 border-gray-200 bg-gray-50 hover:bg-gray-100 text-gray-600 font-semibold text-sm transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
