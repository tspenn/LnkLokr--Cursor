import { Folder } from '@/types'
import { Icon } from '../shared/Icon'

interface FolderGridProps {
  folders: Folder[]
  selectedFolderId: string | null
  onSelectFolder: (id: string | null) => void
  onExportFolder?: (folder: Folder) => void
}

export function FolderGrid({ folders, selectedFolderId, onSelectFolder, onExportFolder }: FolderGridProps) {
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
        <div
          key={folder.id}
          className={`relative rounded-lg border-2 transition ${
            selectedFolderId === folder.id
              ? 'bg-primary-50 border-primary-300'
              : 'bg-white border-gray-200 hover:border-gray-300'
          }`}
        >
          <button
            onClick={() => onSelectFolder(folder.id)}
            className="w-full p-4 text-center"
          >
            <div className="text-2xl mb-2">{folder.icon}</div>
            <p className="font-medium text-sm text-gray-900 line-clamp-1">
              {folder.name}
            </p>
          </button>
          {onExportFolder && (
            <button
              type="button"
              onClick={() => onExportFolder(folder)}
              title={`Export ${folder.name} as CSV`}
              className="absolute top-2 right-2 p-1.5 rounded-md text-gray-400 hover:text-gray-800 hover:bg-white/80"
            >
              <Icon name="download" size={14} />
            </button>
          )}
        </div>
      ))}
    </div>
  )
}
