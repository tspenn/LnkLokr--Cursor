import { useState } from 'react'
import { Folder } from '@/types'
import { addFolder } from '@/lib/dataService'
import { Icon } from '../shared/Icon'

export type FolderScope = 'keep' | 'borrow' | 'share' | 'bury'

interface FolderBarProps {
  scope: FolderScope
  userId: string
  folders: Folder[]
  selectedFolderId: string | null
  onSelectFolder: (id: string | null) => void
  onFolderCreated: (folder: Folder) => void
  onExportFolder?: (folder: Folder) => void
  /** Tailwind classes applied to the active tab button (default: black on white) */
  activeClass?: string
  /** Tailwind hover class for inactive tabs (default: hover:bg-gray-100) */
  hoverClass?: string
  /** Tailwind classes for the "New Folder" button hover state */
  newBtnHoverClass?: string
}

export function FolderBar({
  scope,
  userId,
  folders,
  selectedFolderId,
  onSelectFolder,
  onFolderCreated,
  onExportFolder,
  activeClass = 'bg-black text-white',
  hoverClass = 'hover:bg-gray-100',
  newBtnHoverClass = 'hover:bg-gray-100',
}: FolderBarProps) {
  const [showNew, setShowNew] = useState(false)
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)

  const handleCreate = async () => {
    const name = newName.trim()
    if (!name) return
    setCreating(true)
    try {
      const created = await addFolder(true, userId, {
        name,
        position: folders.length,
        scope,
      })
      onFolderCreated(created)
      onSelectFolder(created.id)
      setNewName('')
      setShowNew(false)
    } finally {
      setCreating(false)
    }
  }

  const tabBase = 'px-4 py-2 font-medium border-4 border-black transition'

  return (
    <div className="flex gap-2 flex-wrap items-center">
      {folders.length > 0 && (
        <>
          <button
            onClick={() => onSelectFolder(null)}
            className={`${tabBase} ${!selectedFolderId ? activeClass : `bg-white ${hoverClass}`}`}
          >
            All
          </button>
          {folders.map(folder => (
            <div key={folder.id} className="flex items-stretch">
              <button
                onClick={() => onSelectFolder(folder.id)}
                className={`${tabBase} ${selectedFolderId === folder.id ? activeClass : `bg-white ${hoverClass}`}`}
              >
                {folder.icon ? <span className="mr-1">{folder.icon}</span> : null}
                {folder.name}
              </button>
              {onExportFolder && (
                <button
                  type="button"
                  onClick={() => onExportFolder(folder)}
                  title={`Export ${folder.name} as CSV`}
                  className={`${tabBase} border-l-0 ${selectedFolderId === folder.id ? activeClass : `bg-white ${hoverClass}`}`}
                >
                  <Icon name="download" size={14} />
                </button>
              )}
            </div>
          ))}
        </>
      )}

      {showNew ? (
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') handleCreate()
              if (e.key === 'Escape') { setShowNew(false); setNewName('') }
            }}
            className="px-3 py-1.5 text-sm font-medium border-4 border-black focus:outline-none focus:ring-2 focus:ring-current"
            placeholder="Folder name..."
            autoFocus
          />
          <button
            onClick={handleCreate}
            disabled={creating || !newName.trim()}
            className="px-3 py-1.5 bg-black text-white text-sm font-bold hover:bg-gray-800 disabled:opacity-50 transition border-4 border-black"
          >
            {creating ? '…' : 'Save'}
          </button>
          <button
            onClick={() => { setShowNew(false); setNewName('') }}
            className="px-3 py-1.5 bg-white text-sm font-bold border-4 border-black hover:bg-gray-100 transition"
          >
            ✕
          </button>
        </div>
      ) : (
        <button
          onClick={() => setShowNew(true)}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium border-4 border-black bg-white transition ${newBtnHoverClass}`}
        >
          <Icon name="plus" size={14} /> New Folder
        </button>
      )}
    </div>
  )
}
