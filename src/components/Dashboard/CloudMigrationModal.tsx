/**
 * CloudMigrationModal
 *
 * Shown once when a free user upgrades to a paid tier and local IndexedDB
 * data is detected. Offers a one-time transfer of local links and folders
 * to Supabase so they are available on all devices.
 *
 * After migration (or skip) we write a flag to localStore settings so the
 * modal never appears again on this device.
 */

import { useState } from 'react'
import { migrateLocalToCloud, clearLocalAfterMigration } from '@/lib/dataService'
import { localStore } from '@/lib/localStore'

interface CloudMigrationModalProps {
  userId: string
  localLinkCount: number
  localFolderCount: number
  onDone: () => void
}

type Phase = 'prompt' | 'migrating' | 'done' | 'skipped'

export function CloudMigrationModal({
  userId,
  localLinkCount,
  localFolderCount,
  onDone,
}: CloudMigrationModalProps) {
  const [phase, setPhase] = useState<Phase>('prompt')
  const [result, setResult] = useState<{ links: number; folders: number; skipped: number } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const markDone = async () => {
    await localStore.init()
    await localStore.setSetting('cloud_migration_done', true)
  }

  const handleTransfer = async () => {
    setPhase('migrating')
    setError(null)
    try {
      const res = await migrateLocalToCloud(userId)
      setResult(res)
      await clearLocalAfterMigration()
      await markDone()
      setPhase('done')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Migration failed. Please try again.')
      setPhase('prompt')
    }
  }

  const handleSkip = async () => {
    await markDone()
    setPhase('skipped')
    onDone()
  }

  if (phase === 'skipped') return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-7 border-4 border-black">

        {phase === 'prompt' && (
          <>
            <div className="text-center mb-5">
              <span className="text-4xl">☁️</span>
              <h2 className="text-2xl font-bold mt-3 mb-2">Transfer your saved links?</h2>
              <p className="text-sm text-gray-600 leading-relaxed">
                You have{' '}
                <strong>{localLinkCount} link{localLinkCount !== 1 ? 's' : ''}</strong>
                {localFolderCount > 0 && (
                  <> and <strong>{localFolderCount} folder{localFolderCount !== 1 ? 's' : ''}</strong></>
                )}{' '}
                saved on this device. Transfer them to the cloud so they're available on all your devices.
              </p>
            </div>

            {error && (
              <p className="text-xs text-red-600 text-center mb-4">{error}</p>
            )}

            <div className="space-y-3">
              <button
                onClick={handleTransfer}
                className="w-full py-3 rounded-full bg-gradient-to-r from-pink-400 to-orange-300 hover:from-pink-500 hover:to-orange-400 text-white font-semibold text-sm shadow-md transition"
              >
                Yes, transfer to cloud
              </button>
              <button
                onClick={handleSkip}
                className="w-full py-2.5 rounded-full border-2 border-gray-300 bg-white hover:bg-gray-50 text-gray-600 font-medium text-sm transition"
              >
                Keep local only for now
              </button>
            </div>
            <p className="text-xs text-gray-400 text-center mt-4">
              You can always export your data from Settings.
            </p>
          </>
        )}

        {phase === 'migrating' && (
          <div className="text-center py-6">
            <div className="text-4xl mb-4 animate-pulse">☁️</div>
            <p className="font-semibold text-gray-800">Transferring your data…</p>
            <p className="text-xs text-gray-500 mt-2">This will only take a moment.</p>
          </div>
        )}

        {phase === 'done' && result && (
          <div className="text-center py-4">
            <span className="text-4xl">✅</span>
            <h2 className="text-xl font-bold mt-3 mb-2">Transfer complete!</h2>
            <p className="text-sm text-gray-600 mb-1">
              {result.links} link{result.links !== 1 ? 's' : ''} moved to cloud.
            </p>
            {result.folders > 0 && (
              <p className="text-sm text-gray-600 mb-1">
                {result.folders} folder{result.folders !== 1 ? 's' : ''} moved to cloud.
              </p>
            )}
            {result.skipped > 0 && (
              <p className="text-xs text-amber-600 mb-3">
                {result.skipped} item{result.skipped !== 1 ? 's' : ''} could not be transferred.
              </p>
            )}
            <button
              onClick={onDone}
              className="mt-4 w-full py-3 rounded-full bg-gradient-to-r from-pink-400 to-orange-300 hover:from-pink-500 hover:to-orange-400 text-white font-semibold text-sm shadow-md transition"
            >
              Let's go!
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
