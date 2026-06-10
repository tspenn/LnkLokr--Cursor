import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'
import { supabase } from '@/lib/supabase'
import { addLink } from '@/lib/dataService'
import { Icon } from '../shared/Icon'

interface InboxItem {
  id: string
  source_app: string
  destination_app: string
  content: string
  item_type: 'note' | 'link' | 'product' | 'budget' | string
  metadata: Record<string, unknown> | null
  is_read: boolean
  created_at: string
}

const APP_LABELS: Record<string, string> = {
  friday_canvas: 'FRIDAY Canvas',
  lnklokr: 'LnkLokr',
  go_shop: 'Go Shop',
  trvl: 'TRVL',
  my_dollar: 'MY$',
}

const TYPE_COLORS: Record<string, string> = {
  link: 'bg-blue-50 border-blue-300',
  product: 'bg-yellow-50 border-yellow-300',
  note: 'bg-pink-50 border-pink-300',
  budget: 'bg-green-50 border-green-300',
}

const TYPE_ICONS: Record<string, string> = {
  link: 'link',
  product: 'archive',
  note: 'file-text',
  budget: 'database',
}

interface InboxViewProps {
  onBack?: () => void
  onUnreadCountChange?: (count: number) => void
}

export function InboxView({ onBack, onUnreadCountChange }: InboxViewProps) {
  const { user } = useAuth()
  const toast = useToast()
  const [items, setItems] = useState<InboxItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [filter, setFilter] = useState<'unread' | 'all'>('unread')
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set())

  const loadItems = useCallback(async () => {
    if (!user) return
    try {
      const { data, error } = await supabase
        .from('skyland_app_inbox')
        .select('*')
        .eq('destination_app', 'lnklokr')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (error) throw error

      const inbox = (data ?? []) as InboxItem[]
      setItems(inbox)
      const unread = inbox.filter(i => !i.is_read).length
      onUnreadCountChange?.(unread)
    } catch (err) {
      toast.error('Failed to load inbox')
    } finally {
      setIsLoading(false)
    }
  }, [user, onUnreadCountChange])

  useEffect(() => {
    if (!user) return
    loadItems()

    const channel = supabase
      .channel(`inbox-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'skyland_app_inbox',
          filter: `user_id=eq.${user.id}`,
        },
        () => loadItems(),
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [user, loadItems])

  const markRead = async (id: string) => {
    await supabase
      .from('skyland_app_inbox')
      .update({ is_read: true })
      .eq('id', id)
    setItems(prev => {
      const updated = prev.map(i => i.id === id ? { ...i, is_read: true } : i)
      onUnreadCountChange?.(updated.filter(i => !i.is_read).length)
      return updated
    })
  }

  const markAllRead = async () => {
    if (!user) return
    await supabase
      .from('skyland_app_inbox')
      .update({ is_read: true })
      .eq('destination_app', 'lnklokr')
      .eq('user_id', user.id)
      .eq('is_read', false)
    setItems(prev => prev.map(i => ({ ...i, is_read: true })))
    onUnreadCountChange?.(0)
  }

  const saveToKeep = async (item: InboxItem) => {
    if (!user) return
    setSavingIds(prev => new Set(prev).add(item.id))
    try {
      const url = isUrl(item.content) ? item.content : (item.metadata?.url as string | undefined)
      if (!url) {
        toast.warning('No URL to save from this item')
        return
      }
      await addLink(user.is_premium ?? false, user.id, {
        url,
        title: (item.metadata?.title as string | undefined) || item.content.slice(0, 120) || 'Inbox item',
        description: item.metadata ? String(item.metadata.description ?? '') : null,
        status: 'keep',
        content_type: 'url',
        tags: [],
        is_favorite: false,
      })
      await markRead(item.id)
      toast.success('Saved to Keep!')
    } catch {
      toast.error('Failed to save to Keep')
    } finally {
      setSavingIds(prev => { const s = new Set(prev); s.delete(item.id); return s })
    }
  }

  const displayed = filter === 'unread' ? items.filter(i => !i.is_read) : items
  const unreadCount = items.filter(i => !i.is_read).length

  const formatDate = (iso: string) => {
    const d = new Date(iso)
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  const isUrl = (s: string) => {
    try { return Boolean(new URL(s)) } catch { return false }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-600">Loading inbox...</div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="bg-indigo-200 border-b-4 border-black px-6 py-4">
        <div className="max-w-2xl mx-auto">
          {onBack && (
            <button
              onClick={onBack}
              className="flex items-center gap-2 text-gray-700 hover:text-gray-900 font-medium mb-3 transition"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M19 12H5M5 12L12 19M5 12L12 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Back to Menu
            </button>
          )}

          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <h2 className="text-4xl font-bold" style={{ fontStyle: 'italic' }}>Inbox</h2>
              {unreadCount > 0 && (
                <span className="bg-red-500 text-white text-sm font-bold px-2.5 py-0.5 rounded-full">
                  {unreadCount}
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="text-sm font-medium text-indigo-800 hover:text-indigo-900 underline"
              >
                Mark all read
              </button>
            )}
          </div>

          <p className="text-sm text-indigo-900 mt-1">
            Items sent to LnkLokr from other Skyland Reach apps
          </p>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="bg-indigo-100 border-b-4 border-black px-6 py-3">
        <div className="max-w-2xl mx-auto flex gap-2">
          <button
            onClick={() => setFilter('unread')}
            className={`px-4 py-2 font-medium border-4 border-black transition ${
              filter === 'unread' ? 'bg-black text-white' : 'bg-white hover:bg-gray-100'
            }`}
          >
            Unread {unreadCount > 0 && `(${unreadCount})`}
          </button>
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 font-medium border-4 border-black transition ${
              filter === 'all' ? 'bg-black text-white' : 'bg-white hover:bg-gray-100'
            }`}
          >
            All ({items.length})
          </button>
        </div>
      </div>

      {/* Items */}
      <div className="flex-1 overflow-auto bg-gray-50 p-6">
        <div className="max-w-2xl mx-auto space-y-3">
          {displayed.length === 0 ? (
            <div className="text-center py-16">
              <div className="text-5xl mb-4">📬</div>
              <p className="text-gray-600 text-lg font-medium">
                {filter === 'unread' ? 'No unread messages' : 'Inbox is empty'}
              </p>
              <p className="text-gray-500 text-sm mt-2">
                Items sent from FRIDAY Canvas, Go Shop, and other Skyland Reach apps appear here
              </p>
            </div>
          ) : (
            displayed.map(item => {
              const colorClass = TYPE_COLORS[item.item_type] ?? 'bg-gray-50 border-gray-300'
              const iconName = (TYPE_ICONS[item.item_type] ?? 'info') as Parameters<typeof Icon>[0]['name']
              const sourceLabel = APP_LABELS[item.source_app] ?? item.source_app
              const contentIsUrl = isUrl(item.content)

              return (
                <div
                  key={item.id}
                  className={`border-4 border-black rounded-none p-4 transition ${colorClass} ${
                    !item.is_read ? 'shadow-md' : 'opacity-70'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 mt-0.5">
                      <Icon name={iconName} size={20} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-xs font-bold uppercase tracking-wide text-indigo-700 bg-indigo-100 border border-indigo-300 px-2 py-0.5 rounded">
                          {sourceLabel}
                        </span>
                        <span className="text-xs text-gray-500 capitalize">{item.item_type}</span>
                        {!item.is_read && (
                          <span className="w-2 h-2 rounded-full bg-red-500 inline-block" title="Unread" />
                        )}
                        <span className="text-xs text-gray-400 ml-auto">{formatDate(item.created_at)}</span>
                      </div>

                      {/* Content */}
                      {contentIsUrl ? (
                        <a
                          href={item.content}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-700 underline text-sm font-medium break-all hover:text-blue-900"
                          onClick={() => markRead(item.id)}
                        >
                          {item.content}
                        </a>
                      ) : (
                        <p className="text-gray-900 text-sm break-words">{item.content}</p>
                      )}

                      {/* Metadata */}
                      {item.metadata && Object.keys(item.metadata).length > 0 && (
                        <div className="mt-2 text-xs text-gray-600 space-y-0.5">
                          {Object.entries(item.metadata).map(([k, v]) => (
                            <div key={k}>
                              <span className="font-medium capitalize">{k.replace(/_/g, ' ')}:</span>{' '}
                              <span>{String(v)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="mt-3 flex items-center justify-between gap-2 flex-wrap">
                    {(contentIsUrl || item.metadata?.url) ? (
                      <button
                        onClick={() => saveToKeep(item)}
                        disabled={savingIds.has(item.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-yellow-100 border-2 border-black text-xs font-bold hover:bg-yellow-200 transition disabled:opacity-50"
                      >
                        <Icon name="archive" size={14} />
                        {savingIds.has(item.id) ? 'Saving…' : 'Save to Keep'}
                      </button>
                    ) : (
                      <span />
                    )}
                    {!item.is_read && (
                      <button
                        onClick={() => markRead(item.id)}
                        className="text-xs font-medium text-gray-600 hover:text-gray-900 underline"
                      >
                        Mark as read
                      </button>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
