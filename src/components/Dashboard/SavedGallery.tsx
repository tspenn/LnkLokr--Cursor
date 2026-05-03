import { useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import { PURCHASE_URL } from '@/lib/premiumService'
import { Icon } from '../shared/Icon'

interface SavedItem {
  id: string
  user_id: string
  storage_path: string
  public_url: string
  original_src: string
  title: string
  alt?: string
  page_title?: string
  page_url?: string
  mime_type?: string
  file_size?: number
  content_type?: string
  folder_id?: string
  created_at: string
}

interface Folder {
  id: string
  name: string
  user_id: string
  position: number
}

interface SavedGalleryProps {
  contentType?: 'image' | 'pdf' | 'file'
}

export function SavedGallery({ contentType = 'image' }: SavedGalleryProps) {
  const { user } = useAuth()
  const [items, setItems] = useState<SavedItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedItem, setSelectedItem] = useState<SavedItem | null>(null)
  const [showMetadata, setShowMetadata] = useState(false)
  const [folders, setFolders] = useState<Folder[]>([])

  const loadSavedItems = async () => {
    if (!user) return

    try {
      const [itemsResponse, foldersResponse] = await Promise.all([
        supabase
          .from('saved_items')
          .select('*')
          .eq('user_id', user.id)
          .eq('content_type', contentType)
          .order('created_at', { ascending: false }),
        supabase
          .from('folders')
          .select('*')
          .eq('user_id', user.id)
          .order('position', { ascending: true })
      ])

      if (itemsResponse.error) throw itemsResponse.error
      if (foldersResponse.error) throw foldersResponse.error

      setItems(itemsResponse.data || [])
      setFolders(foldersResponse.data || [])
    } catch (error) {
      console.error('Failed to load saved items:', error)
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }

  const handleRefresh = async () => {
    setIsRefreshing(true)
    await loadSavedItems()
  }

  useEffect(() => {
    if (!user) return

    loadSavedItems()

    const channel = supabase
      .channel(`saved-items-${user.id}-${contentType}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'saved_items',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const item = payload.new as SavedItem
          if (payload.eventType === 'INSERT' && item.content_type === contentType) {
            setItems((prev) => [item, ...prev])
          } else if (payload.eventType === 'DELETE') {
            setItems((prev) => prev.filter((item) => item.id !== payload.old.id))
          } else if (payload.eventType === 'UPDATE' && item.content_type === contentType) {
            setItems((prev) =>
              prev.map((prevItem) =>
                prevItem.id === item.id ? item : prevItem
              )
            )
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user, contentType])

  const handleDelete = async (item: SavedItem) => {
    if (!confirm(`Delete "${item.title}"?`)) return

    setDeletingId(item.id)
    try {
      await supabase.storage.from('saved-images').remove([item.storage_path])

      const { error } = await supabase.from('saved_items').delete().eq('id', item.id)

      if (error) throw error
    } catch (error) {
      console.error('Failed to delete item:', error)
      alert('Failed to delete image')
    } finally {
      setDeletingId(null)
    }
  }

  const openOriginal = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  const handleItemClick = (item: SavedItem) => {
    if (!selectedItem || selectedItem.id !== item.id) {
      setSelectedItem(item)
      setShowMetadata(false)
    } else if (selectedItem.id === item.id && !showMetadata) {
      setShowMetadata(true)
    } else {
      setSelectedItem(null)
      setShowMetadata(false)
    }
  }

  const groupedItems = folders.reduce((acc, folder) => {
    const folderItems = items.filter(item => item.folder_id === folder.id)
    if (folderItems.length > 0) {
      acc.push({ folder, items: folderItems })
    }
    return acc
  }, [] as Array<{ folder: Folder | null; items: SavedItem[] }>)

  const ungroupedItems = items.filter(item => !item.folder_id)
  if (ungroupedItems.length > 0) {
    groupedItems.unshift({ folder: null, items: ungroupedItems })
  }

  const filteredItems = items.filter((item) => {
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase()
    return (
      item.title?.toLowerCase().includes(query) ||
      item.alt?.toLowerCase().includes(query) ||
      item.original_src?.toLowerCase().includes(query) ||
      item.page_title?.toLowerCase().includes(query)
    )
  })

  const typeLabel = contentType === 'image' ? 'Images' : contentType === 'pdf' ? 'PDFs' : 'Files'
  const typeLabelSingular = contentType === 'image' ? 'image' : contentType === 'pdf' ? 'PDF' : 'file'

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-600">Loading saved {typeLabel.toLowerCase()}...</div>
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4">
        <div className="text-gray-400 mb-2">
          <svg
            className="w-16 h-16 mx-auto"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
        </div>
        <p className="text-gray-600 mb-4 text-center">No saved {typeLabel.toLowerCase()} yet</p>
        <p className="text-sm text-gray-500 text-center max-w-md">
          Right-click on any {typeLabelSingular} on the web and select "Save to LnkLokr" to
          save it here
        </p>
      </div>
    )
  }

  const limitReached = !user?.is_premium && items.length >= 50

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <Icon name="search" size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder={`Search saved ${typeLabel.toLowerCase()}...`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition"
          />
        </div>
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="flex items-center gap-2 px-4 py-2 border border-gray-300 hover:bg-gray-50 rounded-lg transition font-medium text-gray-700 disabled:opacity-50"
          title="Refresh"
        >
          <Icon name="refresh" size={18} className={isRefreshing ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {limitReached && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-center justify-between">
          <div>
            <p className="text-amber-800 font-medium">Storage limit reached</p>
            <p className="text-sm text-amber-700">
              Upgrade to Premium for unlimited storage
            </p>
          </div>
          <button
            onClick={() => window.open(PURCHASE_URL, '_blank', 'noopener,noreferrer')}
            className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition font-medium"
          >
            <Icon name="crown" size={18} />
            Upgrade
          </button>
        </div>
      )}

      {filteredItems.length === 0 && searchQuery ? (
        <div className="text-center py-12">
          <p className="text-gray-600">No {typeLabel.toLowerCase()} match your search</p>
        </div>
      ) : searchQuery ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredItems.map((item) => (
            <div
              key={item.id}
              className="bg-white rounded-lg shadow hover:shadow-lg transition-all overflow-hidden group cursor-pointer"
              onClick={() => handleItemClick(item)}
            >
              <div className="relative h-48 bg-gray-100 overflow-hidden">
                {contentType === 'image' ? (
                  <img
                    src={item.public_url}
                    alt={item.alt || item.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
                    {contentType === 'pdf' ? (
                      <Icon name="file-text" size={64} className="text-red-500" />
                    ) : (
                      <Icon name="file" size={64} className="text-blue-500" />
                    )}
                  </div>
                )}
              </div>
              <div className="p-3">
                <h3 className="font-bold text-gray-900 truncate text-sm">
                  {item.title || 'Untitled'}
                </h3>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          {groupedItems.map((group) => (
            <div key={group.folder?.id || 'ungrouped'} className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-gray-900">
                  {group.folder ? group.folder.name : 'Ungrouped'}
                </h3>
                <span className="text-sm text-gray-500">
                  Tap to enlarge or download group
                </span>
              </div>

              <div className="relative">
                <div className="flex gap-3 overflow-x-auto pb-3" style={{ scrollbarWidth: 'thin' }}>
                  {group.items.map((item: SavedItem) => (
                    <div
                      key={item.id}
                      className="flex-shrink-0 w-32 h-32 bg-gray-100 rounded-lg overflow-hidden cursor-pointer hover:ring-4 hover:ring-primary-300 transition-all"
                      onClick={() => handleItemClick(item)}
                    >
                      {contentType === 'image' ? (
                        <img
                          src={item.public_url}
                          alt={item.alt || item.title}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
                          {contentType === 'pdf' ? (
                            <Icon name="file-text" size={48} className="text-red-500" />
                          ) : (
                            <Icon name="file" size={48} className="text-blue-500" />
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedItem && (
        <div
          className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"
          onClick={() => {
            setSelectedItem(null)
            setShowMetadata(false)
          }}
        >
          <div
            className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {!showMetadata ? (
              <div className="relative">
                <button
                  onClick={() => {
                    setSelectedItem(null)
                    setShowMetadata(false)
                  }}
                  className="absolute top-4 right-4 bg-white rounded-full p-2 shadow-lg hover:bg-gray-100 transition z-10"
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>

                {contentType === 'image' ? (
                  <img
                    src={selectedItem.public_url}
                    alt={selectedItem.alt || selectedItem.title}
                    className="w-full h-auto max-h-[80vh] object-contain"
                  />
                ) : (
                  <div className="w-full h-96 flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
                    {contentType === 'pdf' ? (
                      <Icon name="file-text" size={128} className="text-red-500" />
                    ) : (
                      <Icon name="file" size={128} className="text-blue-500" />
                    )}
                  </div>
                )}

                <div className="p-6 border-t">
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">
                    {selectedItem.title || 'Untitled'}
                  </h2>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowMetadata(true)}
                      className="flex-1 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium transition"
                    >
                      View Metadata
                    </button>
                    <button
                      onClick={() => openOriginal(selectedItem.original_src)}
                      className="flex-1 py-3 bg-gray-200 hover:bg-gray-300 text-gray-900 rounded-lg font-medium transition flex items-center justify-center gap-2"
                    >
                      <Icon name="external-link" size={20} />
                      Open Original
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDelete(selectedItem)
                        setSelectedItem(null)
                      }}
                      disabled={deletingId === selectedItem.id}
                      className="px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition disabled:opacity-50"
                    >
                      {deletingId === selectedItem.id ? (
                        <Icon name="loader" size={20} className="animate-spin" />
                      ) : (
                        <Icon name="trash" size={20} />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-gray-900">Metadata</h2>
                  <button
                    onClick={() => setShowMetadata(false)}
                    className="text-gray-600 hover:text-gray-900 font-medium"
                  >
                    Back to Image
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-semibold text-gray-700">Title</label>
                    <p className="text-gray-900 mt-1">{selectedItem.title || 'Untitled'}</p>
                  </div>

                  {selectedItem.alt && (
                    <div>
                      <label className="text-sm font-semibold text-gray-700">Alt Text</label>
                      <p className="text-gray-900 mt-1">{selectedItem.alt}</p>
                    </div>
                  )}

                  <div>
                    <label className="text-sm font-semibold text-gray-700">Original URL</label>
                    <a
                      href={selectedItem.original_src}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary-600 hover:text-primary-700 mt-1 block break-all"
                    >
                      {selectedItem.original_src}
                    </a>
                  </div>

                  {selectedItem.page_title && (
                    <div>
                      <label className="text-sm font-semibold text-gray-700">Page Title</label>
                      <p className="text-gray-900 mt-1">{selectedItem.page_title}</p>
                    </div>
                  )}

                  {selectedItem.page_url && (
                    <div>
                      <label className="text-sm font-semibold text-gray-700">Page URL</label>
                      <a
                        href={selectedItem.page_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary-600 hover:text-primary-700 mt-1 block break-all"
                      >
                        {selectedItem.page_url}
                      </a>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-semibold text-gray-700">File Size</label>
                      <p className="text-gray-900 mt-1">
                        {selectedItem.file_size ? `${(selectedItem.file_size / 1024).toFixed(1)} KB` : 'Unknown'}
                      </p>
                    </div>

                    <div>
                      <label className="text-sm font-semibold text-gray-700">MIME Type</label>
                      <p className="text-gray-900 mt-1">{selectedItem.mime_type || 'Unknown'}</p>
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-semibold text-gray-700">Saved On</label>
                    <p className="text-gray-900 mt-1">
                      {new Date(selectedItem.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
