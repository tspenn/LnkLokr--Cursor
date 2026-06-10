import React, { useState, useRef } from 'react'
import { Folder, Link } from '@/types'
import { Icon } from '../shared/Icon'

interface AddLinkModalProps {
  folders: Folder[]
  onAdd: (link: Partial<Link>) => void
  onClose: () => void
}

export function AddLinkModal({ folders, onAdd, onClose }: AddLinkModalProps) {
  const [formData, setFormData] = useState({
    url: '',
    title: '',
    description: '',
    folder_id: null as string | null,
    tags: [] as string[],
  })
  const [tagInput, setTagInput] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isScraping, setIsScraping] = useState(false)
  const scrapeDebounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  const scrapeUrl = async (url: string) => {
    try {
      new URL(url)
    } catch {
      return
    }
    setIsScraping(true)
    try {
      const res = await fetch(`/api/scrape?url=${encodeURIComponent(url)}`)
      if (!res.ok) return
      const meta = await res.json()
      setFormData(prev => ({
        ...prev,
        title: prev.title || meta.title || '',
        description: prev.description || meta.description || '',
      }))
    } catch {
      // Non-fatal — user can fill in manually
    } finally {
      setIsScraping(false)
    }
  }

  const handleUrlChange = (url: string) => {
    setFormData(prev => ({ ...prev, url }))
    if (scrapeDebounce.current) clearTimeout(scrapeDebounce.current)
    scrapeDebounce.current = setTimeout(() => scrapeUrl(url), 800)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!formData.url || !formData.title) {
      setError('URL and title are required')
      return
    }

    try {
      new URL(formData.url)
    } catch {
      setError('Invalid URL')
      return
    }

    setIsLoading(true)
    try {
      // Fetch final metadata server-side at save time to capture thumbnail_url
      let thumbnail_url: string | null = null
      let icon: string | null = null
      try {
        const res = await fetch(`/api/scrape?url=${encodeURIComponent(formData.url)}`)
        if (res.ok) {
          const meta = await res.json()
          thumbnail_url = meta.thumbnail_url ?? null
          icon = meta.icon ?? null
        }
      } catch { /* non-fatal */ }

      await onAdd({
        ...formData,
        thumbnail_url,
        icon,
        is_favorite: false,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add link')
    } finally {
      setIsLoading(false)
    }
  }

  const handleAddTag = () => {
    if (tagInput.trim() && !formData.tags.includes(tagInput.trim())) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, tagInput.trim()],
      }))
      setTagInput('')
    }
  }

  const handleRemoveTag = (tag: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(t => t !== tag),
    }))
  }

  return (
    <div className="modal-overlay animate-fade-in" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-content max-w-lg w-full animate-scale-in">
        <div className="sticky top-0 flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Add New Link</h2>
          <button
            onClick={onClose}
            className="btn btn-ghost p-2"
            aria-label="Close modal"
          >
            <Icon name="x" size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="flex gap-3 p-4 bg-error-50 dark:bg-error-900/20 border border-error-200 dark:border-error-800 rounded-xl text-error-700 dark:text-error-300 text-sm animate-slide-down">
              <Icon name="alert-circle" size={20} className="flex-shrink-0" />
              <span className="font-medium">{error}</span>
            </div>
          )}

          <div className="space-y-2">
            <label htmlFor="url-input" className="block text-sm font-semibold text-gray-700 dark:text-gray-300">
              URL <span className="text-error-500">*</span>
            </label>
            <div className="relative">
              <input
                id="url-input"
                type="url"
                value={formData.url}
                onChange={(e) => handleUrlChange(e.target.value)}
                placeholder="https://example.com"
                required
                disabled={isLoading}
                className="input-field pr-10"
              />
              {isScraping && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 animate-pulse">
                  Fetching…
                </span>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="title-input" className="block text-sm font-semibold text-gray-700 dark:text-gray-300">
              Title <span className="text-error-500">*</span>
            </label>
            <input
              id="title-input"
              type="text"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              placeholder="Enter link title"
              required
              disabled={isLoading}
              className="input-field"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="description-input" className="block text-sm font-semibold text-gray-700 dark:text-gray-300">
              Description
            </label>
            <textarea
              id="description-input"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Add a description (optional)"
              disabled={isLoading}
              rows={3}
              className="input-field resize-none"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="folder-select" className="block text-sm font-semibold text-gray-700 dark:text-gray-300">
              Folder
            </label>
            <select
              id="folder-select"
              value={formData.folder_id || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, folder_id: e.target.value || null }))}
              disabled={isLoading}
              className="input-field"
            >
              <option value="">No folder</option>
              {folders.map(folder => (
                <option key={folder.id} value={folder.id}>
                  {folder.icon} {folder.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label htmlFor="tag-input" className="block text-sm font-semibold text-gray-700 dark:text-gray-300">
              Tags
            </label>
            <div className="flex gap-2">
              <input
                id="tag-input"
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                placeholder="Add a tag"
                disabled={isLoading}
                className="input-field flex-1"
              />
              <button
                type="button"
                onClick={handleAddTag}
                disabled={isLoading || !tagInput.trim()}
                className="btn btn-secondary btn-md"
              >
                <Icon name="plus" size={16} />
              </button>
            </div>
            {formData.tags.length > 0 && (
              <div className="flex gap-2 flex-wrap pt-2">
                {formData.tags.map(tag => (
                  <span
                    key={tag}
                    className="badge badge-primary"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(tag)}
                      className="ml-1 hover:text-primary-900 dark:hover:text-primary-100"
                      aria-label={`Remove ${tag} tag`}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              disabled={isLoading || !formData.url || !formData.title}
              className="flex-1 btn btn-lg btn-primary"
            >
              {isLoading ? 'Adding...' : 'Add Link'}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="flex-1 btn btn-lg btn-secondary"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
