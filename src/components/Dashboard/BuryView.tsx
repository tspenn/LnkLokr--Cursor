import { useState, useEffect } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'
import { supabase } from '@/lib/supabase'
import { getLinksByStatus, updateLink, deleteLink, getFolders } from '@/lib/dataService'
import { Link, BorrowCategory, Folder } from '@/types'
import { Icon } from '../shared/Icon'
import { LinkCard } from './LinkCard'
import { FolderBar } from './FolderBar'
import { isProTier } from '@/lib/premiumService'

type FilterType = 'all' | 'url' | 'image' | 'file'

interface BuryViewProps {
  onShowAdd?: (mode: 'link' | 'image' | 'file') => void
  onEdit?: (link: Link) => void
}

export function BuryView({ onShowAdd, onEdit }: BuryViewProps) {
  const { user } = useAuth()
  const toast = useToast()
  const [filter, setFilter] = useState<FilterType>('all')
  const [items, setItems] = useState<Link[]>([])
  const [categories, setCategories] = useState<BorrowCategory[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [isEditingCategory, setIsEditingCategory] = useState(false)
  const [categoryName, setCategoryName] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [folders, setFolders] = useState<Folder[]>([])
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null)
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!user) return
    loadData()

    const channel = supabase
      .channel(`bury-links-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'links', filter: `user_id=eq.${user.id}` }, () => loadData())
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [user])

  const loadData = async () => {
    if (!user) return
    const isPremium = user.is_premium ?? false
    const isPro = isProTier(isPremium, user.subscription_tier)
    try {
      const [buriedLinks, categoriesRes, foldersData] = await Promise.all([
        getLinksByStatus(isPremium, user.id, 'bury'),
        supabase.from('borrow_categories').select('*').eq('user_id', user.id).order('position'),
        isPro ? getFolders(true, user.id, 'bury') : Promise.resolve([]),
      ])
      setItems(buriedLinks)
      setCategories(categoriesRes.data || [])
      if (isPro) setFolders(foldersData as Folder[])
    } catch {
      toast.error('Failed to load Bury items')
    } finally {
      setIsLoading(false)
    }
  }

  const filteredItems = items.filter(item => {
    const matchesCategory = !selectedCategory || item.category_id === selectedCategory
    const matchesFolder = !selectedFolderId || item.folder_id === selectedFolderId
    if (filter === 'all') return matchesCategory && matchesFolder
    if (filter === 'url') return matchesCategory && matchesFolder && (item.content_type === 'url' || !item.content_type)
    if (filter === 'image') return matchesCategory && matchesFolder && item.content_type === 'image'
    if (filter === 'file') return matchesCategory && matchesFolder && (item.content_type === 'file' || item.content_type === 'pdf')
    return matchesCategory && matchesFolder
  })

  const handleCreateCategory = async () => {
    if (!user || !categoryName.trim()) return
    try {
      const { error } = await supabase.from('borrow_categories').insert({
        user_id: user.id,
        name: categoryName.trim(),
        position: categories.length,
      })
      if (error) throw error
      setIsEditingCategory(false)
      setCategoryName('')
      toast.success('Category created')
      loadData()
    } catch {
      toast.error('Failed to create category')
    }
  }

  const handleAssignFolder = async (itemId: string, folderId: string | null) => {
    if (!user) return
    try {
      await updateLink(user.is_premium ?? false, user.id, itemId, { folder_id: folderId })
      toast.success(folderId ? 'Folder assigned' : 'Folder removed')
      loadData()
    } catch {
      toast.error('Failed to assign folder')
    }
  }

  const handleAssignCategory = async (itemId: string, categoryId: string | null) => {
    if (!user) return
    try {
      await updateLink(user.is_premium ?? false, user.id, itemId, { category_id: categoryId })
      toast.success(categoryId ? 'Category assigned' : 'Category removed')
      loadData()
    } catch {
      toast.error('Failed to assign category')
    }
  }

  const handleDeleteItem = async (id: string) => {
    if (!user) return
    try {
      await deleteLink(user.is_premium ?? false, user.id, id)
      toast.success('Removed from Bury')
      loadData()
    } catch {
      toast.error('Failed to delete')
    }
  }

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const handleDeleteSelected = async () => {
    if (!user || selectedIds.size === 0) return
    try {
      await Promise.all(Array.from(selectedIds).map(id => deleteLink(user.is_premium ?? false, user.id, id)))
      toast.success(`Deleted ${selectedIds.size} item${selectedIds.size !== 1 ? 's' : ''}`)
      setSelectedIds(new Set())
      setSelectMode(false)
      loadData()
    } catch {
      toast.error('Failed to delete some items')
    }
  }

  if (isLoading) {
    return <div className="flex items-center justify-center h-full"><div className="text-gray-600">Loading...</div></div>
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="bg-cyan-100 border-b-4 border-black px-6 py-4">
        <div className="max-w-7xl mx-auto">
          {/* Top row: add buttons + select/empty */}
          <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
            {onShowAdd && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onShowAdd('link')}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-100 hover:bg-cyan-200 border-2 border-black text-black rounded-lg font-medium transition text-sm"
                >
                  <Icon name="link" size={14} />
                  URL
                </button>
                <button
                  onClick={() => onShowAdd('image')}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-100 hover:bg-teal-200 border-2 border-black text-black rounded-lg font-medium transition text-sm"
                >
                  <Icon name="image" size={14} />
                  Image
                </button>
                <button
                  onClick={() => onShowAdd('file')}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-sky-100 hover:bg-sky-200 border-2 border-black text-black rounded-lg font-medium transition text-sm"
                >
                  <Icon name="file" size={14} />
                  File
                </button>
              </div>
            )}
            <div className="flex items-center gap-2">
              {items.length > 0 && (
                selectMode ? (
                  <>
                    <button onClick={() => setSelectedIds(new Set(filteredItems.map(i => i.id)))} className="px-3 py-1.5 text-sm border-2 border-black bg-white hover:bg-cyan-50 rounded-lg font-medium transition">All</button>
                    <button onClick={() => setSelectedIds(new Set())} className="px-3 py-1.5 text-sm border-2 border-black bg-white hover:bg-cyan-50 rounded-lg font-medium transition">None</button>
                    {selectedIds.size > 0 && (
                      <button onClick={handleDeleteSelected} className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-red-100 hover:bg-red-200 border-2 border-red-400 text-red-700 rounded-lg font-medium transition">
                        <Icon name="trash" size={14} />Delete {selectedIds.size}
                      </button>
                    )}
                    <button onClick={() => { setSelectMode(false); setSelectedIds(new Set()) }} className="px-3 py-1.5 text-sm border-2 border-black bg-white hover:bg-gray-100 rounded-lg font-medium transition">Done</button>
                  </>
                ) : (
                  <button onClick={() => setSelectMode(true)} className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-white border-2 border-black hover:bg-cyan-50 rounded-lg font-medium transition">
                    <Icon name="check-circle" size={14} />Select
                  </button>
                )
              )}
            </div>
          </div>

          {/* Title */}
          <h2 className="text-4xl font-bold mb-3" style={{ fontStyle: 'italic' }}>Bury</h2>

          {/* Folders row — Pro-only */}
          {isProTier(user?.is_premium ?? false, user?.subscription_tier) && (
            <div className="flex gap-2 mt-3 flex-wrap items-center">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide mr-1">Folders</span>
              <FolderBar
                scope="bury"
                userId={user!.id}
                folders={folders}
                selectedFolderId={selectedFolderId}
                onSelectFolder={setSelectedFolderId}
                onFolderCreated={(f) => setFolders(prev => [...prev, f])}
                hoverClass="hover:bg-cyan-100"
                newBtnHoverClass="hover:bg-cyan-100"
              />
            </div>
          )}

          {/* Categories row */}
          <div className="flex gap-2 flex-wrap items-center mt-3">
            {categories.length > 0 && (
              <>
                <button
                  onClick={() => setSelectedCategory(null)}
                  className={`px-4 py-2 font-medium border-4 border-black transition ${!selectedCategory ? 'bg-black text-white' : 'bg-white hover:bg-gray-100'}`}
                >All</button>
                {categories.map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`px-4 py-2 font-medium border-4 border-black transition ${selectedCategory === cat.id ? 'bg-black text-white' : 'bg-white hover:bg-gray-100'}`}
                  >{cat.name}</button>
                ))}
              </>
            )}
            {isEditingCategory ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={categoryName}
                  onChange={e => setCategoryName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleCreateCategory(); if (e.key === 'Escape') { setIsEditingCategory(false); setCategoryName('') } }}
                  className="px-3 py-1.5 text-sm font-medium border-4 border-black focus:outline-none focus:ring-2 focus:ring-cyan-400"
                  placeholder="Category name..."
                  autoFocus
                />
                <button onClick={handleCreateCategory} className="px-3 py-1.5 bg-black text-white text-sm font-bold hover:bg-gray-800 transition border-4 border-black">Save</button>
                <button onClick={() => { setIsEditingCategory(false); setCategoryName('') }} className="px-3 py-1.5 bg-white text-sm font-bold border-4 border-black hover:bg-gray-100 transition">✕</button>
              </div>
            ) : (
              <button
                onClick={() => { setIsEditingCategory(true); setCategoryName('') }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium border-4 border-black bg-white hover:bg-cyan-100 transition"
              >
                <Icon name="plus" size={14} />New Category
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Filter bar */}
      <div className="bg-cyan-50 border-b-4 border-black px-6 py-3">
        <div className="max-w-7xl mx-auto flex gap-2 flex-wrap">
          {(['all', 'url', 'image', 'file'] as FilterType[]).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`flex items-center gap-2 px-4 py-2 font-medium border-4 border-black transition capitalize ${filter === f ? 'bg-black text-white' : 'bg-white hover:bg-gray-100'}`}
            >
              {f === 'url' && <Icon name="link" size={18} />}
              {f === 'image' && <Icon name="image" size={18} />}
              {f === 'file' && <Icon name="file" size={18} />}
              {f === 'all' ? 'All' : f === 'url' ? 'URLs' : f === 'image' ? 'Images' : 'Files'}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto">
          {filteredItems.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredItems.map(item => {
                const isSelected = selectedIds.has(item.id)
                return (
                  <div
                    key={item.id}
                    onClick={selectMode ? () => toggleSelect(item.id) : undefined}
                    className={`relative ${selectMode ? 'cursor-pointer' : ''} ${isSelected ? 'ring-4 ring-cyan-400 ring-offset-2' : ''}`}
                  >
                    {selectMode && (
                      <div className={`absolute top-2 left-2 z-10 w-6 h-6 rounded-full border-2 border-black flex items-center justify-center ${isSelected ? 'bg-cyan-400' : 'bg-white'}`}>
                        {isSelected && <Icon name="check-circle" size={12} className="text-white" />}
                      </div>
                    )}
                    <LinkCard
                      link={item}
                      onDelete={() => handleDeleteItem(item.id)}
                      onEdit={onEdit ? () => onEdit(item) : undefined}
                      extraMenu={folders.length > 0 || categories.length > 0 ? (
                        <>
                          {folders.length > 0 && (
                            <div className="border-t border-gray-100">
                              <p className="px-4 py-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">Folder</p>
                              <button onClick={() => handleAssignFolder(item.id, null)}
                                className={`w-full px-4 py-2 text-left hover:bg-gray-100 text-sm ${!item.folder_id ? 'font-bold' : ''}`}>None</button>
                              {folders.map(f => (
                                <button key={f.id} onClick={() => handleAssignFolder(item.id, f.id)}
                                  className={`w-full px-4 py-2 text-left hover:bg-gray-100 text-sm ${item.folder_id === f.id ? 'font-bold text-cyan-700' : ''}`}>
                                  {item.folder_id === f.id ? '✓ ' : ''}{f.icon ? `${f.icon} ` : ''}{f.name}
                                </button>
                              ))}
                            </div>
                          )}
                          {categories.length > 0 && (
                            <div className="border-t border-gray-100">
                              <p className="px-4 py-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">Category</p>
                              <button onClick={() => handleAssignCategory(item.id, null)}
                                className={`w-full px-4 py-2 text-left hover:bg-gray-100 text-sm ${!item.category_id ? 'font-bold' : ''}`}>None</button>
                              {categories.map(cat => (
                                <button key={cat.id} onClick={() => handleAssignCategory(item.id, cat.id)}
                                  className={`w-full px-4 py-2 text-left hover:bg-gray-100 text-sm ${item.category_id === cat.id ? 'font-bold text-cyan-700' : ''}`}>
                                  {item.category_id === cat.id ? '✓ ' : ''}{cat.name}
                                </button>
                              ))}
                            </div>
                          )}
                        </>
                      ) : null}
                    />
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="text-center py-16">
              <div className="text-6xl mb-4">🔒</div>
              <p className="text-gray-600 text-lg mb-2">Nothing buried yet</p>
              <p className="text-gray-500 text-sm mb-8">Items you save here are protected by your Bury password</p>
              {onShowAdd && (
                <div className="flex flex-col items-center gap-3">
                  <button onClick={() => onShowAdd('link')} className="inline-flex items-center gap-2 px-5 py-2.5 bg-cyan-100 hover:bg-cyan-200 border-2 border-black text-black rounded-lg transition font-medium">
                    <Icon name="link" size={16} />Save a URL
                  </button>
                  <button onClick={() => onShowAdd('image')} className="inline-flex items-center gap-2 px-5 py-2.5 bg-teal-100 hover:bg-teal-200 border-2 border-black text-black rounded-lg transition font-medium">
                    <Icon name="image" size={16} />Upload an Image
                  </button>
                  <button onClick={() => onShowAdd('file')} className="inline-flex items-center gap-2 px-5 py-2.5 bg-sky-100 hover:bg-sky-200 border-2 border-black text-black rounded-lg transition font-medium">
                    <Icon name="file" size={16} />Upload a File
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
