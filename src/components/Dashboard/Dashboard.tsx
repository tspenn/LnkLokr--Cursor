import React, { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'
import { supabase } from '@/lib/supabase'
import { PURCHASE_URL } from '@/lib/premiumService'
import { getLinks, getFolders, addLink, addFolder, updateLink, deleteLink } from '@/lib/dataService'
import { Link, Folder } from '@/types'
import { LinkCard } from './LinkCard'
import { FolderGrid } from './FolderGrid'
import { AddLinkModal } from './AddLinkModal'
import { SettingsPanel } from './SettingsPanel'
import { SavedGallery } from './SavedGallery'
import { ExportPanel } from './ExportPanel'
import { downloadFolderCsv } from '@/lib/exportCsv'
import { BorrowView } from './BorrowView'
import { BuryView } from './BuryView'
import { ShareView } from './ShareView'
import { TickerTapeAd } from './TickerTapeAd'
import { EditLinkModal } from './EditLinkModal'
import { Header } from '../shared/Header'
import { Icon } from '../shared/Icon'


type TabView = 'menu' | 'keep' | 'borrow' | 'share' | 'links' | 'files' | 'pdfs' | 'bury'

export function Dashboard() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const [activeTab, setActiveTab] = useState<TabView>('menu')
  const [links, setLinks] = useState<Link[]>([])
  const [folders, setFolders] = useState<Folder[]>([])
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('')
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [addModalMode, setAddModalMode] = useState<'link' | 'image' | 'file'>('link')
  const [pastedUrl, setPastedUrl] = useState<string | undefined>()
  const [pastedFile, setPastedFile] = useState<File | undefined>()
  const [rightClickMenu, setRightClickMenu] = useState<{ x: number; y: number } | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [showExport, setShowExport] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  const [buryPassword, setBuryPassword] = useState<string | null>(null)
  const [buryUnlocked, setBuryUnlocked] = useState(false)
  const [buryPasswordInput, setBuryPasswordInput] = useState('')
  const [showBuryPasswordEntry, setShowBuryPasswordEntry] = useState(false)
  const [showSetBuryPassword, setShowSetBuryPassword] = useState(false)
  const [newBuryPassword, setNewBuryPassword] = useState('')
  const [newBuryPasswordConfirm, setNewBuryPasswordConfirm] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [editingLink, setEditingLink] = useState<import('@/types').Link | null>(null)
  const [newFolderName, setNewFolderName] = useState('')
  const [showNewFolder, setShowNewFolder] = useState(false)
  const [creatingFolder, setCreatingFolder] = useState(false)

  const loadData = async () => {
    if (!user) return
    try {
      const isPremium = user.is_premium ?? false

      const [fetchedFolders, fetchedLinks] = await Promise.all([
        getFolders(isPremium, user.id),
        getLinks(isPremium, user.id),
      ])

      setFolders(fetchedFolders)
      // Keep view: only show items with status 'keep' (or no status set)
      setLinks(fetchedLinks.filter(l => !l.status || l.status === 'keep'))

      // Load bury password for all users
      const { data: userRow } = await supabase
        .from('users')
        .select('bury_password')
        .eq('id', user.id)
        .maybeSingle()
      if (userRow) setBuryPassword(userRow.bury_password)
    } catch (error) {
      toast.error('Failed to load your links')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (!user) return

    loadData()


    const channel = supabase
      .channel(`links-${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'links', filter: `user_id=eq.${user.id}` },
        () => loadData()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user])

  // Debounce search 300 ms so we don't re-filter on every keystroke
  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current)
    searchDebounceRef.current = setTimeout(() => setDebouncedSearchQuery(searchQuery), 300)
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current)
    }
  }, [searchQuery])

  const filteredLinks = links.filter(link => {
    const matchesFolder = !selectedFolderId || link.folder_id === selectedFolderId
    const q = debouncedSearchQuery.toLowerCase()
    const matchesSearch = !q ||
      link.title.toLowerCase().includes(q) ||
      link.url.toLowerCase().includes(q) ||
      (link.description ?? '').toLowerCase().includes(q) ||
      (link.tags ?? []).some(t => t.toLowerCase().includes(q))
    return matchesFolder && matchesSearch
  })

  const openAddModal = (mode: 'link' | 'image' | 'file' = 'link') => {
    setAddModalMode(mode)
    setPastedUrl(undefined)
    setPastedFile(undefined)
    setShowAddModal(true)
  }

  // Global Ctrl+V / paste — opens the add modal with pre-loaded content
  useEffect(() => {
    const handleGlobalPaste = (e: ClipboardEvent) => {
      // Don't intercept if user is typing in an input/textarea
      const target = e.target as HTMLElement
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable ||
        showAddModal
      ) return

      const items = e.clipboardData?.items
      if (!items) return

      // Image data (screenshot, copied image)
      for (const item of Array.from(items)) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile()
          if (file) {
            setPastedFile(file)
            setPastedUrl(undefined)
            setAddModalMode('image')
            setShowAddModal(true)
            return
          }
        }
      }

      // Text (URL or plain text)
      for (const item of Array.from(items)) {
        if (item.type === 'text/plain') {
          item.getAsString((text) => {
            const trimmed = text.trim()
            if (!trimmed) return
            setPastedUrl(trimmed)
            setPastedFile(undefined)
            const isImageUrl = /\.(jpe?g|png|gif|webp|svg|avif|bmp|ico)(\?.*)?$/i.test(trimmed)
            setAddModalMode(isImageUrl ? 'image' : 'link')
            setShowAddModal(true)
          })
          return
        }
      }
    }

    window.addEventListener('paste', handleGlobalPaste)
    return () => window.removeEventListener('paste', handleGlobalPaste)
  }, [showAddModal])

  // Right-click paste from clipboard (image data or URL)
  const handleRightClickPaste = async () => {
    setRightClickMenu(null)
    try {
      const clipboardItems = await navigator.clipboard.read()
      for (const item of clipboardItems) {
        const imageType = item.types.find(t => t.startsWith('image/'))
        if (imageType) {
          const blob = await item.getType(imageType)
          const file = new File([blob], 'pasted-image.png', { type: blob.type })
          setPastedFile(file)
          setPastedUrl(undefined)
          setAddModalMode('image')
          setShowAddModal(true)
          return
        }
        if (item.types.includes('text/plain')) {
          const blob = await item.getType('text/plain')
          const text = (await blob.text()).trim()
          if (!text) return
          setPastedUrl(text)
          setPastedFile(undefined)
          const isImageUrl = /\.(jpe?g|png|gif|webp|svg|avif|bmp|ico)(\?.*)?$/i.test(text)
          setAddModalMode(isImageUrl ? 'image' : 'link')
          setShowAddModal(true)
          return
        }
      }
    } catch {
      // Clipboard permission denied or empty — ignore
    }
  }

  const handleAddLink = async (linkData: Partial<Link>) => {
    if (!user) return
    try {
      await addLink(user.is_premium ?? false, user.id, linkData)
      setShowAddModal(false)
      toast.success('Saved!')
      await loadData()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save'
      toast.error(message)
      throw error
    }
  }

  const handleDeleteLink = async (id: string) => {
    if (!user) return
    try {
      await deleteLink(user.is_premium ?? false, user.id, id)
      setLinks(prev => prev.filter(link => link.id !== id))
      toast.success('Link removed')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete link'
      toast.error(message)
    }
  }

  const openBury = () => {
    setActiveTab('bury')
  }

  const handleBuryClick = () => {
    if (!buryPassword) {
      // No password set yet — require them to create one first
      setNewBuryPassword('')
      setNewBuryPasswordConfirm('')
      setPasswordError('')
      setShowSetBuryPassword(true)
      return
    }
    if (buryUnlocked) {
      openBury()
      return
    }
    setShowBuryPasswordEntry(true)
    setBuryPasswordInput('')
    setPasswordError('')
  }

  const handleSetBuryPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newBuryPassword.trim()) {
      setPasswordError('Please enter a password')
      return
    }
    if (newBuryPassword !== newBuryPasswordConfirm) {
      setPasswordError('Passwords do not match')
      return
    }
    if (!user) return
    try {
      const { error } = await supabase
        .from('users')
        .update({ bury_password: newBuryPassword })
        .eq('id', user.id)
      if (error) throw error
      setBuryPassword(newBuryPassword)
      setBuryUnlocked(true)
      setShowSetBuryPassword(false)
      setPasswordError('')
      openBury()
      toast.success('Bury password set!')
    } catch {
      toast.error('Failed to save password')
    }
  }

  const handleBuryPasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (buryPasswordInput === buryPassword) {
      setBuryUnlocked(true)
      setShowBuryPasswordEntry(false)
      openBury()
      setPasswordError('')
    } else {
      setPasswordError('Incorrect password')
      setBuryPasswordInput('')
    }
  }

  const handleEditLink = async (id: string, updates: Partial<import('@/types').Link>) => {
    if (!user) return
    try {
      await updateLink(user.is_premium ?? false, user.id, id, updates)
      setLinks(prev => prev.map(l => l.id === id ? { ...l, ...updates } : l))
      setEditingLink(null)
      toast.success('Updated!')
    } catch {
      toast.error('Failed to update')
    }
  }

  const handleCreateFolder = async () => {
    if (!user || !newFolderName.trim()) return
    const name = newFolderName.trim()
    setCreatingFolder(true)
    try {
      await addFolder(user.is_premium ?? false, user.id, {
        name,
        position: folders.length,
        scope: 'keep',
      })
      setNewFolderName('')
      setShowNewFolder(false)
      await loadData()
      toast.success(`Folder "${name}" created`)
    } catch {
      toast.error('Failed to create folder')
    } finally {
      setCreatingFolder(false)
    }
  }

  const openFolder = (folderId: string | null) => {
    setSelectedFolderId(folderId)
    setActiveTab('links')
  }

  const handleExportFolder = (folder: Folder) => {
    const folderLinks = links.filter(link => link.folder_id === folder.id)
    if (folderLinks.length === 0) {
      toast.error(`“${folder.name}” is empty`)
      return
    }
    downloadFolderCsv(folderLinks, folder.name)
    toast.success(`Exported ${folderLinks.length} link${folderLinks.length === 1 ? '' : 's'} from ${folder.name}`)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-gray-600">Loading your links...</div>
      </div>
    )
  }

  return (
    <div
      className="flex flex-col h-screen bg-gray-50"
      onContextMenu={e => {
        const target = e.target as HTMLElement
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return
        e.preventDefault()
        setRightClickMenu({ x: e.clientX, y: e.clientY })
      }}
      onClick={() => setRightClickMenu(null)}
    >
      {rightClickMenu && (
        <div
          className="fixed z-[9999] bg-white border-2 border-black shadow-lg rounded-lg overflow-hidden"
          style={{ left: rightClickMenu.x, top: rightClickMenu.y }}
          onClick={e => e.stopPropagation()}
        >
          <button
            className="flex items-center gap-2 w-full px-4 py-2.5 text-sm font-medium hover:bg-pink-50 text-gray-800"
            onClick={handleRightClickPaste}
          >
            <span className="text-base">📋</span> Paste image or URL
          </button>
        </div>
      )}
      <Header
        email={user?.email}
        isPremium={user?.is_premium}
        onUpgrade={() => window.open(PURCHASE_URL, '_blank', 'noopener,noreferrer')}
        onSettings={() => setShowSettings(true)}
        onSignOut={signOut}
        onBack={activeTab !== 'menu' ? () => setActiveTab('menu') : undefined}
      />

      <main className={`flex-1 bg-gradient-to-b from-white via-pink-50 to-pink-100 border-x-4 border-b-4 border-black relative overflow-auto ${!user?.is_premium ? 'pb-12' : ''}`}>
        {activeTab === 'share' ? (
          <ShareView onBack={() => setActiveTab('menu')} />
        ) : activeTab === 'borrow' ? (
          <BorrowView onBack={() => setActiveTab('menu')} onShowAdd={(mode) => openAddModal(mode)} />
        ) : activeTab === 'menu' ? (
          <div className="max-w-md mx-auto px-4 py-8 pb-16 space-y-6">
            <button
              onClick={() => setActiveTab('keep')}
              className="w-full bg-yellow-100 border-4 border-black p-6 flex items-center justify-between text-3xl font-bold text-gray-900 hover:bg-yellow-200 transition shadow-lg hover:shadow-xl"
              style={{ fontStyle: 'italic' }}
            >
              <span className="flex items-center gap-4">
                <img
                  src="/icons/treasure_chest_transparent.png"
                  alt="Keep"
                  className="w-12 h-12 object-contain"
                />
                Keep
              </span>
            </button>

            <button
              onClick={() => setActiveTab('borrow')}
              className="w-full bg-purple-200 border-4 border-black p-6 flex items-center gap-4 text-3xl font-bold text-gray-900 hover:bg-purple-300 transition shadow-lg hover:shadow-xl"
              style={{ fontStyle: 'italic' }}
            >
              <img
                src="/icons/basket.png"
                alt="Borrow"
                className="w-12 h-12 object-contain"
              />
              Borrow
            </button>

            <button
              onClick={() => setActiveTab('share')}
              className="w-full bg-pink-300 border-4 border-black p-6 flex items-center justify-between text-3xl font-bold text-gray-900 hover:bg-pink-400 transition shadow-lg hover:shadow-xl"
              style={{ fontStyle: 'italic' }}
            >
              <span className="flex items-center gap-4">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect x="7" y="11" width="10" height="9" rx="1" stroke="#000" strokeWidth="2"/>
                  <path d="M8 11V8C8 5.79086 9.79086 4 12 4C14.2091 4 16 5.79086 16 8V9" stroke="#000" strokeWidth="2"/>
                </svg>
                Share
              </span>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M5 12H19M19 12L12 5M19 12L12 19" stroke="#000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>

            <button
              onClick={handleBuryClick}
              className="w-full bg-cyan-200 border-4 border-black p-6 flex items-center gap-4 text-3xl font-bold text-gray-900 hover:bg-cyan-300 transition shadow-lg hover:shadow-xl"
              style={{ fontStyle: 'italic' }}
            >
              <img
                src="/icons/combination_lock.png"
                alt="Bury"
                className="w-12 h-12 object-contain"
              />
              Bury
            </button>

            <button
              onClick={() => navigate('/dreamkeeper')}
              className="w-full bg-amber-100 border-4 border-black p-6 flex items-center gap-4 text-3xl font-bold text-gray-900 hover:bg-amber-200 transition shadow-lg hover:shadow-xl"
              style={{ fontStyle: 'italic' }}
            >
              <span className="text-4xl">📋</span>
              Dream Keeper
            </button>


            <div className="flex justify-center pt-12 pb-8">
              <img
                src="/icons/treasure_chest_transparent.png"
                alt="Treasure Chest"
                className="w-56 h-56 object-contain drop-shadow-2xl"
              />
            </div>
          </div>
        ) : activeTab === 'keep' ? (
          <div className="max-w-md mx-auto px-4 py-8 space-y-4">
            <div className="text-center mb-6">
              <h2 className="text-4xl font-bold mb-2" style={{ fontStyle: 'italic' }}>Keep</h2>
            </div>

            <button
              type="button"
              onClick={handleRightClickPaste}
              className="w-full bg-purple-200 hover:bg-purple-300 border-4 border-black rounded-2xl px-5 py-8 text-center shadow-lg hover:shadow-xl transition"
            >
              <p className="text-2xl sm:text-3xl font-bold text-gray-900">
                Press <kbd className="px-2 py-0.5 bg-white border-2 border-black rounded-lg font-mono">Ctrl+V</kbd>
              </p>
              <p className="mt-2 text-sm sm:text-base font-medium text-gray-800">
                anywhere to save a copied URL or image
              </p>
              <p className="mt-1 text-xs text-gray-600">or click here to paste</p>
            </button>

            <div className="flex justify-center gap-3 text-xs sm:text-sm text-gray-500">
              <button
                type="button"
                onClick={() => openAddModal('image')}
                className="hover:text-gray-800 underline-offset-2 hover:underline"
              >
                Upload an image
              </button>
              <span aria-hidden className="text-gray-300">·</span>
              <button
                type="button"
                onClick={() => openAddModal('file')}
                className="hover:text-gray-800 underline-offset-2 hover:underline"
              >
                Upload a file or PDF
              </button>
            </div>

            <div className="border-t border-gray-200 pt-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-500 font-medium">Folders</p>
                {!showNewFolder && (
                  <button
                    onClick={() => setShowNewFolder(true)}
                    className="flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700 font-medium"
                  >
                    <Icon name="plus" size={15} /> New folder
                  </button>
                )}
              </div>

              {showNewFolder && (
                <form
                  onSubmit={e => { e.preventDefault(); handleCreateFolder() }}
                  className="flex gap-2"
                >
                  <input
                    autoFocus
                    type="text"
                    value={newFolderName}
                    onChange={e => setNewFolderName(e.target.value)}
                    placeholder="Folder name"
                    className="flex-1 px-3 py-2 border-2 border-black rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                  <button
                    type="submit"
                    disabled={creatingFolder || !newFolderName.trim()}
                    className="px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition border-2 border-black"
                  >
                    {creatingFolder ? '…' : 'Create'}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowNewFolder(false); setNewFolderName('') }}
                    className="px-3 py-2 text-gray-500 hover:text-gray-700 rounded-lg text-sm"
                  >
                    Cancel
                  </button>
                </form>
              )}

              {folders.length > 0 ? (
                <FolderGrid
                  folders={folders}
                  selectedFolderId={null}
                  onSelectFolder={openFolder}
                  onExportFolder={handleExportFolder}
                />
              ) : !showNewFolder && (
                <button
                  onClick={() => setShowNewFolder(true)}
                  className="w-full py-4 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:text-primary-600 hover:border-primary-300 transition"
                >
                  Create your first folder to organize saves
                </button>
              )}
            </div>

            <div className="border-t border-gray-200 pt-3 space-y-1.5">
              <p className="text-xs text-gray-400 text-center">Browse your collection</p>
              <button
                onClick={() => setActiveTab('links')}
                className="w-full bg-white/80 border border-gray-300 rounded-lg py-2 text-sm text-gray-600 hover:bg-gray-50 hover:text-gray-800 transition"
              >
                URLs &amp; Images
              </button>
              <button
                onClick={() => setActiveTab('files')}
                className="w-full bg-white/80 border border-gray-300 rounded-lg py-2 text-sm text-gray-600 hover:bg-gray-50 hover:text-gray-800 transition"
              >
                Files
              </button>
              <button
                onClick={() => setActiveTab('pdfs')}
                className="w-full bg-white/80 border border-gray-300 rounded-lg py-2 text-sm text-gray-600 hover:bg-gray-50 hover:text-gray-800 transition"
              >
                PDFs
              </button>
            </div>

            <div className="flex justify-center pt-2">
              <img
                src="/icons/treasure_chest_transparent.png"
                alt=""
                className="w-16 h-16 object-contain opacity-40"
              />
            </div>

          </div>
        ) : (
          <div className="flex flex-col h-full bg-gray-50">
            <div className="px-6 py-4 border-b border-gray-200 bg-white space-y-4">
              <button
                onClick={() => setActiveTab(activeTab === 'bury' ? 'menu' : 'keep')}
                className="flex items-center gap-2 text-gray-600 hover:text-gray-900 font-medium"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M19 12H5M5 12L12 19M5 12L12 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                {activeTab === 'bury' ? 'Back to Menu' : 'Back to Keep'}
              </button>

              {(activeTab === 'links' || activeTab === 'bury') && (
                <div className="flex gap-2">
                  {activeTab === 'links' && (
                    <div className="flex-1 relative">
                      <Icon name="search" size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Search links..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition"
                      />
                    </div>
                  )}
                  <button
                    onClick={() => openAddModal('image')}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
                  >
                    <Icon name="image" size={14} />
                    Image
                  </button>
                </div>
              )}
            </div>

            <div className="flex-1 overflow-auto">
              <div className="p-6 max-w-7xl mx-auto">
                {activeTab === 'links' ? (
                  <>
                    <div className="mb-6">
                      {folders.length > 0 && (
                        <div className="mb-6">
                          <div className="flex items-center justify-between mb-3">
                            <h2 className="text-lg font-semibold text-gray-900">Folders</h2>
                            <button
                              onClick={() => setShowNewFolder(v => !v)}
                              className="flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700 font-medium"
                            >
                              <Icon name="plus" size={15} /> New folder
                            </button>
                          </div>
                          <FolderGrid
                            folders={folders}
                            selectedFolderId={selectedFolderId}
                            onSelectFolder={openFolder}
                            onExportFolder={handleExportFolder}
                          />
                        </div>
                      )}

                      {/* New folder input */}
                      {showNewFolder ? (
                        <form
                          onSubmit={e => { e.preventDefault(); handleCreateFolder() }}
                          className="flex gap-2 mb-4"
                        >
                          <input
                            autoFocus
                            type="text"
                            value={newFolderName}
                            onChange={e => setNewFolderName(e.target.value)}
                            placeholder="Folder name"
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                          />
                          <button
                            type="submit"
                            disabled={creatingFolder || !newFolderName.trim()}
                            className="px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition"
                          >
                            {creatingFolder ? '…' : 'Create'}
                          </button>
                          <button
                            type="button"
                            onClick={() => { setShowNewFolder(false); setNewFolderName('') }}
                            className="px-3 py-2 text-gray-500 hover:text-gray-700 rounded-lg text-sm"
                          >
                            Cancel
                          </button>
                        </form>
                      ) : folders.length === 0 && (
                        <button
                          onClick={() => setShowNewFolder(true)}
                          className="flex items-center gap-1 text-sm text-gray-500 hover:text-primary-600 mb-4 font-medium"
                        >
                          <Icon name="plus" size={15} /> Create a folder
                        </button>
                      )}
                    </div>

                    {filteredLinks.length > 0 ? (
                      <div>
                        <div className="flex items-center justify-between gap-3 mb-4">
                          <h2 className="text-lg font-semibold text-gray-900">
                            {selectedFolderId && folders.find(f => f.id === selectedFolderId)
                              ? folders.find(f => f.id === selectedFolderId)?.name
                              : 'All Items'}
                          </h2>
                          {selectedFolderId && (
                            <button
                              type="button"
                              onClick={() => {
                                const folder = folders.find(f => f.id === selectedFolderId)
                                if (folder) handleExportFolder(folder)
                              }}
                              className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 font-medium"
                            >
                              <Icon name="download" size={15} />
                              Export CSV
                            </button>
                          )}
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {filteredLinks.map(link => (
                            <LinkCard
                              key={link.id}
                              link={link}
                              onDelete={() => handleDeleteLink(link.id)}
                              onEdit={() => setEditingLink(link)}
                            />
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-12">
                        {debouncedSearchQuery ? (
                          <>
                            <p className="text-gray-600 mb-2">No links match &ldquo;{debouncedSearchQuery}&rdquo;</p>
                            <button
                              onClick={() => setSearchQuery('')}
                              className="text-sm text-primary-600 hover:underline"
                            >
                              Clear search
                            </button>
                          </>
                        ) : (
                          <>
                            <p className="text-gray-600 mb-3">Nothing saved yet</p>
                            <p className="text-lg font-bold text-gray-900 mb-4">
                              Press <kbd className="px-1.5 py-0.5 bg-white border-2 border-black rounded font-mono text-base">Ctrl+V</kbd> to save
                            </p>
                            <div className="flex justify-center gap-3 text-sm text-gray-500">
                              <button
                                type="button"
                                onClick={() => openAddModal('image')}
                                className="hover:text-gray-800 underline-offset-2 hover:underline"
                              >
                                Upload an image
                              </button>
                              <span aria-hidden className="text-gray-300">·</span>
                              <button
                                type="button"
                                onClick={() => openAddModal('file')}
                                className="hover:text-gray-800 underline-offset-2 hover:underline"
                              >
                                Upload a file
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </>
                ) : activeTab === 'files' ? (
                  <>
                    {links.filter(l => l.content_type === 'file').length > 0 && (
                      <div className="mb-8">
                        <h2 className="text-lg font-semibold text-gray-900 mb-4">Files on this device</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {links.filter(l => l.content_type === 'file').map(link => (
                            <LinkCard key={link.id} link={link} onDelete={() => handleDeleteLink(link.id)} onEdit={() => setEditingLink(link)} />
                          ))}
                        </div>
                      </div>
                    )}
                    <SavedGallery contentType="file" status="keep" onAdd={() => openAddModal('file')} />
                  </>
                ) : activeTab === 'pdfs' ? (
                  <>
                    {links.filter(l => l.content_type === 'pdf').length > 0 && (
                      <div className="mb-8">
                        <h2 className="text-lg font-semibold text-gray-900 mb-4">PDFs on this device</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {links.filter(l => l.content_type === 'pdf').map(link => (
                            <LinkCard key={link.id} link={link} onDelete={() => handleDeleteLink(link.id)} onEdit={() => setEditingLink(link)} />
                          ))}
                        </div>
                      </div>
                    )}
                    <SavedGallery contentType="pdf" status="keep" onAdd={() => openAddModal('file')} />
                  </>
                ) : activeTab === 'bury' ? (
                  <BuryView
                    onShowAdd={(mode) => openAddModal(mode)}
                    onEdit={(link) => setEditingLink(link)}
                  />
                ) : (
                  <SavedGallery contentType="image" status="keep" />
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {showAddModal && (
        <AddLinkModal
          folders={folders}
          isPremium={user?.is_premium ?? false}
          userId={user?.id ?? ''}
          initialMode={addModalMode}
          initialUrl={pastedUrl}
          initialFile={pastedFile}
          currentStatus={
            activeTab === 'borrow' ? 'borrow'
            : activeTab === 'share' ? 'share'
            : activeTab === 'bury' ? 'bury'
            : 'keep'
          }
          folderScope={
            activeTab === 'borrow' ? 'borrow'
            : activeTab === 'share' ? 'share'
            : activeTab === 'bury' ? 'bury'
            : 'keep'
          }
          onAdd={handleAddLink}
          onClose={() => { setShowAddModal(false); setPastedUrl(undefined); setPastedFile(undefined) }}
        />
      )}

      {showSettings && (
        <SettingsPanel
          onClose={() => setShowSettings(false)}
          onExportClick={() => setShowExport(true)}
        />
      )}

      {showExport && (
        <ExportPanel onClose={() => setShowExport(false)} />
      )}

      {!user?.is_premium && (
        <TickerTapeAd onUpgradeClick={() => setShowSettings(true)} />
      )}

      {editingLink && user && (
        <EditLinkModal
          link={editingLink}
          folders={folders}
          onSave={(updates) => handleEditLink(editingLink.id, updates)}
          onClose={() => setEditingLink(null)}
        />
      )}

      {showBuryPasswordEntry && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-8 border-4 border-black">
            <h2 className="text-3xl font-bold mb-6 text-center" style={{ fontStyle: 'italic' }}>
              Enter Bury Password
            </h2>

            <form onSubmit={handleBuryPasswordSubmit} className="space-y-6">
              <div>
                <div className="relative">
                  <svg
                    width="40"
                    height="40"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                  >
                    <rect x="7" y="11" width="10" height="9" rx="1" stroke="currentColor" strokeWidth="2"/>
                    <path d="M8 11V7C8 5.23858 9.23858 4 11 4H13C14.7614 4 16 5.23858 16 7V11" stroke="currentColor" strokeWidth="2"/>
                    <circle cx="12" cy="15" r="1.5" fill="currentColor"/>
                  </svg>
                  <input
                    type="password"
                    value={buryPasswordInput}
                    onChange={(e) => setBuryPasswordInput(e.target.value)}
                    placeholder="Lock password goes here"
                    className="w-full pl-16 pr-4 py-4 border-4 border-black text-lg focus:ring-4 focus:ring-cyan-200 transition"
                    autoFocus
                  />
                </div>
                {passwordError && (
                  <p className="text-red-600 text-sm mt-2">{passwordError}</p>
                )}
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowBuryPasswordEntry(false)
                    setBuryPasswordInput('')
                    setPasswordError('')
                  }}
                  className="flex-1 px-6 py-3 border-4 border-black bg-gray-100 hover:bg-gray-200 font-bold text-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-6 py-3 border-4 border-black bg-cyan-200 hover:bg-cyan-300 font-bold text-lg transition"
                >
                  Unlock
                </button>
              </div>
              <p className="text-center text-sm text-gray-500 pt-2">
                Forgot your password?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setShowBuryPasswordEntry(false)
                    setShowSetBuryPassword(true)
                    setNewBuryPassword('')
                    setNewBuryPasswordConfirm('')
                    setPasswordError('')
                  }}
                  className="text-purple-600 hover:underline font-medium"
                >
                  Reset it
                </button>
              </p>
            </form>
          </div>
        </div>
      )}

      {showSetBuryPassword && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-8 border-4 border-black">
            <h2 className="text-3xl font-bold mb-2 text-center" style={{ fontStyle: 'italic' }}>
              {buryPassword ? 'Reset Bury Password' : 'Set a Bury Password'}
            </h2>
            <p className="text-sm text-gray-500 text-center mb-6">
              {buryPassword
                ? 'Enter a new password to replace the current one.'
                : 'Bury keeps your private items behind a password. Set one now to continue.'}
            </p>

            <form onSubmit={handleSetBuryPassword} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">New password</label>
                <input
                  type="password"
                  value={newBuryPassword}
                  onChange={(e) => setNewBuryPassword(e.target.value)}
                  placeholder="Choose a password"
                  className="w-full px-4 py-3 border-4 border-black text-lg focus:ring-4 focus:ring-purple-200 transition"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Confirm password</label>
                <input
                  type="password"
                  value={newBuryPasswordConfirm}
                  onChange={(e) => setNewBuryPasswordConfirm(e.target.value)}
                  placeholder="Repeat password"
                  className="w-full px-4 py-3 border-4 border-black text-lg focus:ring-4 focus:ring-purple-200 transition"
                />
              </div>
              {passwordError && (
                <p className="text-red-600 text-sm">{passwordError}</p>
              )}
              <p className="text-xs text-gray-400">
                You can also view or change your Bury password in Settings at any time.
              </p>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowSetBuryPassword(false); setPasswordError('') }}
                  className="flex-1 px-6 py-3 border-4 border-black bg-gray-100 hover:bg-gray-200 font-bold text-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-6 py-3 border-4 border-black bg-purple-200 hover:bg-purple-300 font-bold text-lg transition"
                >
                  {buryPassword ? 'Reset' : 'Set Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
