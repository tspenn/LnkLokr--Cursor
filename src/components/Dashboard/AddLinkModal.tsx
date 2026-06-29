import React, { useState, useRef, useEffect, useCallback } from 'react'
import { Folder, Link } from '@/types'
import { Icon } from '../shared/Icon'
import { supabase } from '@/lib/supabase'
import { opfsStore, generateThumbnail } from '@/lib/opfsStore'
import { addFolder, getFolders } from '@/lib/dataService'
import type { FolderScope } from './FolderBar'

type ContentMode = 'link' | 'image' | 'file'

const IMAGE_EXT = /\.(jpe?g|png|gif|webp|svg|avif|bmp|ico)(\?.*)?$/i

function looksLikeImageUrl(url: string): boolean {
  try { return IMAGE_EXT.test(new URL(url).pathname) } catch { return false }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

interface AddLinkModalProps {
  folders: Folder[]
  isPremium: boolean
  userId: string
  currentStatus?: 'keep' | 'borrow' | 'share' | 'bury'
  folderScope?: FolderScope
  initialMode?: ContentMode
  initialUrl?: string
  initialFile?: File
  onAdd: (link: Partial<Link>) => void
  onClose: () => void
}

export function AddLinkModal({
  folders,
  isPremium,
  userId,
  currentStatus = 'keep',
  folderScope = 'keep',
  initialMode = 'link',
  initialUrl,
  initialFile,
  onAdd,
  onClose,
}: AddLinkModalProps) {
  const [mode, setMode] = useState<ContentMode>(initialMode)
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
  const [allFolders, setAllFolders] = useState<Folder[]>(folders)
  const [showNewFolderInput, setShowNewFolderInput] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [creatingFolder, setCreatingFolder] = useState(false)

  // For non-Keep scopes, load the scoped folder list on mount
  useEffect(() => {
    if (folderScope !== 'keep') {
      getFolders(true, userId, folderScope)
        .then(setAllFolders)
        .catch(() => {})
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const [isScraping, setIsScraping] = useState(false)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [filePreview, setFilePreview] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const scrapeDebounce = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── Clipboard paste (Ctrl+V anywhere in modal) ────────────────────────────
  const handlePaste = useCallback((e: ClipboardEvent) => {
    const items = e.clipboardData?.items
    if (!items) return

    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        e.preventDefault()
        const file = item.getAsFile()
        if (file) { setMode('image'); applyFile(file) }
        return
      }
    }

    const text = e.clipboardData?.getData('text') ?? ''
    if (text.startsWith('http') && looksLikeImageUrl(text)) {
      setMode('image')
      applyImageUrl(text)
    }
  }, [])

  useEffect(() => {
    window.addEventListener('paste', handlePaste)
    return () => window.removeEventListener('paste', handlePaste)
  }, [handlePaste])

  // ── Scraping ──────────────────────────────────────────────────────────────
  const scrapeUrl = async (url: string) => {
    try { new URL(url) } catch { return }
    setIsScraping(true)
    try {
      const res = await fetch(`/api/scrape?url=${encodeURIComponent(url)}`)
      if (!res.ok) return
      const meta = await res.json()
      if (meta.content_type === 'image') {
        setMode('image')
        setImagePreview(url)
      }
      setFormData(prev => ({
        ...prev,
        title: prev.title || meta.title || '',
        description: prev.description || meta.description || '',
      }))
    } catch { /* non-fatal */ } finally {
      setIsScraping(false)
    }
  }

  const debounce = (url: string) => {
    if (scrapeDebounce.current) clearTimeout(scrapeDebounce.current)
    scrapeDebounce.current = setTimeout(() => scrapeUrl(url), 800)
  }

  const applyImageUrl = (url: string) => {
    setFormData(prev => ({ ...prev, url }))
    if (looksLikeImageUrl(url)) setImagePreview(url)
    debounce(url)
  }

  // ── File helpers ──────────────────────────────────────────────────────────
  const applyFile = (file: File) => {
    setSelectedFile(file)
    setError('')
    setFormData(prev => ({
      ...prev,
      title: prev.title || file.name.replace(/\.[^/.]+$/, ''),
    }))
    if (file.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.onload = (e) => setFilePreview(e.target?.result as string)
      reader.readAsDataURL(file)
    } else {
      setFilePreview(null)
    }
  }

  // Apply any pre-loaded content (from global paste or external trigger)
  useEffect(() => {
    if (initialFile) {
      setMode('image')
      applyFile(initialFile)
    } else if (initialUrl) {
      if (looksLikeImageUrl(initialUrl)) {
        setMode('image')
        applyImageUrl(initialUrl)
      } else {
        setMode('link')
        setFormData(prev => ({ ...prev, url: initialUrl }))
        debounce(initialUrl)
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const clearFile = () => {
    setSelectedFile(null)
    setFilePreview(null)
    setImagePreview(null)
    setFormData(prev => ({ ...prev, url: '' }))
  }

  // ── Drag & drop ───────────────────────────────────────────────────────────
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (!file) return
    setMode(file.type.startsWith('image/') ? 'image' : 'file')
    applyFile(file)
  }

  // ── Upload to Supabase Storage ────────────────────────────────────────────
  const uploadFile = async (file: File): Promise<{ storage_path: string; public_url: string }> => {
    const ext = file.name.split('.').pop() ?? 'bin'
    const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
    const { error: upErr } = await supabase.storage
      .from('saved-images')
      .upload(path, file, { contentType: file.type, upsert: false })
    if (upErr) throw new Error(`Upload failed: ${upErr.message}`)
    const { data: { publicUrl } } = supabase.storage.from('saved-images').getPublicUrl(path)
    return { storage_path: path, public_url: publicUrl }
  }

  const insertSavedItem = async (
    storage_path: string,
    public_url: string,
    file: File,
    contentType: string,
  ) => {
    const { error } = await supabase.from('saved_items').insert({
      user_id: userId,
      storage_path,
      public_url,
      original_src: '',
      title: formData.title,
      mime_type: file.type,
      file_size: file.size,
      file_name: file.name,
      content_type: contentType,
      status: currentStatus,
      folder_id: formData.folder_id,
      thumbnail_url: file.type.startsWith('image/') ? public_url : null,
      description: formData.description || null,
    })
    if (error) throw new Error(error.message)
  }

  // ── Submit handlers ───────────────────────────────────────────────────────
  const handleSubmitLink = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!formData.url || !formData.title) { setError('URL and title are required'); return }
    try { new URL(formData.url) } catch { setError('Invalid URL'); return }
    setIsLoading(true)
    try {
      let thumbnail_url: string | null = null
      let icon: string | null = null
      try {
        const res = await fetch(`/api/scrape?url=${encodeURIComponent(formData.url)}`)
        if (res.ok) { const m = await res.json(); thumbnail_url = m.thumbnail_url ?? null; icon = m.icon ?? null }
      } catch { /* non-fatal */ }
      await onAdd({ ...formData, thumbnail_url, icon, content_type: 'url', is_favorite: false, status: currentStatus })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save link')
    } finally { setIsLoading(false) }
  }

  const handleSubmitImage = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!formData.title) { setError('Title is required'); return }
    setIsLoading(true)
    try {
      if (selectedFile) {
        if (isPremium) {
          // Paid: upload full file to Supabase Storage
          const { storage_path, public_url } = await uploadFile(selectedFile)
          await insertSavedItem(storage_path, public_url, selectedFile, 'image')
          onClose()
        } else {
          // Free: save full file to OPFS, thumbnail to Supabase via links row
          if (!opfsStore.isSupported()) {
            setError('Your browser does not support local file storage. Upgrade to save to the cloud.')
            return
          }
          const [opfs_path, thumbnail_url] = await Promise.all([
            opfsStore.saveFile(userId, selectedFile),
            generateThumbnail(selectedFile),
          ])
          await onAdd({
            ...formData,
            url: '',
            thumbnail_url: thumbnail_url ?? null,
            content_type: 'image',
            is_favorite: false,
            status: currentStatus,
            opfs_path,
          })
          onClose()
        }
      } else if (formData.url) {
        try { new URL(formData.url) } catch { setError('Invalid image URL'); return }
        await onAdd({ ...formData, thumbnail_url: imagePreview, content_type: 'image', is_favorite: false, status: currentStatus })
      } else {
        setError('Paste an image URL or upload a file')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save image')
    } finally { setIsLoading(false) }
  }

  const handleSubmitFile = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!selectedFile) { setError('Please select a file'); return }
    if (!formData.title) { setError('Title is required'); return }
    setIsLoading(true)
    try {
      const ext = selectedFile.name.split('.').pop()?.toLowerCase()
      const contentType = selectedFile.type.startsWith('image/') ? 'image' : ext === 'pdf' ? 'pdf' : 'file'
      if (isPremium) {
        // Paid: upload to Supabase Storage
        const { storage_path, public_url } = await uploadFile(selectedFile)
        await insertSavedItem(storage_path, public_url, selectedFile, contentType)
        onClose()
      } else {
        // Free: save to OPFS, metadata to Supabase via links row
        if (!opfsStore.isSupported()) {
          setError('Your browser does not support local file storage. Upgrade to save to the cloud.')
          return
        }
        const [opfs_path, thumbnail_url] = await Promise.all([
          opfsStore.saveFile(userId, selectedFile),
          generateThumbnail(selectedFile),
        ])
        await onAdd({
          ...formData,
          url: '',
          thumbnail_url: thumbnail_url ?? null,
          content_type: contentType,
          is_favorite: false,
          status: currentStatus,
          opfs_path,
        })
        onClose()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload file')
    } finally { setIsLoading(false) }
  }

  const handleCreateFolder = async () => {
    const name = newFolderName.trim()
    if (!name) return
    setCreatingFolder(true)
    try {
      const created = await addFolder(false, userId, {
        name,
        position: allFolders.length,
        scope: folderScope,
      })
      setAllFolders(prev => [...prev, created])
      setFormData(prev => ({ ...prev, folder_id: created.id }))
      setNewFolderName('')
      setShowNewFolderInput(false)
    } catch {
      setError('Failed to create folder')
    } finally {
      setCreatingFolder(false)
    }
  }

  const handleAddTag = () => {
    if (tagInput.trim() && !formData.tags.includes(tagInput.trim())) {
      setFormData(prev => ({ ...prev, tags: [...prev.tags, tagInput.trim()] }))
      setTagInput('')
    }
  }

  // ── Derived ───────────────────────────────────────────────────────────────
  const onSubmit = mode === 'link' ? handleSubmitLink : mode === 'image' ? handleSubmitImage : handleSubmitFile
  const submitLabel = isLoading
    ? 'Saving…'
    : mode === 'link' ? 'Save Link' : mode === 'image' ? 'Save Image' : 'Upload File'

  const canSubmit = !isLoading && (
    mode === 'link' ? (!!formData.url && !!formData.title) :
    mode === 'image' ? (!!formData.title && (!!formData.url || !!selectedFile)) :
    (!!selectedFile && !!formData.title)
  )

  const preview = imagePreview || filePreview

  // ── Common fields (title, description, folder, tags) ─────────────────────
  const commonFields = (
    <>
      <div className="space-y-2">
        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">
          Title <span className="text-error-500">*</span>
        </label>
        <input
          type="text"
          value={formData.title}
          onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
          placeholder="Enter title"
          disabled={isLoading}
          className="input-field"
        />
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">Description</label>
        <textarea
          value={formData.description}
          onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
          placeholder="Optional description"
          disabled={isLoading}
          rows={2}
          className="input-field resize-none"
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">Folder</label>
          {!showNewFolderInput && (
            <button
              type="button"
              onClick={() => setShowNewFolderInput(true)}
              className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700 font-medium"
            >
              <Icon name="plus" size={13} /> New folder
            </button>
          )}
        </div>

        {showNewFolderInput ? (
          <div className="flex gap-2">
            <input
              autoFocus
              type="text"
              value={newFolderName}
              onChange={e => setNewFolderName(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') { e.preventDefault(); handleCreateFolder() }
                if (e.key === 'Escape') { setShowNewFolderInput(false); setNewFolderName('') }
              }}
              placeholder="Folder name"
              disabled={creatingFolder}
              className="input-field flex-1 text-sm"
            />
            <button
              type="button"
              onClick={handleCreateFolder}
              disabled={creatingFolder || !newFolderName.trim()}
              className="px-3 py-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition"
            >
              {creatingFolder ? '…' : 'Create'}
            </button>
            <button
              type="button"
              onClick={() => { setShowNewFolderInput(false); setNewFolderName('') }}
              className="px-2 py-2 text-gray-500 hover:text-gray-700 rounded-lg text-sm"
            >
              ✕
            </button>
          </div>
        ) : (
          <select
            value={formData.folder_id || ''}
            onChange={(e) => setFormData(prev => ({ ...prev, folder_id: e.target.value || null }))}
            disabled={isLoading}
            className="input-field"
          >
            <option value="">No folder</option>
            {allFolders.map(f => (
              <option key={f.id} value={f.id}>{f.icon} {f.name}</option>
            ))}
          </select>
        )}
      </div>

      {mode === 'link' && (
        <div className="space-y-2">
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">Tags</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
              placeholder="Add a tag"
              disabled={isLoading}
              className="input-field flex-1"
            />
            <button type="button" onClick={handleAddTag} disabled={isLoading || !tagInput.trim()} className="btn btn-secondary btn-md">
              <Icon name="plus" size={16} />
            </button>
          </div>
          {formData.tags.length > 0 && (
            <div className="flex gap-2 flex-wrap pt-1">
              {formData.tags.map(tag => (
                <span key={tag} className="badge badge-primary">
                  {tag}
                  <button type="button" onClick={() => setFormData(prev => ({ ...prev, tags: prev.tags.filter(t => t !== tag) }))} className="ml-1">×</button>
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  )

  return (
    <div className="modal-overlay animate-fade-in" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-content max-w-lg w-full animate-scale-in">

        {/* Header */}
        <div className="sticky top-0 flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 z-10">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Save to LnkLokr</h2>
          <button onClick={onClose} className="btn btn-ghost p-2" aria-label="Close">
            <Icon name="x" size={20} />
          </button>
        </div>

        {/* Mode tabs */}
        <div className="flex border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-6">
          {([
            { id: 'link' as ContentMode, label: 'Link', icon: 'link' },
            { id: 'image' as ContentMode, label: 'Image', icon: 'image' },
            { id: 'file' as ContentMode, label: 'File', icon: 'file', pro: false },
          ]).map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => { setMode(tab.id); setError('') }}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                mode === tab.id
                  ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
              }`}
            >
              <Icon name={tab.icon as Parameters<typeof Icon>[0]['name']} size={15} />
              {tab.label}
              {tab.pro && !isPremium && (
                <span className="text-xs bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 px-1.5 py-0.5 rounded-full">Pro</span>
              )}
            </button>
          ))}
        </div>

        <form onSubmit={onSubmit} className="p-6 space-y-5">
          {error && (
            <div className="flex gap-3 p-4 bg-error-50 dark:bg-error-900/20 border border-error-200 dark:border-error-800 rounded-xl text-error-700 dark:text-error-300 text-sm">
              <Icon name="alert-circle" size={18} className="flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* ── LINK MODE ── */}
          {mode === 'link' && (
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">
                URL <span className="text-error-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="url"
                  value={formData.url}
                  onChange={(e) => {
                    setFormData(prev => ({ ...prev, url: e.target.value }))
                    debounce(e.target.value)
                  }}
                  placeholder="https://example.com"
                  disabled={isLoading}
                  autoFocus
                  className="input-field pr-20"
                />
                {isScraping && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 animate-pulse">Fetching…</span>
                )}
              </div>
            </div>
          )}

          {/* ── IMAGE MODE ── */}
          {mode === 'image' && (
            <div className="space-y-4">
              {/* Paste hint */}
              <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl text-blue-700 dark:text-blue-300 text-sm">
                <Icon name="copy" size={15} className="flex-shrink-0" />
                <span>
                  Press <kbd className="px-1.5 py-0.5 bg-blue-100 dark:bg-blue-800 rounded text-xs font-mono">Ctrl+V</kbd> to paste a copied image or image URL
                </span>
              </div>

              {/* Preview */}
              {preview && (
                <div className="relative rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-700 flex items-center justify-center min-h-32">
                  <img
                    src={preview}
                    alt="Preview"
                    className="max-h-56 max-w-full object-contain"
                    onError={() => { setImagePreview(null); setFilePreview(null) }}
                  />
                  <button
                    type="button"
                    onClick={clearFile}
                    className="absolute top-2 right-2 btn btn-ghost p-1.5 bg-white/80 dark:bg-gray-800/80 rounded-full shadow"
                  >
                    <Icon name="x" size={13} />
                  </button>
                </div>
              )}

              {/* Image URL input (when no file selected) */}
              {!selectedFile && (
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">Image URL</label>
                  <div className="relative">
                    <input
                      type="url"
                      value={formData.url}
                      onChange={(e) => applyImageUrl(e.target.value)}
                      placeholder="https://example.com/photo.jpg"
                      disabled={isLoading}
                      autoFocus={!preview}
                      className="input-field pr-20"
                    />
                    {isScraping && (
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 animate-pulse">Fetching…</span>
                    )}
                  </div>
                </div>
              )}

              {/* Upload drop zone (no file yet, no URL yet) */}
              {!formData.url && !selectedFile && (
                <div
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors cursor-pointer hover:border-primary-400 ${
                    isDragging ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20' : 'border-gray-300 dark:border-gray-600'
                  }`}
                >
                  <Icon name="upload" size={30} className="mx-auto mb-2 text-gray-400" />
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Drop an image or click to upload</p>
                  <p className="text-xs text-gray-400 mt-1">
                    {isPremium ? 'JPG, PNG, GIF, WebP — saved to cloud' : 'JPG, PNG, GIF, WebP — saved on this device'}
                  </p>
                  <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
                    onChange={(e) => e.target.files?.[0] && applyFile(e.target.files[0])} />
                </div>
              )}

              {/* Selected file info */}
              {selectedFile && (
                <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl text-sm">
                  <Icon name="image" size={18} className="text-gray-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-800 dark:text-gray-200 truncate">{selectedFile.name}</p>
                    <p className="text-xs text-gray-400">{formatBytes(selectedFile.size)}</p>
                  </div>
                  <button type="button" onClick={clearFile} className="btn btn-ghost p-1">
                    <Icon name="x" size={13} />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ── FILE MODE ── */}
          {mode === 'file' && (
            <div className="space-y-4">
              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                  isDragging ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20' : 'border-gray-300 dark:border-gray-600 hover:border-primary-400'
                }`}
              >
                <Icon name="upload" size={36} className="mx-auto mb-3 text-gray-400" />
                <p className="font-medium text-gray-700 dark:text-gray-300">Drop a file here or click to browse</p>
                <p className="text-xs text-gray-400 mt-1">
                  {isPremium ? 'PDF, DOC, XLS, images, ZIP and more — saved to cloud' : 'PDF, DOC, XLS, images, ZIP and more — saved on this device'}
                </p>
                <input ref={fileInputRef} type="file" className="hidden"
                  onChange={(e) => e.target.files?.[0] && applyFile(e.target.files[0])} />
              </div>

              {selectedFile && (
                <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl text-sm">
                  <Icon name="file" size={18} className="text-gray-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-800 dark:text-gray-200 truncate">{selectedFile.name}</p>
                    <p className="text-xs text-gray-400">{formatBytes(selectedFile.size)} · {selectedFile.type || 'unknown type'}</p>
                  </div>
                  <button type="button" onClick={clearFile} className="btn btn-ghost p-1">
                    <Icon name="x" size={13} />
                  </button>
                </div>
              )}

              {!isPremium && (
                <p className="text-xs text-gray-400 text-center">
                  Files saved on this device only.{' '}
                  <a href="/upgrade" className="text-primary-500 hover:underline">Upgrade</a> to sync across all devices.
                </p>
              )}
            </div>
          )}

          {/* Common fields */}
          {commonFields}

          {/* Actions */}
          {(
            <div className="flex gap-3 pt-2">
              <button type="submit" disabled={!canSubmit} className="flex-1 btn btn-lg btn-primary">
                {isLoading
                  ? <span className="flex items-center justify-center gap-2"><Icon name="loader" size={15} className="animate-spin" />{submitLabel}</span>
                  : submitLabel}
              </button>
              <button type="button" onClick={onClose} disabled={isLoading} className="flex-1 btn btn-lg btn-secondary">
                Cancel
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  )
}
