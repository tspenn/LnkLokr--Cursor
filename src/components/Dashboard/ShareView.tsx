import { useState, useEffect } from 'react'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import { Link, SavedItem } from '@/types'
import { Icon } from '../shared/Icon'

type FilterType = 'all' | 'url' | 'image' | 'file'

interface ShareItem {
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
}

interface ShareViewProps {
  onBack?: () => void
}

export function ShareView({ onBack }: ShareViewProps) {
  const { user } = useAuth()
  const [filter, setFilter] = useState<FilterType>('all')
  const [items, setItems] = useState<ShareItem[]>([])
  const [activeMenu, setActiveMenu] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    loadData()

    const linksChannel = supabase
      .channel(`share-links-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'links', filter: `user_id=eq.${user.id}` }, () => loadData())
      .subscribe()

    const savedChannel = supabase
      .channel(`share-saved-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'saved_items', filter: `user_id=eq.${user.id}` }, () => loadData())
      .subscribe()

    return () => {
      supabase.removeChannel(linksChannel)
      supabase.removeChannel(savedChannel)
    }
  }, [user])

  const loadData = async () => {
    if (!user) return
    try {
      const [linksRes, savedRes] = await Promise.all([
        supabase.from('links').select('*').eq('user_id', user.id).eq('status', 'share').order('created_at', { ascending: false }),
        supabase.from('saved_items').select('*').eq('user_id', user.id).eq('status', 'share').order('created_at', { ascending: false }),
      ])

      const linkItems: ShareItem[] = (linksRes.data || []).map((link: Link) => ({
        id: link.id,
        type: 'link' as const,
        title: link.title,
        url: link.url,
        thumbnail: link.thumbnail_url || null,
        icon: null,
        content_type: 'url',
        created_at: link.created_at,
      }))

      const savedItems: ShareItem[] = (savedRes.data || []).map((item: SavedItem) => ({
        id: item.id,
        type: 'saved_item' as const,
        title: item.title || item.file_name,
        thumbnail: item.thumbnail_url || (item.content_type === 'image' ? item.public_url : null),
        content_type: item.content_type || 'image',
        file_name: item.file_name,
        file_size: item.file_size,
        created_at: item.created_at,
      }))

      setItems(
        [...linkItems, ...savedItems].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      )
    } catch (error) {
      console.error('Failed to load share data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleMoveItem = async (itemId: string, itemType: 'link' | 'saved_item', newStatus: string) => {
    try {
      const table = itemType === 'link' ? 'links' : 'saved_items'
      await supabase.from(table).update({ status: newStatus }).eq('id', itemId)
      setActiveMenu(null)
      loadData()
    } catch (error) {
      console.error('Failed to move item:', error)
    }
  }

  const handleDeleteItem = async (itemId: string, itemType: 'link' | 'saved_item') => {
    try {
      const table = itemType === 'link' ? 'links' : 'saved_items'
      await supabase.from(table).delete().eq('id', itemId)
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

  const handleNativeShare = async (item: ShareItem) => {
    setActiveMenu(null)
    try {
      if (navigator.share) {
        await navigator.share({
          title: item.title,
          ...(item.url ? { url: item.url } : {}),
          ...(item.content_type === 'image' && item.thumbnail
            ? { text: item.title }
            : {}),
        })
      } else {
        // Fallback: copy to clipboard
        const text = item.url ?? item.title
        await navigator.clipboard.writeText(text)
        alert('Copied to clipboard — paste to share!')
      }
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        console.error('Share failed:', err)
      }
    }
  }

  const handleEmailShare = (item: ShareItem) => {
    setActiveMenu(null)
    const subject = encodeURIComponent(item.title)
    const body = encodeURIComponent(item.url ?? item.title)
    window.open(`mailto:?subject=${subject}&body=${body}`)
  }

  const handleDownload = (item: ShareItem) => {
    setActiveMenu(null)
    const src = item.thumbnail ?? item.url
    if (!src) return
    const a = document.createElement('a')
    a.href = src
    a.download = item.file_name ?? item.title
    a.target = '_blank'
    a.click()
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  const filteredItems = items.filter(item => {
    if (filter === 'url') return item.content_type === 'url' || item.type === 'link'
    if (filter === 'image') return item.content_type === 'image'
    if (filter === 'file') return item.content_type === 'file' || item.content_type === 'pdf'
    return true
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-600">Loading...</div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <div className="bg-pink-300 border-b-4 border-black px-6 py-4">
        <div className="max-w-7xl mx-auto">
          {onBack && (
            <button
              onClick={onBack}
              className="flex items-center gap-2 text-gray-700 hover:text-gray-900 font-medium mb-3 transition"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M19 12H5M5 12L12 19M5 12L12 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Back to Menu
            </button>
          )}
          <h2 className="text-4xl font-bold" style={{ fontStyle: 'italic' }}>Share</h2>
        </div>
      </div>

      <div className="bg-pink-200 border-b-4 border-black px-6 py-3">
        <div className="max-w-7xl mx-auto flex gap-2">
          {(['all', 'url', 'image', 'file'] as FilterType[]).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`flex items-center gap-2 px-4 py-2 font-medium border-4 border-black transition capitalize ${
                filter === f ? 'bg-black text-white' : 'bg-white hover:bg-gray-100'
              }`}
            >
              {f === 'url' && <Icon name="link" size={18} />}
              {f === 'image' && <Icon name="image" size={18} />}
              {f === 'file' && <Icon name="file" size={18} />}
              {f === 'all' ? 'All' : f === 'url' ? 'URLs' : f === 'image' ? 'Images' : 'Files'}
            </button>
          ))}
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
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                      <div className="absolute bottom-2 left-2 right-2">
                        <h3 className="text-white font-bold text-sm line-clamp-2">{item.title}</h3>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 flex items-start gap-3">
                      <div className="w-8 h-8 bg-gray-200 rounded flex items-center justify-center flex-shrink-0">
                        {item.content_type === 'file' || item.content_type === 'pdf' ? (
                          <Icon name="file" size={16} className="text-gray-600" />
                        ) : item.content_type === 'image' ? (
                          <Icon name="image" size={16} className="text-gray-600" />
                        ) : (
                          <Icon name="link" size={16} className="text-gray-600" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-sm line-clamp-2 mb-1">{item.title}</h3>
                        {item.url && (
                          <p className="text-xs text-gray-500 truncate">
                            {(() => { try { return new URL(item.url).hostname } catch { return item.url } })()}
                          </p>
                        )}
                        {item.file_size && (
                          <p className="text-xs text-gray-500">{formatFileSize(item.file_size)}</p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Share action bar */}
                  <div className="border-t-2 border-black flex">
                    <button
                      onClick={() => handleNativeShare(item)}
                      className="flex-1 flex items-center justify-center gap-1 py-2 bg-pink-400 hover:bg-pink-500 text-white font-bold text-sm transition border-r-2 border-black"
                      title="Share"
                    >
                      <Icon name="share" size={15} />
                      Share
                    </button>
                    <button
                      onClick={() => handleEmailShare(item)}
                      className="flex items-center justify-center px-3 py-2 bg-white hover:bg-gray-100 transition border-r-2 border-black"
                      title="Email"
                    >
                      <Icon name="mail" size={15} />
                    </button>
                    {(item.thumbnail || item.url) && (
                      <button
                        onClick={() => handleDownload(item)}
                        className="flex items-center justify-center px-3 py-2 bg-white hover:bg-gray-100 transition border-r-2 border-black"
                        title="Download / Save"
                      >
                        <Icon name="download" size={15} />
                      </button>
                    )}
                    {item.url && (
                      <button
                        onClick={() => handleCopyUrl(item.url)}
                        className="flex items-center justify-center px-3 py-2 bg-white hover:bg-gray-100 transition border-r-2 border-black"
                        title="Copy link"
                      >
                        <Icon name="copy" size={15} />
                      </button>
                    )}
                    {/* Move / delete overflow menu */}
                    <div className="relative">
                      <button
                        onClick={() => setActiveMenu(activeMenu === `${item.type}-${item.id}` ? null : `${item.type}-${item.id}`)}
                        className="flex items-center justify-center px-3 py-2 bg-white hover:bg-gray-100 transition"
                        title="Move or delete"
                      >
                        <Icon name="more-vertical" size={15} />
                      </button>

                      {activeMenu === `${item.type}-${item.id}` && (
                        <div className="absolute bottom-full right-0 mb-1 bg-white border-4 border-black shadow-lg z-10 min-w-48">
                          {item.url && (
                            <button
                              onClick={() => window.open(item.url, '_blank')}
                              className="w-full px-4 py-2 text-left hover:bg-gray-100 transition flex items-center gap-2"
                            >
                              <Icon name="external-link" size={16} />
                              Open
                            </button>
                          )}
                          <button
                            onClick={() => handleMoveItem(item.id, item.type, 'keep')}
                            className="w-full px-4 py-2 text-left hover:bg-yellow-50 transition flex items-center gap-2"
                          >
                            <Icon name="archive" size={16} />
                            Move to Keep
                          </button>
                          <button
                            onClick={() => handleMoveItem(item.id, item.type, 'borrow')}
                            className="w-full px-4 py-2 text-left hover:bg-purple-50 transition flex items-center gap-2"
                          >
                            <Icon name="archive" size={16} />
                            Move to Borrow
                          </button>
                          <button
                            onClick={() => handleMoveItem(item.id, item.type, 'bury')}
                            className="w-full px-4 py-2 text-left hover:bg-cyan-50 transition flex items-center gap-2"
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
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-gray-600 text-lg mb-4">No items in Share yet</p>
              <p className="text-gray-500 text-sm">
                Move items here from Keep or Borrow to share them
              </p>
            </div>
          )}
        </div>

        <div className="absolute bottom-4 right-4 pointer-events-none">
          <svg width="96" height="96" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="opacity-20">
            <circle cx="18" cy="5" r="3" stroke="#000" strokeWidth="1.5"/>
            <circle cx="6" cy="12" r="3" stroke="#000" strokeWidth="1.5"/>
            <circle cx="18" cy="19" r="3" stroke="#000" strokeWidth="1.5"/>
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" stroke="#000" strokeWidth="1.5"/>
            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" stroke="#000" strokeWidth="1.5"/>
          </svg>
        </div>
      </div>
    </div>
  )
}
