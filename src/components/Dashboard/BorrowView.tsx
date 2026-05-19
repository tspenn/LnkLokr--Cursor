import { useState, useEffect } from 'react'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
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

export function BorrowView() {
  const { user } = useAuth()
  const [filter, setFilter] = useState<FilterType>('all')
  const [items, setItems] = useState<BorrowItem[]>([])
  const [categories, setCategories] = useState<BorrowCategory[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [isEditingCategory, setIsEditingCategory] = useState(false)
  const [categoryName, setCategoryName] = useState('Borrow')
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

    try {
      const [linksRes, savedRes, categoriesRes] = await Promise.all([
        supabase
          .from('links')
          .select('*')
          .eq('user_id', user.id)
          .eq('status', 'borrow')
          .order('created_at', { ascending: false }),
        supabase
          .from('saved_items')
          .select('*')
          .eq('user_id', user.id)
          .eq('status', 'borrow')
          .order('created_at', { ascending: false }),
        supabase
          .from('borrow_categories')
          .select('*')
          .eq('user_id', user.id)
          .order('position'),
      ])

      const linkItems: BorrowItem[] = (linksRes.data || []).map((link: Link) => ({
        id: link.id,
        type: 'link' as const,
        title: link.title,
        url: link.url,
        thumbnail: link.thumbnail_url || null,
        icon: null,
        content_type: 'url',
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
      console.error('Failed to load borrow data:', error)
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
      loadData()
    } catch (error) {
      console.error('Failed to create category:', error)
    }
  }

  const handleMoveItem = async (itemId: string, itemType: 'link' | 'saved_item', newStatus: string) => {
    try {
      const table = itemType === 'link' ? 'links' : 'saved_items'
      const { error } = await supabase.from(table).update({ status: newStatus }).eq('id', itemId)

      if (error) throw error
      setActiveMenu(null)
      loadData()
    } catch (error) {
      console.error('Failed to move item:', error)
    }
  }

  const handleDeleteItem = async (itemId: string, itemType: 'link' | 'saved_item') => {
    try {
      const table = itemType === 'link' ? 'links' : 'saved_items'
      const { error } = await supabase.from(table).delete().eq('id', itemId)

      if (error) throw error
      setActiveMenu(null)
      loadData()
    } catch (error) {
      console.error('Failed to delete item:', error)
    }
  }

  const handleCopyUrl = (url?: string) => {
    if (!url) return
    navigator.clipboard.writeText(url)
    setActiveMenu(null)
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
          {isEditingCategory ? (
            <div className="flex items-center gap-3">
              <input
                type="text"
                value={categoryName}
                onChange={(e) => setCategoryName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreateCategory()}
                className="flex-1 px-4 py-2 text-2xl font-bold border-4 border-black focus:outline-none focus:ring-4 focus:ring-purple-400"
                placeholder="Category name..."
                autoFocus
              />
              <button
                onClick={handleCreateCategory}
                className="px-6 py-2 bg-black text-white font-bold hover:bg-gray-800 transition"
              >
                Save
              </button>
              <button
                onClick={() => setIsEditingCategory(false)}
                className="px-6 py-2 bg-white border-4 border-black font-bold hover:bg-gray-100 transition"
              >
                Cancel
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <h2 className="text-4xl font-bold" style={{ fontStyle: 'italic' }}>
                {selectedCategory
                  ? categories.find(c => c.id === selectedCategory)?.name
                  : 'Borrow'}
              </h2>
              <button
                onClick={() => setIsEditingCategory(true)}
                className="p-2 hover:bg-purple-300 rounded-lg transition"
                title="Create category"
              >
                <Icon name="edit" size={20} />
              </button>
            </div>
          )}

          {categories.length > 0 && (
            <div className="flex gap-2 mt-4 flex-wrap">
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
            </div>
          )}
        </div>
      </div>

      <div className="bg-purple-100 border-b-4 border-black px-6 py-3">
        <div className="max-w-7xl mx-auto flex gap-2">
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

      <div className="flex-1 overflow-auto bg-gray-50 p-6">
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
              <p className="text-gray-600 text-lg mb-4">
                No items in Borrow yet
              </p>
              <p className="text-gray-500 text-sm">
                Items you save temporarily will appear here
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
