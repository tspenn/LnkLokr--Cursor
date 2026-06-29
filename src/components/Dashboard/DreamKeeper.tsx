import { useState, useRef, useCallback, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Download, ArrowLeft, Type, Image as ImageIcon, Trash2, Save } from 'lucide-react'

interface BoardItem {
  id: string
  type: 'image' | 'text'
  content: string
  x: number
  y: number
  width: number
  height: number
  rotation: number
  zIndex: number
}

interface DragState {
  itemId: string
  startMouseX: number
  startMouseY: number
  startItemX: number
  startItemY: number
}

interface SavedBoard {
  id: string
  title: string
  items: BoardItem[]
  updatedAt: string
}

function listBoards(): SavedBoard[] {
  try {
    const raw = localStorage.getItem('dreamkeeper_boards')
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function loadBoard(id: string): SavedBoard | null {
  const boards = listBoards()
  return boards.find(b => b.id === id) ?? null
}

function saveBoard(board: SavedBoard) {
  const boards = listBoards().filter(b => b.id !== board.id)
  boards.unshift({ ...board, updatedAt: new Date().toISOString() })
  localStorage.setItem('dreamkeeper_boards', JSON.stringify(boards))
}

function generateId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

export function DreamKeeper() {
  const { id: boardId } = useParams()
  const navigate = useNavigate()
  const canvasRef = useRef<HTMLDivElement>(null)
  const [title, setTitle] = useState('My Dream Keeper')
  const [items, setItems] = useState<BoardItem[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [dragState, setDragState] = useState<DragState | null>(null)
  const [isExporting, setIsExporting] = useState(false)
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const [allBoards, setAllBoards] = useState<SavedBoard[]>([])
  const [showBoardList, setShowBoardList] = useState(false)
  const autoSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // On mount: if no boardId, create a new one and redirect
  useEffect(() => {
    if (!boardId) {
      navigate(`/dreamkeeper/${generateId()}`, { replace: true })
      return
    }
    const saved = loadBoard(boardId)
    if (saved) {
      setTitle(saved.title)
      setItems(saved.items)
      setSavedAt(saved.updatedAt)
    }
    setAllBoards(listBoards())
  }, [boardId, navigate])

  // Auto-save 1 second after any change
  const triggerAutoSave = useCallback(() => {
    if (!boardId) return
    if (autoSaveRef.current) clearTimeout(autoSaveRef.current)
    autoSaveRef.current = setTimeout(() => {
      saveBoard({ id: boardId, title, items, updatedAt: new Date().toISOString() })
      setSavedAt(new Date().toISOString())
      setAllBoards(listBoards())
    }, 1000)
  }, [boardId, title, items])

  useEffect(() => {
    if (!boardId) return
    triggerAutoSave()
    return () => { if (autoSaveRef.current) clearTimeout(autoSaveRef.current) }
  }, [title, items, triggerAutoSave, boardId])

  const addText = () => {
    const newItem: BoardItem = {
      id: Date.now().toString(),
      type: 'text',
      content: 'Double-click to edit',
      x: 80 + Math.random() * 200,
      y: 80 + Math.random() * 200,
      width: 220,
      height: 64,
      rotation: (Math.random() - 0.5) * 6,
      zIndex: items.length + 1,
    }
    setItems(prev => [...prev, newItem])
    setSelectedId(newItem.id)
  }

  const addImageByUrl = () => {
    const url = window.prompt('Paste an image URL:')
    if (!url) return
    const newItem: BoardItem = {
      id: Date.now().toString(),
      type: 'image',
      content: url,
      x: 80 + Math.random() * 200,
      y: 80 + Math.random() * 200,
      width: 240,
      height: 180,
      rotation: (Math.random() - 0.5) * 6,
      zIndex: items.length + 1,
    }
    setItems(prev => [...prev, newItem])
    setSelectedId(newItem.id)
  }

  const deleteSelected = () => {
    if (!selectedId) return
    setItems(prev => prev.filter(i => i.id !== selectedId))
    setSelectedId(null)
  }

  const handleTextChange = (id: string, value: string) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, content: value } : i))
  }

  const bringForward = (id: string) => {
    setItems(prev => {
      const maxZ = Math.max(...prev.map(i => i.zIndex))
      return prev.map(i => i.id === id ? { ...i, zIndex: maxZ + 1 } : i)
    })
  }

  const onMouseDown = useCallback((e: React.MouseEvent, item: BoardItem) => {
    if (editingId === item.id) return
    e.preventDefault()
    bringForward(item.id)
    setSelectedId(item.id)
    setDragState({
      itemId: item.id,
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      startItemX: item.x,
      startItemY: item.y,
    })
  }, [editingId])

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragState) return
    const dx = e.clientX - dragState.startMouseX
    const dy = e.clientY - dragState.startMouseY
    setItems(prev => prev.map(i =>
      i.id === dragState.itemId
        ? { ...i, x: dragState.startItemX + dx, y: dragState.startItemY + dy }
        : i
    ))
  }, [dragState])

  const onMouseUp = useCallback(() => {
    setDragState(null)
  }, [])

  const exportAsImage = async () => {
    if (!canvasRef.current || isExporting) return
    setIsExporting(true)
    try {
      const { default: html2canvas } = await import('html2canvas')
      const canvas = await html2canvas(canvasRef.current, {
        backgroundColor: '#ffffff',
        scale: 2,
        logging: false,
        useCORS: true,
      })
      const link = document.createElement('a')
      link.download = `${title.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.png`
      link.href = canvas.toDataURL('image/png')
      link.click()
    } catch (err) {
      console.error('Export failed:', err)
      alert('Export failed. Make sure images are from HTTPS sources.')
    } finally {
      setIsExporting(false)
    }
  }

  const openBoard = (id: string) => {
    navigate(`/dreamkeeper/${id}`)
    setShowBoardList(false)
  }

  const newBoard = () => {
    navigate(`/dreamkeeper/${generateId()}`)
    setShowBoardList(false)
  }

  const deleteBoard = (id: string) => {
    const boards = listBoards().filter(b => b.id !== id)
    localStorage.setItem('dreamkeeper_boards', JSON.stringify(boards))
    setAllBoards(boards)
    if (id === boardId && boards.length > 0) {
      navigate(`/dreamkeeper/${boards[0].id}`, { replace: true })
    } else if (id === boardId) {
      navigate(`/dreamkeeper/${generateId()}`, { replace: true })
    }
  }

  const addImageItem = (content: string) => {
    const newItem: BoardItem = {
      id: generateId(),
      type: 'image',
      content,
      x: 60 + Math.random() * 300,
      y: 60 + Math.random() * 200,
      width: 280,
      height: 210,
      rotation: (Math.random() - 0.5) * 6,
      zIndex: items.length + 1,
    }
    setItems(prev => [...prev, newItem])
    setSelectedId(newItem.id)
  }

  // Global paste handler — image data or image URL
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      // Don't steal paste when user is editing a text item or the title input
      const target = e.target as HTMLElement
      if (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT') return

      const items = e.clipboardData?.items
      if (!items) return

      // 1. Image data (screenshot, browser "Copy Image")
      for (const item of Array.from(items)) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile()
          if (!file) continue
          const reader = new FileReader()
          reader.onload = ev => {
            const dataUrl = ev.target?.result as string
            if (dataUrl) addImageItem(dataUrl)
          }
          reader.readAsDataURL(file)
          e.preventDefault()
          return
        }
      }

      // 2. Plain text — treat as URL if it looks like one
      for (const item of Array.from(items)) {
        if (item.type === 'text/plain') {
          item.getAsString(text => {
            const trimmed = text.trim()
            if (/^https?:\/\/.+/i.test(trimmed)) {
              addImageItem(trimmed)
            }
          })
          e.preventDefault()
          return
        }
      }
    }

    window.addEventListener('paste', handlePaste)
    return () => window.removeEventListener('paste', handlePaste)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items])

  return (
    <div
      className="flex flex-col h-screen bg-green-50 select-none"
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
    >
      {/* Header */}
      <header className="flex-none bg-white border-b-2 border-green-200 px-4 sm:px-6 py-3 flex items-center justify-between gap-3 flex-wrap shadow-sm">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => navigate('/')}
            className="p-2 rounded-full hover:bg-green-100 border-2 border-black transition flex-none"
            title="Back to Dashboard"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="min-w-0">
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="text-xl sm:text-2xl font-bold bg-transparent border-none focus:outline-none text-gray-900 min-w-0 w-48 sm:w-72 block"
            />
            <p className="text-xs text-green-600/80 hidden sm:block mt-0.5">
              Create your own collage of your dream! Think vision board, meets photo gallery.
            </p>
          </div>
          {savedAt && (
            <span className="text-xs text-green-600/70 flex items-center gap-1 flex-none">
              <Save size={11} />
              {new Date(savedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>

        <div className="flex gap-2 flex-wrap items-center">
          {/* Board switcher */}
          <div className="relative">
            <button
              onClick={() => setShowBoardList(v => !v)}
              className="flex items-center gap-1.5 bg-green-50 hover:bg-green-100 border-2 border-black text-gray-800 px-3 py-1.5 rounded-lg transition text-sm font-medium"
            >
              Boards ({allBoards.length || 1})
            </button>
            {showBoardList && (
              <div className="absolute top-full right-0 mt-1 bg-white border-4 border-black shadow-lg z-50 min-w-56">
                <button
                  onClick={newBoard}
                  className="w-full px-4 py-2 text-left hover:bg-green-50 text-sm font-bold border-b-2 border-gray-100"
                >+ New Board</button>
                {allBoards.map(b => (
                  <div key={b.id} className={`flex items-center gap-2 px-4 py-2 hover:bg-green-50 ${b.id === boardId ? 'bg-green-100 font-bold' : ''}`}>
                    <button className="flex-1 text-left text-sm truncate" onClick={() => openBoard(b.id)}>
                      {b.title}
                    </button>
                    {b.id !== boardId && (
                      <button onClick={() => deleteBoard(b.id)} className="text-red-400 hover:text-red-600 text-xs flex-none">✕</button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <button onClick={addText} className="flex items-center gap-1.5 bg-purple-100 hover:bg-purple-200 border-2 border-black text-gray-800 px-3 py-1.5 rounded-lg transition text-sm font-medium">
            <Type size={16} /> Text
          </button>
          <button onClick={addImageByUrl} className="flex items-center gap-1.5 bg-yellow-100 hover:bg-yellow-200 border-2 border-black text-gray-800 px-3 py-1.5 rounded-lg transition text-sm font-medium">
            <ImageIcon size={16} /> Image
          </button>
          {selectedId && (
            <button onClick={deleteSelected} className="flex items-center gap-1.5 bg-red-100 hover:bg-red-200 border-2 border-red-400 text-red-700 px-3 py-1.5 rounded-lg transition text-sm font-medium">
              <Trash2 size={16} /> Delete
            </button>
          )}
          <button
            onClick={exportAsImage}
            disabled={isExporting}
            className="flex items-center gap-1.5 bg-green-200 hover:bg-green-300 border-2 border-black text-gray-900 px-4 py-1.5 rounded-lg transition text-sm font-bold disabled:opacity-60"
          >
            <Download size={16} />
            {isExporting ? 'Exporting…' : 'Export PNG'}
          </button>
        </div>
      </header>

      {/* Canvas — fills all remaining vertical space; scrollable on mobile */}
      <div className="flex-1 overflow-auto bg-green-50 p-2 sm:p-0">
        <div
          ref={canvasRef}
          className="relative w-full bg-white"
          style={{
            minHeight: 'calc(100vh - 60px)',
            boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
          }}
          onClick={e => {
            if (e.target === e.currentTarget) {
              setSelectedId(null)
              setEditingId(null)
            }
          }}
        >
          {items.length === 0 && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-green-300 pointer-events-none gap-3">
              <ImageIcon size={56} />
              <p className="text-lg text-green-400">Add images or text to your vision board</p>
              <p className="text-sm text-green-300">Drag to arrange · Ctrl+V to paste an image or URL</p>
            </div>
          )}

          {[...items].sort((a, b) => a.zIndex - b.zIndex).map(item => (
            <div
              key={item.id}
              className={`absolute cursor-move transition-shadow ${
                selectedId === item.id
                  ? 'ring-2 ring-green-500 ring-offset-2 shadow-xl'
                  : 'hover:shadow-lg'
              }`}
              style={{
                left: item.x,
                top: item.y,
                width: item.width,
                height: item.type === 'text' ? 'auto' : item.height,
                transform: `rotate(${item.rotation}deg)`,
                zIndex: item.zIndex,
              }}
              onMouseDown={e => onMouseDown(e, item)}
              onClick={e => { e.stopPropagation(); setSelectedId(item.id) }}
              onDoubleClick={() => item.type === 'text' && setEditingId(item.id)}
            >
              {item.type === 'image' ? (
                <img src={item.content} alt="" className="w-full h-full object-contain shadow-md" draggable={false} />
              ) : editingId === item.id ? (
                <textarea
                  autoFocus
                  value={item.content}
                  onChange={e => handleTextChange(item.id, e.target.value)}
                  onBlur={() => setEditingId(null)}
                  className="w-full min-h-[60px] bg-white p-3 text-base font-medium text-gray-900 shadow-md resize-none focus:outline-none border-2 border-green-400"
                />
              ) : (
                <div className="w-full bg-white p-3 text-base font-medium text-gray-900 shadow-md whitespace-pre-wrap break-words border border-gray-100" style={{ minHeight: '60px' }}>
                  {item.content}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Footer hint */}
      <div className="flex-none py-2 text-center text-green-600/50 text-xs border-t border-green-100 bg-white/60">
        Drag items to arrange · Double-click text to edit · Boards auto-save to this device
      </div>
    </div>
  )
}
