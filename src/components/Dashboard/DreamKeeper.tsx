import { useState, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Download, ArrowLeft, Type, Image as ImageIcon, Trash2 } from 'lucide-react'

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

export function DreamKeeper() {
  const { id: _boardId } = useParams()
  const navigate = useNavigate()
  const canvasRef = useRef<HTMLDivElement>(null)
  const [title, setTitle] = useState('My Dream Keeper')
  const [items, setItems] = useState<BoardItem[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [dragState, setDragState] = useState<DragState | null>(null)
  const [isExporting, setIsExporting] = useState(false)

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
        </div>

        <div className="flex gap-2">
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
        Drag items to arrange · Double-click text to edit · Export saves a PNG
      </p>
    </div>
  )
}
