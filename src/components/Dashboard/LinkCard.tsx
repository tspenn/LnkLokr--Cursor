import { useState } from 'react'
import { Link } from '@/types'
import { useAuth } from '@/context/AuthContext'
import { updateLink } from '@/lib/dataService'
import { clsx } from 'clsx'
import { Icon } from '../shared/Icon'

interface LinkCardProps {
  link: Link
  onDelete: () => void
  onCopySuccess?: () => void
}

export function LinkCard({ link, onDelete, onCopySuccess }: LinkCardProps) {
  const { user } = useAuth()
  const [isFavorite, setIsFavorite] = useState(link.is_favorite)
  const [isDeleting, setIsDeleting] = useState(false)

  const handleToggleFavorite = async () => {
    if (!user) return
    try {
      await updateLink(user.is_premium ?? false, user.id, link.id, { is_favorite: !isFavorite })
      setIsFavorite(!isFavorite)
    } catch {
      // Non-fatal — icon will revert on next load
    }
  }

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(link.url)
    if (onCopySuccess) {
      onCopySuccess()
    }
  }

  const handleDelete = async () => {
    if (confirm('Are you sure you want to delete this link?')) {
      setIsDeleting(true)
      onDelete()
    }
  }

  return (
    <div className={clsx(
      'card group animate-slide-up',
      isDeleting && 'opacity-50 pointer-events-none'
    )}>
      {link.thumbnail_url && (
        <div className="relative h-40 bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-800 overflow-hidden">
          <img
            src={link.thumbnail_url}
            alt={link.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      )}

      {!link.thumbnail_url && (
        <div className="h-40 bg-gradient-to-br from-primary-50 to-primary-100 dark:from-primary-900/20 dark:to-primary-800/20 flex items-center justify-center">
          {link.icon ? (
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

          <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-500">
            <Icon name="globe" size={12} />
            <span className="truncate">{(() => { try { return new URL(link.url).hostname } catch { return link.url } })()}</span>
          </div>
        </div>

        {link.tags && link.tags.length > 0 && (
          <div className="flex gap-1.5 flex-wrap">
            {link.tags.slice(0, 3).map(tag => (
              <span
                key={tag}
                className="badge badge-primary"
              >
                {tag}
              </span>
            ))}
            {link.tags.length > 3 && (
              <span className="badge bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
                +{link.tags.length - 3}
              </span>
            )}
          </div>
        )}

        <div className="flex gap-2 pt-2 border-t border-gray-100 dark:border-gray-700">
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
          <button
            onClick={handleDelete}
            title="Delete link"
            className="btn btn-sm btn-ghost hover:bg-error-50 hover:text-error-600 dark:hover:bg-error-900/20 dark:hover:text-error-400"
            aria-label="Delete link"
          >
            <Icon name="trash" size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}
