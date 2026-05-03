import { useState, useEffect } from 'react'
import { localStore } from '@/lib/localStore'
import { premiumService, TIERS, type TierId } from '@/lib/premiumService'
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
  const [cloudSyncEnabled, setCloudSyncEnabled] = useState(false)
  const [activationKey, setActivationKey] = useState('')
  const [activating, setActivating] = useState(false)
  const [stats, setStats] = useState({ total_links: 0, total_folders: 0, total_images: 0, storage_used_mb: 0 })
  const [newBuryPassword, setNewBuryPassword] = useState('')
  const [confirmBuryPassword, setConfirmBuryPassword] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)
  const [hasBuryPassword, setHasBuryPassword] = useState(false)
  const [checkoutLoading, setCheckoutLoading] = useState<TierId | null>(null)

  useEffect(() => {
    const loadStatus = async () => {
      const [status, storageStats] = await Promise.all([
        premiumService.getStatus(),
        localStore.getStats(),
      ])
      setIsPremium(status.isPremium)
      setCloudSyncEnabled(status.cloudSyncEnabled)
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
      const url = await premiumService.startCheckout(tier, user?.email)
      if (url) {
        window.location.href = url
      } else {
        alert('Could not start checkout. Please try again.')
      }
    } finally {
      setCheckoutLoading(null)
    }
  }

  const handleActivate = async () => {
    if (!activationKey.trim()) return

    setActivating(true)
    const success = await premiumService.activatePremium(activationKey)
    setActivating(false)

    if (success) {
      setIsPremium(true)
      setActivationKey('')
      alert('LokBx Premium activated successfully!')
      window.location.reload()
    } else {
      alert('Invalid activation key. Please check and try again.')
    }
  }

  const handleToggleCloudSync = async () => {
    const newState = !cloudSyncEnabled
    const success = await premiumService.toggleCloudSync(newState)

    if (success) {
      setCloudSyncEnabled(newState)
      if (newState) {
        alert('LokBx sync enabled! Your data will now sync to the cloud.')
      } else {
        alert('LokBx sync disabled. Your data will remain local only.')
      }
      window.location.reload()
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

          {!isPremium ? (
            <div className="p-4 bg-gradient-to-br from-blue-50 to-cyan-50 border-2 border-blue-200 rounded-lg">
              <div className="flex items-center gap-2 mb-3">
                <Icon name="crown" size={20} />
                <h3 className="font-semibold text-blue-900">Upgrade LnkLokr</h3>
              </div>
              <p className="text-sm text-blue-800 mb-4">
                One-time licenses for the desktop / mobile app, plus the optional LokBx Cloud subscription for cross-device sync and backup.
              </p>

              <div className="space-y-3">
                <div>
                  <p className="text-xs uppercase font-bold tracking-wide text-blue-700 mb-2">
                    App License (one-time)
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {(['one-device', 'five-device'] as const).map(tierId => {
                      const t = TIERS[tierId]
                      const loading = checkoutLoading === tierId
                      return (
                        <button
                          key={tierId}
                          onClick={() => handleCheckout(tierId)}
                          disabled={loading}
                          className="text-left p-3 border-2 border-blue-300 hover:border-blue-500 bg-white rounded-lg transition disabled:opacity-60"
                        >
                          <p className="text-sm font-bold text-gray-900">{t.name}</p>
                          <p className="text-xs text-gray-600 mt-0.5">{t.description}</p>
                          <p className="text-base font-bold text-blue-700 mt-1">
                            {loading ? 'Starting…' : t.priceLabel}
                          </p>
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div>
                  <p className="text-xs uppercase font-bold tracking-wide text-blue-700 mb-2">
                    LokBx Cloud Storage (subscription)
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {(['cloud-monthly', 'cloud-yearly'] as const).map(tierId => {
                      const t = TIERS[tierId]
                      const loading = checkoutLoading === tierId
                      const isYearly = tierId === 'cloud-yearly'
                      return (
                        <button
                          key={tierId}
                          onClick={() => handleCheckout(tierId)}
                          disabled={loading}
                          className={`text-left p-3 border-2 rounded-lg transition disabled:opacity-60 ${
                            isYearly
                              ? 'border-amber-400 bg-amber-50 hover:border-amber-500'
                              : 'border-blue-300 bg-white hover:border-blue-500'
                          }`}
                        >
                          <p className="text-sm font-bold text-gray-900">{t.name}</p>
                          <p className="text-xs text-gray-600 mt-0.5">{t.description}</p>
                          <p
                            className={`text-base font-bold mt-1 ${
                              isYearly ? 'text-amber-700' : 'text-blue-700'
                            }`}
                          >
                            {loading ? 'Starting…' : t.priceLabel}
                          </p>
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>

              <div className="pt-4 mt-4 border-t border-blue-200">
                <p className="text-xs text-blue-700 mb-2 font-medium flex items-center gap-1">
                  <Icon name="key" size={14} />
                  Already purchased? Activate here:
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={activationKey}
                    onChange={(e) => setActivationKey(e.target.value)}
                    placeholder="Enter activation key"
                    className="flex-1 px-3 py-2 border border-blue-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <button
                    onClick={handleActivate}
                    disabled={activating || !activationKey.trim()}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {activating ? 'Activating...' : 'Activate'}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-4 bg-gradient-to-br from-amber-50 to-yellow-50 border-2 border-amber-200 rounded-lg">
              <div className="flex items-center gap-2 mb-3">
                <Icon name="crown" size={20} />
                <h3 className="font-semibold text-amber-900">LokBx Premium Active</h3>
              </div>

              <div className="flex items-center justify-between p-3 bg-white rounded-lg mb-3">
                <div className="flex items-center gap-2">
                  <Icon name="cloud" size={18} className="text-blue-600" />
                  <span className="text-sm font-medium text-gray-900">LokBx Sync</span>
                </div>
                <button
                  onClick={handleToggleCloudSync}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                    cloudSyncEnabled ? 'bg-blue-600' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                      cloudSyncEnabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              <p className="text-xs text-amber-800">
                {cloudSyncEnabled
                  ? 'Your data is syncing to LokBx cloud automatically.'
                  : 'Enable LokBx sync to backup your data and sync across devices.'}
              </p>
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
              <p>Local-first bookmark manager with optional LokBx cloud sync</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
