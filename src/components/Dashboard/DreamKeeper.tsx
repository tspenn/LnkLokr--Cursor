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
        backgroundColor: '#f8f1e3',
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

  return (
    <div
      className="min-h-screen bg-[#f4e9d8] p-6 font-serif select-none"
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
    >
      {/* Header */}
      <div className="max-w-6xl mx-auto mb-6 flex items-center justify-between border-b-4 border-amber-950 pb-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/')}
            className="text-amber-900 hover:text-amber-700 transition"
            title="Back to Dashboard"
          >
            <ArrowLeft size={28} />
          </button>
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            className="text-3xl font-bold bg-transparent border-none focus:outline-none text-amber-950 w-80"
          />
          {savedAt && (
            <span className="text-xs text-amber-600/70 flex items-center gap-1">
              <Save size={12} />
              Saved {new Date(savedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>

        <div className="flex gap-2 flex-wrap justify-end">
          {/* Board list toggle */}
          <div className="relative">
            <button
              onClick={() => setShowBoardList(v => !v)}
              className="flex items-center gap-2 bg-amber-50 hover:bg-amber-100 text-amber-900 px-4 py-2 rounded-xl transition border-2 border-amber-300 text-sm"
            >
              Boards ({allBoards.length || 1})
            </button>
            {showBoardList && (
              <div className="absolute top-full right-0 mt-1 bg-white border-4 border-amber-900 shadow-lg z-50 min-w-64">
                <button
                  onClick={newBoard}
                  className="w-full px-4 py-2 text-left hover:bg-amber-50 text-sm font-bold text-amber-900 border-b-2 border-amber-200"
                >
                  + New Board
                </button>
                {allBoards.map(b => (
                  <div key={b.id} className={`flex items-center gap-2 px-4 py-2 hover:bg-amber-50 ${b.id === boardId ? 'bg-amber-100' : ''}`}>
                    <button className="flex-1 text-left text-sm truncate" onClick={() => openBoard(b.id)}>
                      {b.title}
                    </button>
                    {b.id !== boardId && (
                      <button
                        onClick={() => deleteBoard(b.id)}
                        className="text-red-400 hover:text-red-600 text-xs"
                        title="Delete board"
                      >✕</button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={addText}
            className="flex items-center gap-2 bg-amber-100 hover:bg-amber-200 text-amber-900 px-4 py-2 rounded-xl transition border-2 border-amber-300"
          >
            <Type size={18} /> Add Text
          </button>
          <button
            onClick={addImageByUrl}
            className="flex items-center gap-2 bg-amber-100 hover:bg-amber-200 text-amber-900 px-4 py-2 rounded-xl transition border-2 border-amber-300"
          >
            <ImageIcon size={18} /> Add Image
          </button>
          {selectedId && (
            <button
              onClick={deleteSelected}
              className="flex items-center gap-2 bg-red-100 hover:bg-red-200 text-red-700 px-4 py-2 rounded-xl transition border-2 border-red-300"
            >
              <Trash2 size={18} /> Delete
            </button>
          )}
          <button
            onClick={exportAsImage}
            disabled={isExporting}
            className="flex items-center gap-2 bg-amber-900 hover:bg-amber-800 text-white px-5 py-2 rounded-xl transition disabled:opacity-60"
          >
            <Download size={18} />
            {isExporting ? 'Exporting…' : 'Export PNG'}
          </button>
        </div>
      </div>

      {/* Canvas */}
      <div
        ref={canvasRef}
        className="max-w-6xl mx-auto min-h-[680px] relative overflow-hidden"
        style={{
          background: '#f8f1e3',
          border: '14px solid #3c2f1e',
          boxShadow: 'inset 0 0 60px rgba(0,0,0,0.3), 0 8px 32px rgba(0,0,0,0.3)',
        }}
        onClick={e => {
          if (e.target === e.currentTarget) {
            setSelectedId(null)
            setEditingId(null)
          }
        }}
      >
        {items.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-amber-700/50 text-lg pointer-events-none gap-2">
            <ImageIcon size={48} />
            <p>Add images or text to your board</p>
          </div>
        )}

        {[...items].sort((a, b) => a.zIndex - b.zIndex).map(item => (
          <div
            key={item.id}
            className={`absolute cursor-move transition-shadow ${
              selectedId === item.id
                ? 'ring-2 ring-amber-600 ring-offset-1 shadow-xl'
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
              <img
                src={item.content}
                alt=""
                className="w-full h-full object-contain shadow-md"
                draggable={false}
              />
            ) : editingId === item.id ? (
              <textarea
                autoFocus
                value={item.content}
                onChange={e => handleTextChange(item.id, e.target.value)}
                onBlur={() => setEditingId(null)}
                className="w-full min-h-[60px] bg-white/90 p-3 text-base font-medium text-amber-950 shadow-md resize-none focus:outline-none border-none"
                style={{ fontFamily: 'Georgia, serif' }}
              />
            ) : (
              <div
                className="w-full bg-white/90 p-3 text-base font-medium text-amber-950 shadow-md whitespace-pre-wrap break-words"
                style={{ fontFamily: 'Georgia, serif', minHeight: '60px' }}
              >
                {item.content}
              </div>
            )}
          </div>
        ))}
      </div>

      <p className="text-center text-amber-700/60 mt-6 text-sm font-sans">
        Drag items to arrange · Double-click text to edit · Boards auto-save to this device
      </p>
    </div>
  )
}
