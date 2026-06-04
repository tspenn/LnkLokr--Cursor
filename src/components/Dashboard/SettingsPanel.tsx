import { useState, useEffect } from 'react'
import { localStore } from '@/lib/localStore'
import { TIERS, startCheckout, openBillingPortal, resolveTierKey, type TierId } from '@/lib/premiumService'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { Icon } from '../shared/Icon'

interface SettingsPanelProps {
  onClose: () => void
  onExportClick: () => void
}

export function SettingsPanel({ onClose, onExportClick }: SettingsPanelProps) {
  const { user } = useAuth()
  const [isPremium, setIsPremium] = useState(false)
  const [stats, setStats] = useState({ total_links: 0, total_folders: 0, total_images: 0, storage_used_mb: 0 })
  const [newBuryPassword, setNewBuryPassword] = useState('')
  const [confirmBuryPassword, setConfirmBuryPassword] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)
  const [hasBuryPassword, setHasBuryPassword] = useState(false)
  const [checkoutLoading, setCheckoutLoading] = useState<TierId | null>(null)
  const [portalLoading, setPortalLoading] = useState(false)
  const tierKey = resolveTierKey(isPremium, user?.subscription_tier)

  useEffect(() => {
    const loadStatus = async () => {
      const storageStats = await localStore.getStats()
      setIsPremium(user?.is_premium ?? false)
      setStats(storageStats)

      if (user) {
        const { data } = await supabase
          .from('users')
          .select('bury_password')
          .eq('id', user.id)
          .maybeSingle()

        if (data && data.bury_password) {
          setHasBuryPassword(true)
        }
      }
    }
    loadStatus()
  }, [user])

  const handleCheckout = async (tier: TierId) => {
    setCheckoutLoading(tier)
    try {
      const url = await startCheckout(tier, user?.email)
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
      alert('Bury password saved successfully!')
    } catch (error) {
      console.error('Failed to save bury password:', error)
      alert('Failed to save password. Please try again.')
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
      alert('Bury password removed successfully!')
    } catch (error) {
      console.error('Failed to remove bury password:', error)
      alert('Failed to remove password. Please try again.')
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
              Local Storage Stats
            </h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="p-3 bg-blue-50 rounded-lg">
                <p className="text-gray-600">Links</p>
                <p className="text-xl font-bold text-blue-700">{stats.total_links}</p>
              </div>
              <div className="p-3 bg-green-50 rounded-lg">
                <p className="text-gray-600">Folders</p>
                <p className="text-xl font-bold text-green-700">{stats.total_folders}</p>
              </div>
              <div className="p-3 bg-purple-50 rounded-lg">
                <p className="text-gray-600">Images</p>
                <p className="text-xl font-bold text-purple-700">{stats.total_images}</p>
              </div>
              <div className="p-3 bg-orange-50 rounded-lg">
                <p className="text-gray-600">Storage</p>
                <p className="text-xl font-bold text-orange-700">{stats.storage_used_mb.toFixed(1)} MB</p>
              </div>
            </div>
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
              <button
                onClick={handleManageSubscription}
                disabled={portalLoading}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-white border-2 border-amber-300 hover:bg-amber-50 text-amber-900 rounded-lg text-sm font-medium transition disabled:opacity-50"
              >
                <Icon name="settings" size={16} />
                {portalLoading ? 'Opening…' : 'Manage subscription'}
              </button>
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

          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-3">About</h3>
            <div className="space-y-2 text-sm text-gray-600">
              <p>LnkLokr v2.0.0</p>
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
