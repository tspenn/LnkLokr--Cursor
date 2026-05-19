import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import { PURCHASE_URL } from '@/lib/premiumService'
import { Link, Folder } from '@/types'
import { LinkCard } from './LinkCard'
import { FolderGrid } from './FolderGrid'
import { AddLinkModal } from './AddLinkModal'
import { SettingsPanel } from './SettingsPanel'
import { SavedGallery } from './SavedGallery'
import { ExportPanel } from './ExportPanel'
import { BorrowView } from './BorrowView'
import { Header } from '../shared/Header'
import { Icon } from '../shared/Icon'

type TabView = 'menu' | 'keep' | 'borrow' | 'links' | 'images' | 'files' | 'pdfs' | 'bury'

export function Dashboard() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<TabView>('menu')
  const [links, setLinks] = useState<Link[]>([])
  const [folders, setFolders] = useState<Folder[]>([])
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showExport, setShowExport] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [buryPassword, setBuryPassword] = useState<string | null>(null)
  const [buryUnlocked, setBuryUnlocked] = useState(false)
  const [buryPasswordInput, setBuryPasswordInput] = useState('')
  const [showBuryPasswordEntry, setShowBuryPasswordEntry] = useState(false)
  const [passwordError, setPasswordError] = useState('')

  useEffect(() => {
    if (!user) return

    const loadData = async () => {
      try {
        const [folderResponse, linkResponse, userResponse] = await Promise.all([
          supabase
            .from('folders')
            .select('*')
            .eq('user_id', user.id)
            .order('position'),
          supabase
            .from('links')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false }),
          supabase
            .from('users')
            .select('bury_password')
            .eq('id', user.id)
            .maybeSingle(),
        ])

        if (folderResponse.data) setFolders(folderResponse.data)
        if (linkResponse.data) setLinks(linkResponse.data)
        if (userResponse.data) setBuryPassword(userResponse.data.bury_password)
      } catch (error) {
        console.error('Failed to load data:', error)
      } finally {
        setIsLoading(false)
      }
    }

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

  const filteredLinks = links.filter(link => {
    const matchesFolder = !selectedFolderId || link.folder_id === selectedFolderId
    const matchesSearch = !searchQuery ||
      link.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      link.url.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesFolder && matchesSearch
  })

  const handleAddLink = async (linkData: Partial<Link>) => {
    try {
      const { error } = await supabase.from('links').insert({
        ...linkData,
        user_id: user?.id,
      })
      if (error) throw error
      setShowAddModal(false)
    } catch (error) {
      console.error('Failed to add link:', error)
    }
  }

  const handleDeleteLink = async (id: string) => {
    try {
      const { error } = await supabase.from('links').delete().eq('id', id)
      if (error) throw error
      setLinks(prev => prev.filter(link => link.id !== id))
    } catch (error) {
      console.error('Failed to delete link:', error)
    }
  }

  const handleBuryClick = () => {
    if (!buryPassword) {
      setActiveTab('bury')
      setBuryUnlocked(true)
      return
    }

    if (buryUnlocked) {
      setActiveTab('bury')
      return
    }

    setShowBuryPasswordEntry(true)
    setBuryPasswordInput('')
    setPasswordError('')
  }

  const handleBuryPasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (buryPasswordInput === buryPassword) {
      setBuryUnlocked(true)
      setShowBuryPasswordEntry(false)
      setActiveTab('bury')
      setPasswordError('')
    } else {
      setPasswordError('Incorrect password')
      setBuryPasswordInput('')
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
      />

      <main className="flex-1 bg-gradient-to-b from-white via-pink-50 to-pink-100 border-x-4 border-b-4 border-black relative overflow-auto">
        {activeTab === 'borrow' ? (
          <BorrowView />
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
          <div className="max-w-md mx-auto px-4 py-8 space-y-6">
            <div className="text-center mb-8">
              <h2 className="text-4xl font-bold mb-2" style={{ fontStyle: 'italic' }}>Keep</h2>
            </div>

            <button
              onClick={() => setActiveTab('links')}
              className="w-full bg-purple-100 border-4 border-black rounded-full p-6 text-2xl font-medium hover:bg-purple-200 transition shadow-lg hover:shadow-xl"
            >
              Save URL & Image
            </button>

            <button
              onClick={() => setActiveTab('files')}
              className="w-full bg-purple-100 border-4 border-black rounded-full p-6 text-2xl font-medium hover:bg-purple-200 transition shadow-lg hover:shadow-xl"
            >
              File Storage
            </button>

            <button
              onClick={() => setActiveTab('pdfs')}
              className="w-full bg-purple-100 border-4 border-black rounded-full p-6 text-2xl font-medium hover:bg-purple-200 transition shadow-lg hover:shadow-xl"
            >
              PDFS
            </button>

            <div className="flex justify-center pt-8">
              <img
                src="/icons/treasure_chest_transparent.png"
                alt="Treasure Chest"
                className="w-48 h-48 object-contain drop-shadow-2xl"
              />
            </div>

            <button
              onClick={() => setActiveTab('menu')}
              className="w-full flex items-center justify-center gap-2 text-gray-600 hover:text-gray-900 font-medium py-3"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M19 12H5M5 12L12 19M5 12L12 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Back to Menu
            </button>
          </div>
        ) : (
          <div className="flex flex-col h-full bg-gray-50">
            <div className="px-6 py-4 border-b border-gray-200 bg-white space-y-4">
              <button
                onClick={() => setActiveTab(activeTab === 'images' || activeTab === 'bury' ? 'menu' : 'keep')}
                className="flex items-center gap-2 text-gray-600 hover:text-gray-900 font-medium"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M19 12H5M5 12L12 19M5 12L12 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                {activeTab === 'images' || activeTab === 'bury' ? 'Back to Menu' : 'Back to Keep'}
              </button>

              {activeTab === 'links' && (
                <div className="flex gap-2">
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
                  <button
                    onClick={() => setShowAddModal(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition font-medium"
                  >
                    <Icon name="plus" size={20} />
                    Add Link
                  </button>
                </div>
              )}
            </div>

            <div className="flex-1 overflow-auto">
              <div className="p-6 max-w-7xl mx-auto">
                {activeTab === 'links' ? (
                  <>
                    {folders.length > 0 && (
                      <div className="mb-8">
                        <h2 className="text-lg font-semibold text-gray-900 mb-4">Folders</h2>
                        <FolderGrid
                          folders={folders}
                          selectedFolderId={selectedFolderId}
                          onSelectFolder={setSelectedFolderId}
                        />
                      </div>
                    )}

                    {filteredLinks.length > 0 ? (
                      <div>
                        <h2 className="text-lg font-semibold text-gray-900 mb-4">
                          {selectedFolderId && folders.find(f => f.id === selectedFolderId)
                            ? folders.find(f => f.id === selectedFolderId)?.name
                            : 'All Links'}
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {filteredLinks.map(link => (
                            <LinkCard
                              key={link.id}
                              link={link}
                              onDelete={() => handleDeleteLink(link.id)}
                            />
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-12">
                        <p className="text-gray-600 mb-4">No links yet</p>
                        <button
                          onClick={() => setShowAddModal(true)}
                          className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition font-medium"
                        >
                          <Icon name="plus" size={20} />
                          Add your first link
                        </button>
                      </div>
                    )}
                  </>
                ) : activeTab === 'files' ? (
                  <SavedGallery contentType="file" />
                ) : activeTab === 'pdfs' ? (
                  <SavedGallery contentType="pdf" />
                ) : activeTab === 'bury' ? (
                  <SavedGallery contentType="image" status="bury" />
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
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
