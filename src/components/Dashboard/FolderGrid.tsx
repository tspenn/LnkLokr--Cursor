import { Folder } from '@/types'

interface FolderGridProps {
  folders: Folder[]
  selectedFolderId: string | null
  onSelectFolder: (id: string | null) => void
}

export function FolderGrid({ folders, selectedFolderId, onSelectFolder }: FolderGridProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      <button
        onClick={() => onSelectFolder(null)}
        className={`p-4 rounded-lg border-2 transition text-center ${
          selectedFolderId === null
            ? 'bg-primary-50 border-primary-300'
            : 'bg-white border-gray-200 hover:border-gray-300'
        }`}
      >
        <div className="text-2xl mb-2">📌</div>
        <p className="font-medium text-sm text-gray-900">All Links</p>
      </button>

      {folders.map(folder => (
        <button
          key={folder.id}
          onClick={() => onSelectFolder(folder.id)}
          className={`p-4 rounded-lg border-2 transition text-center ${
            selectedFolderId === folder.id
              ? 'bg-primary-50 border-primary-300'
              : 'bg-white border-gray-200 hover:border-gray-300'
          }`}
        >
          <div className="text-2xl mb-2">{folder.icon}</div>
          <p className="font-medium text-sm text-gray-900 line-clamp-1">
            {folder.name}
          </p>
        </button>
      ))}
    </div>
  )
}
