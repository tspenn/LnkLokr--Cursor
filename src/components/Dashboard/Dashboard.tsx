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
import { BorrowView } from './BorrowView'
import { ShareView } from './ShareView'
import { TickerTapeAd } from './TickerTapeAd'
import { EditLinkModal } from './EditLinkModal'
import { Header } from '../shared/Header'
import { Icon } from '../shared/Icon'
import { getLinksByStatus } from '@/lib/dataService'

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
  const [showSettings, setShowSettings] = useState(false)
  const [showExport, setShowExport] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [buriedLinks, setBuriedLinks] = useState<Link[]>([])
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
    setShowAddModal(true)
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

  const openBury = async () => {
    setActiveTab('bury')
    // Load buried links (URLs + OPFS files stored in links table)
    if (user) {
      const buried = await getLinksByStatus(user.is_premium ?? false, user.id, 'bury')
      setBuriedLinks(buried)
    }
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

  const handleDeleteBuriedLink = async (id: string) => {
    if (!user) return
    try {
      await deleteLink(user.is_premium ?? false, user.id, id)
      setBuriedLinks(prev => prev.filter(l => l.id !== id))
      toast.success('Removed from Bury')
    } catch {
      toast.error('Failed to delete')
    }
  }

  const handleEditLink = async (id: string, updates: Partial<import('@/types').Link>) => {
    if (!user) return
    try {
      await updateLink(user.is_premium ?? false, user.id, id, updates)
      setLinks(prev => prev.map(l => l.id === id ? { ...l, ...updates } : l))
      setBuriedLinks(prev => prev.map(l => l.id === id ? { ...l, ...updates } : l))
      setEditingLink(null)
      toast.success('Updated!')
    } catch {
      toast.error('Failed to update')
    }
  }

  const handleCreateFolder = async () => {
    if (!user || !newFolderName.trim()) return
    setCreatingFolder(true)
    try {
      await addFolder(user.is_premium ?? false, user.id, {
        name: newFolderName.trim(),
        position: folders.length,
      })
      setNewFolderName('')
      setShowNewFolder(false)
      await loadData()
      toast.success(`Folder "${newFolderName.trim()}" created`)
    } catch {
      toast.error('Failed to create folder')
    } finally {
      setCreatingFolder(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-gray-600">Loading your links...</div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50">
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

            {/* Add actions — one per type so intent is obvious */}
            <div className="space-y-3">
              <button
                onClick={() => openAddModal('link')}
                className="w-full bg-purple-200 hover:bg-purple-300 border-4 border-black rounded-full p-5 text-xl font-bold transition shadow-lg hover:shadow-xl flex items-center justify-center gap-3"
              >
                <Icon name="link" size={24} />
                Save a URL
              </button>
              <button
                onClick={() => openAddModal('image')}
                className="w-full bg-yellow-100 hover:bg-yellow-200 border-4 border-black rounded-full p-5 text-xl font-bold transition shadow-lg hover:shadow-xl flex items-center justify-center gap-3"
              >
                <Icon name="image" size={24} />
                Upload an Image
              </button>
              <button
                onClick={() => openAddModal('file')}
                className="w-full bg-green-100 hover:bg-green-200 border-4 border-black rounded-full p-5 text-xl font-bold transition shadow-lg hover:shadow-xl flex items-center justify-center gap-3"
              >
                <Icon name="file" size={24} />
                Upload a File or PDF
              </button>
            </div>

            <div className="border-t border-gray-200 pt-4 space-y-3">
              <p className="text-sm text-gray-500 text-center font-medium">Browse your collection</p>
              <button
                onClick={() => setActiveTab('links')}
                className="w-full bg-purple-100 border-4 border-black rounded-full p-5 text-xl font-medium hover:bg-purple-200 transition shadow-lg hover:shadow-xl"
              >
                URLs &amp; Images
              </button>

              <button
                onClick={() => setActiveTab('files')}
                className="w-full bg-purple-100 border-4 border-black rounded-full p-5 text-xl font-medium hover:bg-purple-200 transition shadow-lg hover:shadow-xl"
              >
                Files
              </button>

              <button
                onClick={() => setActiveTab('pdfs')}
                className="w-full bg-purple-100 border-4 border-black rounded-full p-5 text-xl font-medium hover:bg-purple-200 transition shadow-lg hover:shadow-xl"
              >
                PDFs
              </button>
            </div>

            <div className="flex justify-center pt-4">
              <img
                src="/icons/treasure_chest_transparent.png"
                alt="Treasure Chest"
                className="w-40 h-40 object-contain drop-shadow-2xl"
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
                    onClick={() => openAddModal('link')}
                    className="flex items-center gap-2 px-4 py-2 bg-purple-200 hover:bg-purple-300 border border-black rounded-lg transition font-medium"
                  >
                    <Icon name="link" size={16} />
                    URL
                  </button>
                  <button
                    onClick={() => openAddModal('image')}
                    className="flex items-center gap-2 px-4 py-2 bg-yellow-100 hover:bg-yellow-200 border border-black rounded-lg transition font-medium"
                  >
                    <Icon name="image" size={16} />
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
                            onSelectFolder={setSelectedFolderId}
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
                        <h2 className="text-lg font-semibold text-gray-900 mb-4">
                          {selectedFolderId && folders.find(f => f.id === selectedFolderId)
                            ? folders.find(f => f.id === selectedFolderId)?.name
                            : 'All Items'}
                        </h2>
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
                            <p className="text-gray-600 mb-5">Nothing saved yet</p>
                            <div className="flex flex-col items-center gap-3">
                              <button
                                onClick={() => openAddModal('link')}
                                className="inline-flex items-center gap-2 px-5 py-2.5 bg-purple-200 hover:bg-purple-300 border border-black rounded-lg transition font-medium"
                              >
                                <Icon name="link" size={16} />
                                Save a URL
                              </button>
                              <button
                                onClick={() => openAddModal('image')}
                                className="inline-flex items-center gap-2 px-5 py-2.5 bg-yellow-100 hover:bg-yellow-200 border border-black rounded-lg transition font-medium"
                              >
                                <Icon name="image" size={16} />
                                Upload an Image
                              </button>
                              <button
                                onClick={() => openAddModal('file')}
                                className="inline-flex items-center gap-2 px-5 py-2.5 bg-green-100 hover:bg-green-200 border border-black rounded-lg transition font-medium"
                              >
                                <Icon name="file" size={16} />
                                Upload a File
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
                    <SavedGallery contentType="file" onAdd={() => openAddModal('file')} />
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
                    <SavedGallery contentType="pdf" onAdd={() => openAddModal('file')} />
                  </>
                ) : activeTab === 'bury' ? (
                  <div className="space-y-8">
                    {buriedLinks.length > 0 && (
                      <div>
                        <h2 className="text-lg font-semibold text-gray-900 mb-4">URLs &amp; Local Files</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {buriedLinks.map(link => (
                            <LinkCard
                              key={link.id}
                              link={link}
                              onDelete={() => handleDeleteBuriedLink(link.id)}
                              onEdit={() => setEditingLink(link)}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                    <div>
                      {buriedLinks.length > 0 && <h2 className="text-lg font-semibold text-gray-900 mb-4">Cloud Images &amp; Files</h2>}
                      <SavedGallery contentType="image" status="bury" onAdd={() => openAddModal('image')} />
                      <SavedGallery contentType="file" status="bury" onAdd={() => openAddModal('file')} />
                    </div>
                    {buriedLinks.length === 0 && (
                      <div className="text-center py-8 text-gray-500 text-sm">
                        <p>Nothing buried yet.</p>
                        <p className="text-xs mt-1">Items you add here are password protected.</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <SavedGallery contentType="image" />
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
          currentStatus={
            activeTab === 'borrow' ? 'borrow'
            : activeTab === 'share' ? 'share'
            : activeTab === 'bury' ? 'bury'
            : 'keep'
          }
          onAdd={handleAddLink}
          onClose={() => setShowAddModal(false)}
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
