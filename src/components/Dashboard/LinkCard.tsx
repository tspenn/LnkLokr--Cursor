import { useState, useEffect } from 'react'
import { Link } from '@/types'
import { useAuth } from '@/context/AuthContext'
import { updateLink } from '@/lib/dataService'
import { opfsStore, downloadFile } from '@/lib/opfsStore'
import { clsx } from 'clsx'
import { Icon } from '../shared/Icon'

interface LinkCardProps {
  link: Link
  onDelete: () => void
  onEdit?: () => void
  onCopySuccess?: () => void
}

export function LinkCard({ link, onDelete, onEdit, onCopySuccess }: LinkCardProps) {
  const { user } = useAuth()
  const [isFavorite, setIsFavorite] = useState(link.is_favorite)
  const [isDeleting, setIsDeleting] = useState(false)
  const [opfsBlobUrl, setOpfsBlobUrl] = useState<string | null>(null)
  const [opfsAvailable, setOpfsAvailable] = useState<boolean | null>(null)

  const isLocalFile = Boolean(link.opfs_path)

  // Resolve OPFS file on this device
  useEffect(() => {
    if (!isLocalFile || !user) return
    let revoked = false
    opfsStore.getFileUrl(user.id, link.opfs_path!).then((url) => {
      if (revoked) { if (url) URL.revokeObjectURL(url); return }
      setOpfsBlobUrl(url)
      setOpfsAvailable(url !== null)
    })
    return () => {
      revoked = true
      setOpfsBlobUrl(prev => { if (prev) URL.revokeObjectURL(prev); return null })
    }
  }, [isLocalFile, link.opfs_path, user])

  const handleToggleFavorite = async () => {
    if (!user) return
    try {
      await updateLink(user.is_premium ?? false, user.id, link.id, { is_favorite: !isFavorite })
      setIsFavorite(!isFavorite)
    } catch {
      // Non-fatal — reverts on next load
    }
  }

  const handleCopyUrl = () => {
    if (link.url) {
      navigator.clipboard.writeText(link.url)
      onCopySuccess?.()
    }
  }

  const handleDelete = async () => {
    if (confirm('Are you sure you want to delete this?')) {
      setIsDeleting(true)
      // Remove OPFS file alongside DB record
      if (isLocalFile && user) {
        opfsStore.deleteFile(user.id, link.opfs_path!).catch(() => {})
      }
      onDelete()
    }
  }

  const handleOpenLocalFile = () => {
    if (opfsBlobUrl) window.open(opfsBlobUrl, '_blank')
  }

  const handleDownloadLocalFile = async () => {
    if (!user || !link.opfs_path) return
    const file = await opfsStore.getFile(user.id, link.opfs_path)
    if (file) downloadFile(file, link.title || file.name)
  }

  // ── Thumbnail display source ───────────────────────────────────────────────
  // OPFS image on this device → use blob URL for full-res preview
  // Otherwise fall back to thumbnail_url (could be base64 or external URL)
  const thumbnailSrc = (isLocalFile && opfsBlobUrl) ? opfsBlobUrl : (link.thumbnail_url ?? null)

  return (
    <div className={clsx(
      'card group animate-slide-up',
      isDeleting && 'opacity-50 pointer-events-none'
    )}>
      {/* Thumbnail / preview area */}
      {thumbnailSrc ? (
        <div className="relative h-40 bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-800 overflow-hidden">
          <img
            src={thumbnailSrc}
            alt={link.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          {/* Device-only badge */}
          {isLocalFile && (
            <div className="absolute top-2 right-2">
              <span
                title={opfsAvailable ? 'Saved on this device' : 'File is on another device'}
                className={clsx(
                  'flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium',
                  opfsAvailable
                    ? 'bg-black/50 text-white'
                    : 'bg-amber-500/90 text-white'
                )}
              >
                <Icon name={opfsAvailable ? 'hard-drive' : 'alert-circle'} size={10} />
                {opfsAvailable ? 'On device' : 'Other device'}
              </span>
            </div>
          )}
        </div>
      ) : (
        <div className="h-40 bg-gradient-to-br from-primary-50 to-primary-100 dark:from-primary-900/20 dark:to-primary-800/20 flex items-center justify-center">
          {isLocalFile ? (
            // OPFS file on another device — show file-type placeholder
            <div className="text-center">
              <Icon
                name={link.content_type === 'pdf' ? 'file-text' : link.content_type === 'image' ? 'image' : 'file'}
                size={40}
                className="mx-auto text-primary-300 dark:text-primary-700 mb-1"
              />
              <p className="text-[10px] text-primary-400 dark:text-primary-600">On another device</p>
            </div>
          ) : link.icon ? (
            <img src={link.icon} alt="" className="w-12 h-12 object-contain opacity-70" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
          ) : (
            <Icon name="globe" size={48} className="text-primary-300 dark:text-primary-700" />
          )}
        </div>
      )}

      <div className="p-5 space-y-3">
        <div className="space-y-2">
          <h3 className="font-semibold text-gray-900 dark:text-white line-clamp-2 leading-snug">
            {link.title}
          </h3>

          {link.description && (
            <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
              {link.description}
            </p>
          )}

          {!isLocalFile && link.url && (
            <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-500">
              <Icon name="globe" size={12} />
              <span className="truncate">{(() => { try { return new URL(link.url).hostname } catch { return link.url } })()}</span>
            </div>
          )}

          {isLocalFile && (
            <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-500">
              <Icon name="hard-drive" size={12} />
              <span>{opfsAvailable ? 'Stored on this device' : 'Stored on another device'}</span>
            </div>
          )}
        </div>

        {link.tags && link.tags.length > 0 && (
          <div className="flex gap-1.5 flex-wrap">
            {link.tags.slice(0, 3).map(tag => (
              <span key={tag} className="badge badge-primary">{tag}</span>
            ))}
            {link.tags.length > 3 && (
              <span className="badge bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
                +{link.tags.length - 3}
              </span>
            )}
          </div>
        )}

        <div className="flex gap-2 pt-2 border-t border-gray-100 dark:border-gray-700">
          {isLocalFile ? (
            // OPFS file actions
            <>
              <button
                onClick={handleOpenLocalFile}
                disabled={!opfsAvailable}
                title={opfsAvailable ? 'Open file' : 'File is on another device'}
                className={clsx('flex-1 btn btn-sm', opfsAvailable ? 'btn-primary' : 'btn-secondary opacity-50 cursor-not-allowed')}
              >
                <Icon name="external-link" size={14} />
                Open
              </button>
              <button
                onClick={handleDownloadLocalFile}
                disabled={!opfsAvailable}
                title={opfsAvailable ? 'Download to device' : 'File is on another device'}
                className={clsx('btn btn-sm', opfsAvailable ? 'btn-ghost' : 'btn-ghost opacity-40 cursor-not-allowed')}
                aria-label="Download file"
              >
                <Icon name="download" size={14} />
              </button>
            </>
          ) : (
            // URL link actions
            <>
              <a
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 btn btn-sm btn-primary"
              >
                <Icon name="external-link" size={14} />
                Open
              </a>
              <button
                onClick={handleCopyUrl}
                title="Copy URL"
                className="btn btn-sm btn-ghost"
                aria-label="Copy link"
              >
                <Icon name="copy" size={14} />
              </button>
            </>
          )}

          <button
            onClick={handleToggleFavorite}
            title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
            className={clsx(
              'btn btn-sm',
              isFavorite
                ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/30'
                : 'btn-ghost'
            )}
            aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
          >
            <Icon name="heart" size={14} fill={isFavorite ? 'currentColor' : 'none'} />
          </button>
          {onEdit && (
            <button
              onClick={onEdit}
              title="Edit"
              className="btn btn-sm btn-ghost"
              aria-label="Edit"
            >
              <Icon name="edit" size={14} />
            </button>
          )}
          <button
            onClick={handleDelete}
            title="Delete"
            className="btn btn-sm btn-ghost hover:bg-error-50 hover:text-error-600 dark:hover:bg-error-900/20 dark:hover:text-error-400"
            aria-label="Delete"
          >
            <Icon name="trash" size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}
