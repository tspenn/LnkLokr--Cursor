import { useState, useEffect } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'
import { supabase } from '@/lib/supabase'
import { getLinksByStatus, updateLink, deleteLink } from '@/lib/dataService'
import { Link, SavedItem, BorrowCategory } from '@/types'
import { Icon } from '../shared/Icon'

type FilterType = 'all' | 'url' | 'image' | 'file'

interface BorrowItem {
  id: string
  type: 'link' | 'saved_item'
  title: string
  url?: string
  thumbnail?: string | null
  icon?: string | null
  content_type: string
  file_name?: string
  file_size?: number
  created_at: string
  category_id: string | null
}

interface BorrowViewProps {
  onBack?: () => void
  onShowAdd?: (mode: 'link' | 'image' | 'file') => void
}

export function BorrowView({ onBack, onShowAdd }: BorrowViewProps) {
  const { user } = useAuth()
  const toast = useToast()
  const [filter, setFilter] = useState<FilterType>('all')
  const [items, setItems] = useState<BorrowItem[]>([])
  const [categories, setCategories] = useState<BorrowCategory[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [isEditingCategory, setIsEditingCategory] = useState(false)
  const [categoryName, setCategoryName] = useState('')
  const [activeMenu, setActiveMenu] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    loadData()

    const linksChannel = supabase
      .channel(`borrow-links-${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'links', filter: `user_id=eq.${user.id}` },
        () => loadData()
      )
      .subscribe()

    const savedChannel = supabase
      .channel(`borrow-saved-${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'saved_items', filter: `user_id=eq.${user.id}` },
        () => loadData()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(linksChannel)
      supabase.removeChannel(savedChannel)
    }
  }, [user])

  const loadData = async () => {
    if (!user) return
    const isPremium = user.is_premium ?? false

    try {
      // Links: route through dataService (local for free, cloud for paid)
      const borrowedLinks = await getLinksByStatus(isPremium, user.id, 'borrow')

      // saved_items are cloud-only (premium); categories available to all users
      const [savedRes, categoriesRes] = await Promise.all([
        isPremium
          ? supabase.from('saved_items').select('*').eq('user_id', user.id).eq('status', 'borrow').order('created_at', { ascending: false })
          : Promise.resolve({ data: [] }),
        supabase.from('borrow_categories').select('*').eq('user_id', user.id).order('position'),
      ])

      const linksRes = { data: borrowedLinks }

      const linkItems: BorrowItem[] = (linksRes.data || []).map((link: Link) => ({
        id: link.id,
        type: 'link' as const,
        title: link.title,
        url: link.url,
        thumbnail: link.thumbnail_url || null,
        icon: null,
        content_type: link.content_type || 'url',
        created_at: link.created_at,
        category_id: link.category_id ?? null,
      }))

      const savedItems: BorrowItem[] = (savedRes.data || []).map((item: SavedItem) => ({
        id: item.id,
        type: 'saved_item' as const,
        title: item.title || item.file_name,
        thumbnail: item.thumbnail_url || (item.content_type === 'image' ? item.public_url : null),
        content_type: item.content_type || 'image',
        file_name: item.file_name,
        file_size: item.file_size,
        created_at: item.created_at,
        category_id: item.category_id,
      }))

      const allItems = [...linkItems, ...savedItems].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )

      setItems(allItems)
      setCategories(categoriesRes.data || [])
    } catch (error) {
      toast.error('Failed to load Borrow items')
    } finally {
      setIsLoading(false)
    }
  }

  const filteredItems = items.filter(item => {
    const matchesCategory = !selectedCategory || item.category_id === selectedCategory

    if (filter === 'all') return matchesCategory
    if (filter === 'url') return matchesCategory && (item.content_type === 'url' || item.type === 'link')
    if (filter === 'image') return matchesCategory && item.content_type === 'image'
    if (filter === 'file') return matchesCategory && (item.content_type === 'file' || item.content_type === 'pdf')

    return matchesCategory
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
      toast.success('Category created')
      loadData()
    } catch (error) {
      toast.error('Failed to create category')
    }
  }

  const handleMoveItem = async (itemId: string, itemType: 'link' | 'saved_item', newStatus: string) => {
    if (!user) return
    const isPremium = user.is_premium ?? false
    try {
      if (itemType === 'link') {
        await updateLink(isPremium, user.id, itemId, { status: newStatus as Link['status'] })
      } else {
        const { error } = await supabase.from('saved_items').update({ status: newStatus }).eq('id', itemId)
        if (error) throw error
      }
      setActiveMenu(null)
      toast.success(`Moved to ${newStatus.charAt(0).toUpperCase() + newStatus.slice(1)}`)
      loadData()
    } catch (error) {
      toast.error('Failed to move item')
    }
  }

  const handleDeleteItem = async (itemId: string, itemType: 'link' | 'saved_item') => {
    if (!user) return
    const isPremium = user.is_premium ?? false
    try {
      if (itemType === 'link') {
        await deleteLink(isPremium, user.id, itemId)
      } else {
        const { error } = await supabase.from('saved_items').delete().eq('id', itemId)
        if (error) throw error
      }
      setActiveMenu(null)
      toast.success('Item deleted')
      loadData()
    } catch (error) {
      toast.error('Failed to delete item')
    }
  }

  const handleCopyUrl = (url?: string) => {
    if (!url) return
    navigator.clipboard.writeText(url).then(() => toast.info('URL copied')).catch(() => {})
    setActiveMenu(null)
  }

  const handleAssignCategory = async (itemId: string, itemType: 'link' | 'saved_item', categoryId: string | null) => {
    if (!user) return
    const isPremium = user.is_premium ?? false
    try {
      if (itemType === 'link') {
        await updateLink(isPremium, user.id, itemId, { category_id: categoryId })
      } else {
        const { error } = await supabase.from('saved_items').update({ category_id: categoryId }).eq('id', itemId)
        if (error) throw error
      }
      setActiveMenu(null)
      toast.success(categoryId ? 'Category assigned' : 'Category removed')
      loadData()
    } catch {
      toast.error('Failed to assign category')
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-600">Loading...</div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <div className="bg-purple-200 border-b-4 border-black px-6 py-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-3">
            {onBack && (
              <button
                onClick={onBack}
                className="flex items-center gap-2 text-gray-700 hover:text-gray-900 font-medium transition"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M19 12H5M5 12L12 19M5 12L12 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Back to Menu
              </button>
            )}
            {onShowAdd && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onShowAdd('link')}
                  className="flex items-center gap-1.5 px-3 py-2 bg-black hover:bg-gray-800 text-white rounded-lg font-medium transition text-sm"
                >
                  <Icon name="link" size={14} />
                  URL
                </button>
                <button
                  onClick={() => onShowAdd('image')}
                  className="flex items-center gap-1.5 px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition text-sm"
                >
                  <Icon name="image" size={14} />
                  Image
                </button>
                <button
                  onClick={() => onShowAdd('file')}
                  className="flex items-center gap-1.5 px-3 py-2 bg-purple-100 hover:bg-purple-200 border-2 border-black text-black rounded-lg font-medium transition text-sm"
                >
                  <Icon name="file" size={14} />
                  File
                </button>
              </div>
            )}
          </div>

          <h2 className="text-4xl font-bold" style={{ fontStyle: 'italic' }}>
            {selectedCategory
              ? categories.find(c => c.id === selectedCategory)?.name
              : 'Borrow'}
          </h2>

          <div className="flex gap-2 mt-4 flex-wrap items-center">
            {categories.length > 0 && (
              <>
                <button
                  onClick={() => setSelectedCategory(null)}
                  className={`px-4 py-2 font-medium border-4 border-black transition ${
                    !selectedCategory
                      ? 'bg-black text-white'
                      : 'bg-white hover:bg-gray-100'
                  }`}
                >
                  All
                </button>
                {categories.map(category => (
                  <button
                    key={category.id}
                    onClick={() => setSelectedCategory(category.id)}
                    className={`px-4 py-2 font-medium border-4 border-black transition ${
                      selectedCategory === category.id
                        ? 'bg-black text-white'
                        : 'bg-white hover:bg-gray-100'
                    }`}
                  >
                    {category.name}
                  </button>
                ))}
              </>
            )}
            {isEditingCategory ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={categoryName}
                  onChange={(e) => setCategoryName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleCreateCategory(); if (e.key === 'Escape') { setIsEditingCategory(false); setCategoryName('') } }}
                  className="px-3 py-1.5 text-sm font-medium border-4 border-black focus:outline-none focus:ring-2 focus:ring-purple-400"
                  placeholder="Category name..."
                  autoFocus
                />
                <button onClick={handleCreateCategory} className="px-3 py-1.5 bg-black text-white text-sm font-bold hover:bg-gray-800 transition border-4 border-black">Save</button>
                <button onClick={() => { setIsEditingCategory(false); setCategoryName('') }} className="px-3 py-1.5 bg-white text-sm font-bold border-4 border-black hover:bg-gray-100 transition">✕</button>
              </div>
            ) : (
              <button
                onClick={() => { setIsEditingCategory(true); setCategoryName('') }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium border-4 border-black bg-white hover:bg-purple-100 transition"
              >
                <Icon name="plus" size={14} />
                New Category
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="bg-purple-100 border-b-4 border-black px-6 py-3">
        <div className="max-w-7xl mx-auto flex flex-wrap gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`flex items-center gap-2 px-4 py-2 font-medium border-4 border-black transition ${
              filter === 'all'
                ? 'bg-black text-white'
                : 'bg-white hover:bg-gray-100'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilter('url')}
            className={`flex items-center gap-2 px-4 py-2 font-medium border-4 border-black transition ${
              filter === 'url'
                ? 'bg-black text-white'
                : 'bg-white hover:bg-gray-100'
            }`}
          >
            <Icon name="link" size={18} />
            URLs
          </button>
          <button
            onClick={() => setFilter('image')}
            className={`flex items-center gap-2 px-4 py-2 font-medium border-4 border-black transition ${
              filter === 'image'
                ? 'bg-black text-white'
                : 'bg-white hover:bg-gray-100'
            }`}
          >
            <Icon name="image" size={18} />
            Images
          </button>
          <button
            onClick={() => setFilter('file')}
            className={`flex items-center gap-2 px-4 py-2 font-medium border-4 border-black transition ${
              filter === 'file'
                ? 'bg-black text-white'
                : 'bg-white hover:bg-gray-100'
            }`}
          >
            <Icon name="file" size={18} />
            Files
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto bg-gray-50 p-6 relative">
        <div className="max-w-7xl mx-auto">
          {filteredItems.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredItems.map(item => (
                <div
                  key={`${item.type}-${item.id}`}
                  className="bg-white border-4 border-black hover:shadow-lg transition relative group"
                >
                  {item.thumbnail ? (
                    <div className="relative aspect-video bg-gray-200">
                      <img
                        src={item.thumbnail}
                        alt={item.title}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement
                          target.style.display = 'none'
                        }}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                      <div className="absolute bottom-2 left-2 right-2">
                        <h3 className="text-white font-bold text-sm line-clamp-2">
                          {item.title}
                        </h3>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 flex items-start gap-3">
                      {item.icon ? (
                        <img src={item.icon} alt="" className="w-8 h-8 flex-shrink-0" />
                      ) : (
                        <div className="w-8 h-8 bg-gray-200 rounded flex items-center justify-center flex-shrink-0">
                          {item.content_type === 'file' || item.content_type === 'pdf' ? (
                            <Icon name="file" size={16} className="text-gray-600" />
                          ) : item.content_type === 'image' ? (
                            <Icon name="image" size={16} className="text-gray-600" />
                          ) : (
                            <Icon name="link" size={16} className="text-gray-600" />
                          )}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-sm line-clamp-2 mb-1">
                          {item.title}
                        </h3>
                        {item.url && (
                          <p className="text-xs text-gray-500 truncate">
                            {(() => { try { return new URL(item.url).hostname } catch { return item.url } })()}
                          </p>
                        )}
                        {item.file_size && (
                          <p className="text-xs text-gray-500">
                            {formatFileSize(item.file_size)}
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="absolute top-2 right-2">
                    <button
                      onClick={() => setActiveMenu(activeMenu === `${item.type}-${item.id}` ? null : `${item.type}-${item.id}`)}
                      className="p-2 bg-white border-2 border-black hover:bg-gray-100 transition"
                    >
                      <Icon name="more-vertical" size={16} />
                    </button>

                    {activeMenu === `${item.type}-${item.id}` && (
                      <div className="absolute top-full right-0 mt-1 bg-white border-4 border-black shadow-lg z-10 min-w-48">
                        {item.url && (
                          <>
                            <button
                              onClick={() => window.open(item.url, '_blank')}
                              className="w-full px-4 py-2 text-left hover:bg-gray-100 transition flex items-center gap-2"
                            >
                              <Icon name="external-link" size={16} />
                              Open
                            </button>
                            <button
                              onClick={() => handleCopyUrl(item.url)}
                              className="w-full px-4 py-2 text-left hover:bg-gray-100 transition flex items-center gap-2"
                            >
                              <Icon name="copy" size={16} />
                              Copy URL
                            </button>
                          </>
                        )}
                        {categories.length > 0 && (
                          <div className="border-t border-gray-100">
                            <p className="px-4 py-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">Category</p>
                            <button
                              onClick={() => handleAssignCategory(item.id, item.type, null)}
                              className={`w-full px-4 py-2 text-left hover:bg-gray-100 transition text-sm ${!item.category_id ? 'font-bold' : ''}`}
                            >
                              None
                            </button>
                            {categories.map(cat => (
                              <button
                                key={cat.id}
                                onClick={() => handleAssignCategory(item.id, item.type, cat.id)}
                                className={`w-full px-4 py-2 text-left hover:bg-gray-100 transition text-sm ${item.category_id === cat.id ? 'font-bold text-purple-700' : ''}`}
                              >
                                {item.category_id === cat.id ? '✓ ' : ''}{cat.name}
                              </button>
                            ))}
                          </div>
                        )}
                        <div className="border-t border-gray-100">
                        <button
                          onClick={() => handleMoveItem(item.id, item.type, 'keep')}
                          className="w-full px-4 py-2 text-left hover:bg-gray-100 transition flex items-center gap-2"
                        >
                          <Icon name="archive" size={16} />
                          Move to Keep
                        </button>
                        <button
                          onClick={() => handleMoveItem(item.id, item.type, 'share')}
                          className="w-full px-4 py-2 text-left hover:bg-gray-100 transition flex items-center gap-2"
                        >
                          <Icon name="share" size={16} />
                          Move to Share
                        </button>
                        <button
                          onClick={() => handleMoveItem(item.id, item.type, 'bury')}
                          className="w-full px-4 py-2 text-left hover:bg-gray-100 transition flex items-center gap-2"
                        >
                          <Icon name="archive" size={16} />
                          Move to Bury
                        </button>
                        </div>
                        <button
                          onClick={() => handleDeleteItem(item.id, item.type)}
                          className="w-full px-4 py-2 text-left hover:bg-red-50 text-red-600 transition flex items-center gap-2 border-t-2 border-black"
                        >
                          <Icon name="trash" size={16} />
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-gray-600 text-lg mb-2">No items in Borrow yet</p>
              <p className="text-gray-500 text-sm mb-6">Save things you want to revisit, return, or share later</p>
              {onShowAdd && (
                <div className="flex flex-col items-center gap-3">
                  <button
                    onClick={() => onShowAdd('link')}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-black hover:bg-gray-800 text-white rounded-lg transition font-medium"
                  >
                    <Icon name="link" size={16} />
                    Save a URL
                  </button>
                  <button
                    onClick={() => onShowAdd('image')}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition font-medium"
                  >
                    <Icon name="image" size={16} />
                    Upload an Image
                  </button>
                  <button
                    onClick={() => onShowAdd('file')}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-purple-100 hover:bg-purple-200 border-2 border-black text-black rounded-lg transition font-medium"
                  >
                    <Icon name="file" size={16} />
                    Upload a File
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Basket icon — bottom right decorative, same pattern as other views */}
        <div className="absolute bottom-4 right-4 pointer-events-none">
          <img
            src="/icons/basket.png"
            alt=""
            className="w-24 h-24 object-contain drop-shadow-lg opacity-80"
          />
        </div>
      </div>
    </div>
  )
}
