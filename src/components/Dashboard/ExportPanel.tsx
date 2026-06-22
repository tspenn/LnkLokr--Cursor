import { useState, useEffect } from 'react'
import { startCheckout } from '@/lib/premiumService'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import { opfsStore, downloadFile } from '@/lib/opfsStore'
import { Icon } from '../shared/Icon'

interface ExportPanelProps {
  onClose: () => void
}

interface Stats {
  total_links: number
  total_folders: number
  local_files: number
}

export function ExportPanel({ onClose }: ExportPanelProps) {
  const { user } = useAuth()
  const isPremium = user?.is_premium ?? false
  const [stats, setStats] = useState<Stats>({ total_links: 0, total_folders: 0, local_files: 0 })
  const [exporting, setExporting] = useState(false)
  const [exportingFiles, setExportingFiles] = useState(false)
  const [upgrading, setUpgrading] = useState<'solo-monthly' | 'solo-yearly' | null>(null)

  useEffect(() => {
    if (!user) return
    const loadStats = async () => {
      const [linksRes, foldersRes, fileIds] = await Promise.all([
        supabase.from('links').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
        supabase.from('folders').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
        opfsStore.isSupported() ? opfsStore.listFileIds(user.id) : Promise.resolve([]),
      ])
      setStats({
        total_links: linksRes.count ?? 0,
        total_folders: foldersRes.count ?? 0,
        local_files: fileIds.length,
      })
    }
    loadStats()
  }, [user])

  const handleUpgrade = async (billing: 'monthly' | 'yearly') => {
    const tier = billing === 'yearly' ? 'solo-yearly' : 'solo-monthly'
    setUpgrading(tier)
    try {
      const url = await startCheckout(tier)
      if (url) window.location.href = url
      else alert('Could not start checkout. Please try again.')
    } finally {
      setUpgrading(null)
    }
  }

  /** Export all Supabase metadata (links + folders) as a JSON backup. */
  const handleDownloadMetadata = async () => {
    if (!user) return
    setExporting(true)
    try {
      const [linksRes, foldersRes] = await Promise.all([
        supabase.from('links').select('*').eq('user_id', user.id),
        supabase.from('folders').select('*').eq('user_id', user.id),
      ])
      const exportData = {
        exported_at: new Date().toISOString(),
        version: '3.0.0',
        links: linksRes.data ?? [],
        folders: foldersRes.data ?? [],
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
    } catch {
      alert('Failed to export data')
    } finally {
      setExporting(false)
    }
  }

  /**
   * Download all locally-stored OPFS files one by one.
   * No ZIP needed — browser downloads each file sequentially.
   */
  const handleDownloadLocalFiles = async () => {
    if (!user || !opfsStore.isSupported()) return
    setExportingFiles(true)
    try {
      const files = await opfsStore.exportAll(user.id)
      if (files.length === 0) { alert('No local files found on this device.'); return }
      for (const { file } of files) {
        downloadFile(file)
        // Small delay so browser doesn't throttle rapid downloads
        await new Promise(r => setTimeout(r, 400))
      }
    } catch {
      alert('Failed to export local files.')
    } finally {
      setExportingFiles(false)
    }
  }

  /** Import a JSON backup — upserts links and folders back into Supabase. */
  const handleImportData = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!user) return
    const file = event.target.files?.[0]
    if (!file) return
    try {
      const text = await file.text()
      const data = JSON.parse(text)
      if (!Array.isArray(data.links)) { alert('Invalid backup file.'); return }
      if (!confirm(`Import ${data.links.length} links and ${data.folders?.length ?? 0} folders? Existing items with the same ID will be updated.`)) return

      if (data.folders?.length) {
        await supabase.from('folders').upsert(
          data.folders.map((f: Record<string, unknown>) => ({ ...f, user_id: user.id })),
          { onConflict: 'id' }
        )
      }
      if (data.links.length) {
        const BATCH = 50
        for (let i = 0; i < data.links.length; i += BATCH) {
          await supabase.from('links').upsert(
            data.links.slice(i, i + BATCH).map((l: Record<string, unknown>) => ({ ...l, user_id: user.id })),
            { onConflict: 'id' }
          )
        }
      }
      alert('Import successful! Reloading…')
      window.location.reload()
    } catch {
      alert('Failed to import data. Please check the file format.')
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-md w-full p-8 relative overflow-y-auto max-h-[90vh]">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
          <Icon name="x" size={24} />
        </button>

        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Export & Backup</h2>

        <div className="space-y-4">
          {/* Stats */}
          <div className="border-2 border-blue-200 dark:border-blue-800 rounded-xl p-6 bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-blue-500 rounded-lg">
                <Icon name="hard-drive" size={24} className="text-white" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 dark:text-white">Your collection</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">Links in cloud · Files on this device</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-white dark:bg-gray-700 rounded-lg p-2 text-center">
                <p className="text-xl font-bold text-blue-700 dark:text-blue-400">{stats.total_links}</p>
                <p className="text-xs text-gray-600 dark:text-gray-400">Links</p>
              </div>
              <div className="bg-white dark:bg-gray-700 rounded-lg p-2 text-center">
                <p className="text-xl font-bold text-blue-700 dark:text-blue-400">{stats.total_folders}</p>
                <p className="text-xs text-gray-600 dark:text-gray-400">Folders</p>
              </div>
              <div className="bg-white dark:bg-gray-700 rounded-lg p-2 text-center">
                <p className="text-xl font-bold text-blue-700 dark:text-blue-400">{stats.local_files}</p>
                <p className="text-xs text-gray-600 dark:text-gray-400">Local files</p>
              </div>
            </div>
          </div>

          {/* Export metadata (JSON) */}
          <div className="border-2 border-green-200 dark:border-green-800 rounded-xl p-6 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-green-500 rounded-lg">
                <Icon name="download" size={24} className="text-white" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 dark:text-white">Export link data</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">Links & folders as JSON</p>
              </div>
            </div>
            <p className="text-sm text-gray-700 dark:text-gray-300 mb-4">
              Downloads all your saved links, folders, and metadata. Use this to back up or transfer your collection.
            </p>
            <button
              onClick={handleDownloadMetadata}
              disabled={exporting}
              className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-lg transition shadow-md disabled:opacity-50"
            >
              {exporting ? 'Exporting…' : 'Download Backup (JSON)'}
            </button>
          </div>

          {/* Export local files (OPFS) */}
          {opfsStore.isSupported() && stats.local_files > 0 && (
            <div className="border-2 border-indigo-200 dark:border-indigo-800 rounded-xl p-6 bg-gradient-to-br from-indigo-50 to-violet-50 dark:from-indigo-900/20 dark:to-violet-900/20">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-indigo-500 rounded-lg">
                  <Icon name="hard-drive" size={24} className="text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 dark:text-white">Download local files</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{stats.local_files} file{stats.local_files !== 1 ? 's' : ''} stored on this device</p>
                </div>
              </div>
              <p className="text-sm text-gray-700 dark:text-gray-300 mb-4">
                Downloads each locally-stored file individually. Copy them to a flash drive or external storage to access them on another device.
              </p>
              <button
                onClick={handleDownloadLocalFiles}
                disabled={exportingFiles}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-lg transition shadow-md disabled:opacity-50"
              >
                {exportingFiles ? 'Downloading…' : `Download ${stats.local_files} Local File${stats.local_files !== 1 ? 's' : ''}`}
              </button>
            </div>
          )}

          {/* Import */}
          <div className="border-2 border-purple-200 dark:border-purple-800 rounded-xl p-6 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-purple-500 rounded-lg">
                <Icon name="upload" size={24} className="text-white" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 dark:text-white">Import backup</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">Restore from a JSON backup</p>
              </div>
            </div>
            <p className="text-sm text-gray-700 dark:text-gray-300 mb-4">
              Restore links and folders from a previously exported backup file.
            </p>
            <label className="block w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 rounded-lg transition shadow-md text-center cursor-pointer">
              Select Backup File
              <input type="file" accept=".json" onChange={handleImportData} className="hidden" />
            </label>
          </div>

          {/* Upgrade prompt */}
          {!isPremium && (
            <div className="border-2 border-amber-200 dark:border-amber-800 rounded-xl p-6 bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-900/20 dark:to-yellow-900/20">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-gradient-to-br from-amber-400 to-orange-400 rounded-lg">
                  <Icon name="crown" size={24} />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 dark:text-white">Upgrade to LnkLokr Solo</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">$2.99 / mo or $24.99 / yr</p>
                </div>
              </div>
              <div className="space-y-2 mb-4">
                {['Sync files across all your devices', 'Cloud backup — no flash drive needed', 'No ads'].map(f => (
                  <div key={f} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                    <div className="w-2 h-2 bg-amber-500 rounded-full flex-shrink-0" />
                    <span>{f}</span>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleUpgrade('monthly')}
                  disabled={upgrading !== null}
                  className="bg-gradient-to-r from-amber-400 to-orange-400 hover:from-amber-500 hover:to-orange-500 disabled:opacity-60 text-white font-bold py-3 rounded-lg transition shadow-md"
                >
                  {upgrading === 'solo-monthly' ? 'Starting…' : 'Monthly · $2.99'}
                </button>
                <button
                  onClick={() => handleUpgrade('yearly')}
                  disabled={upgrading !== null}
                  className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 disabled:opacity-60 text-white font-bold py-3 rounded-lg transition shadow-md"
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
