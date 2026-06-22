/**
 * opfsStore — Origin Private File System service for local binary storage.
 *
 * Free tier: full-size files (images, PDFs, docs) live here on-device.
 * Only a small thumbnail and metadata record go to Supabase.
 *
 * OPFS data survives:  page reload · PWA reinstall · "clear history" · "clear cache"
 * OPFS data is lost:   "Clear site data" (user must explicitly choose this)
 *
 * Files are stored at:  OPFS root / {userId} / files / {fileId}
 */

const OPFS_SUPPORTED =
  typeof window !== 'undefined' &&
  'storage' in navigator &&
  typeof navigator.storage.getDirectory === 'function'

export const opfsStore = {
  isSupported(): boolean {
    return OPFS_SUPPORTED
  },

  /** Request persistent storage so the browser never auto-evicts OPFS data. */
  async requestPersistence(): Promise<boolean> {
    if (!('persist' in navigator.storage)) return false
    return navigator.storage.persist()
  },

  async _userFilesDir(userId: string): Promise<FileSystemDirectoryHandle> {
    const root = await navigator.storage.getDirectory()
    const userDir = await root.getDirectoryHandle(userId, { create: true })
    return userDir.getDirectoryHandle('files', { create: true })
  },

  /**
   * Save a File to OPFS. Returns the fileId used to retrieve it later.
   * Also requests persistent storage on first write.
   */
  async saveFile(userId: string, file: File): Promise<string> {
    const ext = file.name.split('.').pop()?.toLowerCase() ?? 'bin'
    const fileId = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
    const dir = await this._userFilesDir(userId)
    const handle = await dir.getFileHandle(fileId, { create: true })
    const writable = await handle.createWritable()
    await writable.write(file)
    await writable.close()
    // Best-effort persistence request — non-fatal if denied
    this.requestPersistence().catch(() => {})
    return fileId
  },

  /**
   * Returns a blob URL for the stored file, or null if not on this device.
   * The caller must revoke the URL with URL.revokeObjectURL() when done.
   */
  async getFileUrl(userId: string, fileId: string): Promise<string | null> {
    try {
      const dir = await this._userFilesDir(userId)
      const handle = await dir.getFileHandle(fileId)
      const file = await handle.getFile()
      return URL.createObjectURL(file)
    } catch {
      return null
    }
  },

  /**
   * Returns the raw File object, or null if not on this device.
   */
  async getFile(userId: string, fileId: string): Promise<File | null> {
    try {
      const dir = await this._userFilesDir(userId)
      const handle = await dir.getFileHandle(fileId)
      return handle.getFile()
    } catch {
      return null
    }
  },

  /**
   * Check whether a file exists on this device without reading its contents.
   */
  async hasFile(userId: string, fileId: string): Promise<boolean> {
    try {
      const dir = await this._userFilesDir(userId)
      await dir.getFileHandle(fileId)
      return true
    } catch {
      return false
    }
  },

  /**
   * Delete a file. Non-fatal if already gone.
   */
  async deleteFile(userId: string, fileId: string): Promise<void> {
    try {
      const dir = await this._userFilesDir(userId)
      await dir.removeEntry(fileId)
    } catch {
      // already gone or not on this device — both fine
    }
  },

  /**
   * List all fileIds stored for this user on this device.
   */
  async listFileIds(userId: string): Promise<string[]> {
    try {
      const dir = await this._userFilesDir(userId)
      const ids: string[] = []
      for await (const [name] of dir as unknown as AsyncIterable<[string, FileSystemHandle]>) {
        ids.push(name)
      }
      return ids
    } catch {
      return []
    }
  },

  /**
   * Export all local files as { fileId, file } pairs.
   * Used by ExportPanel to let users download their local files.
   */
  async exportAll(userId: string): Promise<Array<{ fileId: string; file: File }>> {
    try {
      const dir = await this._userFilesDir(userId)
      const result: Array<{ fileId: string; file: File }> = []
      for await (const [name, handle] of dir as unknown as AsyncIterable<[string, FileSystemHandle]>) {
        if (handle.kind === 'file') {
          const file = await (handle as FileSystemFileHandle).getFile()
          result.push({ fileId: name, file })
        }
      }
      return result
    } catch {
      return []
    }
  },
}

/**
 * Generate a small JPEG thumbnail from an image File.
 * Returns a base64 data URL (~10–30 KB) safe to store inline in Supabase.
 * Returns null for non-image files.
 */
export async function generateThumbnail(file: File, maxWidth = 240): Promise<string | null> {
  if (!file.type.startsWith('image/')) return null
  return new Promise((resolve) => {
    const img = new Image()
    const objUrl = URL.createObjectURL(file)
    img.onload = () => {
      const ratio = Math.min(maxWidth / img.width, maxWidth / img.height, 1)
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.width * ratio)
      canvas.height = Math.round(img.height * ratio)
      const ctx = canvas.getContext('2d')
      if (!ctx) { URL.revokeObjectURL(objUrl); resolve(null); return }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(objUrl)
      resolve(canvas.toDataURL('image/jpeg', 0.72))
    }
    img.onerror = () => { URL.revokeObjectURL(objUrl); resolve(null) }
    img.src = objUrl
  })
}

/**
 * Trigger a browser download of a File object.
 */
export function downloadFile(file: File, fileName?: string): void {
  const url = URL.createObjectURL(file)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName ?? file.name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
