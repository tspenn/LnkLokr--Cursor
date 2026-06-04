import { useState, useEffect } from 'react'
import { localStore } from '@/lib/localStore'
import { startCheckout } from '@/lib/premiumService'
import { useAuth } from '@/context/AuthContext'
import { Icon } from '../shared/Icon'

interface ExportPanelProps {
  onClose: () => void
}

export function ExportPanel({ onClose }: ExportPanelProps) {
  const { user } = useAuth()
  const isPremium = user?.is_premium ?? false
  const [stats, setStats] = useState({ total_links: 0, total_folders: 0, total_images: 0, storage_used_mb: 0 })
  const [exporting, setExporting] = useState(false)
  const [upgrading, setUpgrading] = useState<'solo-monthly' | 'solo-yearly' | null>(null)

  useEffect(() => {
    const loadInfo = async () => {
      const storageStats = await localStore.getStats()
      setStats(storageStats)
    }
    loadInfo()
  }, [])

  const handleUpgrade = async (billing: 'monthly' | 'yearly') => {
    const tier = billing === 'yearly' ? 'solo-yearly' : 'solo-monthly'
    setUpgrading(tier)
    try {
      const url = await startCheckout(tier)
      if (url) {
        window.location.href = url
      } else {
        alert('Could not start checkout. Please try again.')
      }
    } finally {
      setUpgrading(null)
    }
  }

  const handleDownloadData = async () => {
    setExporting(true)
    try {
      const data = await localStore.exportData()
      const exportData = {
        exported_at: new Date().toISOString(),
        version: '2.0.0',
        ...data
      }

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `lnklokr-backup-${new Date().toISOString().split('T')[0]}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Failed to export data:', error)
      alert('Failed to export data')
    } finally {
      setExporting(false)
    }
  }

  const handleImportData = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      const text = await file.text()
      const data = JSON.parse(text)

      if (confirm('This will import all data from the backup file. Continue?')) {
        await localStore.importData(data)
        alert('Data imported successfully! Reloading...')
        window.location.reload()
      }
    } catch (error) {
      console.error('Failed to import data:', error)
      alert('Failed to import data. Please check the file format.')
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-md w-full p-8 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>

        <h2 className="text-2xl font-bold text-gray-900 mb-6">Export & Backup</h2>

        <div className="space-y-4">
          <div className="border-2 border-blue-200 rounded-xl p-6 bg-gradient-to-br from-blue-50 to-cyan-50">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-blue-500 rounded-lg">
                <Icon name="hard-drive" size={24} className="text-white" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-gray-900">Local Storage</h3>
                <p className="text-sm text-gray-600">Stored on your device</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 mb-4">
              <div className="bg-white rounded-lg p-2 text-center">
                <p className="text-xl font-bold text-blue-700">{stats.total_links}</p>
                <p className="text-xs text-gray-600">Links</p>
              </div>
              <div className="bg-white rounded-lg p-2 text-center">
                <p className="text-xl font-bold text-blue-700">{stats.total_images}</p>
                <p className="text-xs text-gray-600">Images</p>
              </div>
              <div className="bg-white rounded-lg p-2 text-center">
                <p className="text-xl font-bold text-blue-700">{stats.storage_used_mb.toFixed(0)}</p>
                <p className="text-xs text-gray-600">MB</p>
              </div>
            </div>

            <p className="text-xs text-gray-600">
              Your data is stored locally in your browser. Export regularly to keep backups.
            </p>
          </div>

          <div className="border-2 border-green-200 rounded-xl p-6 bg-gradient-to-br from-green-50 to-emerald-50">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-green-500 rounded-lg">
                <Icon name="download" size={24} className="text-white" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-gray-900">Export Backup</h3>
                <p className="text-sm text-gray-600">Download your data as JSON</p>
              </div>
            </div>

            <p className="text-sm text-gray-700 mb-4">
              Download all your links, folders, and images as a backup file.
            </p>

            <button
              onClick={handleDownloadData}
              disabled={exporting}
              className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-lg transition shadow-md hover:shadow-lg disabled:opacity-50"
            >
              {exporting ? 'Exporting...' : 'Download Backup File'}
            </button>
          </div>

          <div className="border-2 border-purple-200 rounded-xl p-6 bg-gradient-to-br from-purple-50 to-pink-50">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-purple-500 rounded-lg">
                <Icon name="upload" size={24} className="text-white" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-gray-900">Import Backup</h3>
                <p className="text-sm text-gray-600">Restore from a backup file</p>
              </div>
            </div>

            <p className="text-sm text-gray-700 mb-4">
              Import a previously exported backup file.
            </p>

            <label className="block w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 rounded-lg transition shadow-md hover:shadow-lg text-center cursor-pointer">
              Select Backup File
              <input
                type="file"
                accept=".json"
                onChange={handleImportData}
                className="hidden"
              />
            </label>
          </div>

          {!isPremium && (
            <div className="border-2 border-amber-200 rounded-xl p-6 bg-gradient-to-br from-amber-50 to-yellow-50">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-gradient-to-br from-amber-400 to-orange-400 rounded-lg">
                  <Icon name="crown" size={24} />
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-gray-900">Upgrade to LnkLokr Solo</h3>
                  <p className="text-sm text-gray-600">$2.99 / mo or $24.99 / yr</p>
                </div>
              </div>

              <div className="space-y-2 mb-4">
                <div className="flex items-center gap-2 text-sm text-gray-700">
                  <div className="w-2 h-2 bg-amber-500 rounded-full" />
                  <span>Automatic cloud backup</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-700">
                  <div className="w-2 h-2 bg-amber-500 rounded-full" />
                  <span>All your mobile devices</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-700">
                  <div className="w-2 h-2 bg-amber-500 rounded-full" />
                  <span>No ads</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleUpgrade('monthly')}
                  disabled={upgrading !== null}
                  className="bg-gradient-to-r from-amber-400 to-orange-400 hover:from-amber-500 hover:to-orange-500 disabled:opacity-60 text-white font-bold py-3 rounded-lg transition shadow-md hover:shadow-lg"
                >
                  {upgrading === 'solo-monthly' ? 'Starting…' : 'Monthly · $2.99'}
                </button>
                <button
                  onClick={() => handleUpgrade('yearly')}
                  disabled={upgrading !== null}
                  className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 disabled:opacity-60 text-white font-bold py-3 rounded-lg transition shadow-md hover:shadow-lg"
                >
                  {upgrading === 'solo-yearly' ? 'Starting…' : 'Yearly · $24.99'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
