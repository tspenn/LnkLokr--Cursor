import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://psbdjnqcjpxapypcfigx.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBzYmRqbnFjanB4YXB5cGNmaWd4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzODA5OTAsImV4cCI6MjA4OTk1Njk5MH0.nOqbHOZYT8GKfqgUrXbZam4Q9B973gqWe_bC5drQVGk'
const APP_ORIGIN = 'https://lnklokr.vercel.app'

// Shared chrome.storage.local adapter so the popup and service worker
// both read/write Supabase sessions from the same bucket.
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
    storage: {
      getItem: async (key) => {
        const result = await chrome.storage.local.get([key])
        return result[key] ?? null
      },
      setItem: async (key, value) => {
        await chrome.storage.local.set({ [key]: value })
      },
      removeItem: async (key) => {
        await chrome.storage.local.remove([key])
      },
    },
  },
})

function detectContentType(url, mimeType = '') {
  const urlLower = url.toLowerCase()
  const mimeLower = mimeType.toLowerCase()

  if (mimeLower.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|svg|bmp|ico)(\?|$)/.test(urlLower)) {
    return 'image'
  }
  if (mimeLower === 'application/pdf' || urlLower.endsWith('.pdf')) {
    return 'pdf'
  }
  if (
    mimeLower.startsWith('application/') ||
    mimeLower.startsWith('video/') ||
    mimeLower.startsWith('audio/') ||
    /\.(zip|rar|7z|tar|gz|doc|docx|xls|xlsx|ppt|pptx|txt|mp4|mp3|avi|mov)(\?|$)/.test(urlLower)
  ) {
    return 'file'
  }
  return 'url'
}

function notify(title, message, priority = 1) {
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icons/icon-128.png',
    title,
    message,
    priority,
  })
}

async function getAuthenticatedUser() {
  const { data: userData, error } = await supabase.auth.getUser()
  if (error || !userData?.user) throw new Error('Not authenticated. Please sign in to LnkLokr first.')
  return userData.user
}

async function getUserIsPremium(userId) {
  try {
    const { data } = await supabase
      .from('users')
      .select('is_premium')
      .eq('id', userId)
      .single()
    return data?.is_premium ?? false
  } catch {
    return false
  }
}

// ─── Scrape OG metadata for a webpage URL ────────────────────────────────────
async function scrapeMetadata(url) {
  try {
    const res = await fetch(`${APP_ORIGIN}/api/scrape?url=${encodeURIComponent(url)}`)
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

// ─── Save a webpage/URL link directly to the links table ─────────────────────
async function saveWebpageLink({ url, title, description, tabTitle, status = 'keep', folderId = null }) {
  try {
    const user = await getAuthenticatedUser()

    // Scrape server-side metadata — non-fatal if it fails
    const meta = await scrapeMetadata(url)

    const { error } = await supabase.from('links').insert({
      user_id: user.id,
      url,
      title: meta?.title || title || tabTitle || url,
      description: meta?.description || description || null,
      thumbnail_url: meta?.thumbnail_url || null,
      icon: meta?.icon || null,
      status,
      folder_id: folderId || null,
      content_type: 'url',
      tags: [],
      is_favorite: false,
      listing_price: meta?.listing_price || null,
      listing_currency: meta?.listing_currency || null,
      listing_colors: meta?.listing_colors || null,
      listing_options: meta?.listing_options || null,
    })

    if (error) throw new Error(error.message)
    return { success: true }
  } catch (err) {
    return { success: false, error: err.message }
  }
}

// ─── Save an image/file — premium uploads to Storage; free saves the URL only ─
async function saveFileToLnklokr(blob, metadata) {
  try {
    const user = await getAuthenticatedUser()
    const isPremium = await getUserIsPremium(user.id)
    const contentType = detectContentType(metadata.src, blob.type)
    const status = metadata.status || 'keep'

    if (isPremium) {
      // ── Premium: upload blob to Supabase Storage, record in links table ────
      const timestamp = Date.now()
      const urlPath = new URL(metadata.src).pathname
      const originalFilename = urlPath.split('/').pop() || 'file'
      const sanitizedFilename = originalFilename
        .replace(/[^a-zA-Z0-9.-]/g, '_')
        .replace(/_{2,}/g, '_')
        .slice(0, 100)
      const filename = `${user.id}/${timestamp}-${sanitizedFilename}`

      const { error: uploadError } = await supabase.storage
        .from('saved-images')
        .upload(filename, blob, {
          contentType: blob.type,
          cacheControl: '3600',
          upsert: false,
        })
      if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`)

      const { data: publicUrlData } = supabase.storage.from('saved-images').getPublicUrl(filename)
      const publicUrl = publicUrlData.publicUrl

      const { error: recordError } = await supabase.from('links').insert({
        user_id: user.id,
        url: publicUrl,
        title: metadata.title || originalFilename,
        description: metadata.alt || null,
        thumbnail_url: contentType === 'image' ? publicUrl : null,
        status,
        folder_id: metadata.folderId || null,
        content_type: contentType,
        tags: [],
        is_favorite: false,
      })

      if (recordError) {
        await supabase.storage.from('saved-images').remove([filename])
        throw new Error(`Metadata save failed: ${recordError.message}`)
      }

      return { success: true, data: { publicUrl, contentType } }
    } else {
      // ── Free tier: save just the source URL as a link (no blob upload) ────
      const { error } = await supabase.from('links').insert({
        user_id: user.id,
        url: metadata.src,
        title: metadata.title || metadata.alt || metadata.src,
        description: metadata.alt || null,
        thumbnail_url: contentType === 'image' ? metadata.src : null,
        status,
        folder_id: metadata.folderId || null,
        content_type: contentType,
        tags: [],
        is_favorite: false,
      })
      if (error) throw new Error(error.message)
      return { success: true, data: { publicUrl: metadata.src, contentType } }
    }
  } catch (err) {
    return { success: false, error: err.message }
  }
}

// ─── Context menu setup ───────────────────────────────────────────────────────
const STATUSES = ['keep', 'borrow', 'share', 'bury']
const STATUS_LABELS = { keep: '📦 Keep', borrow: '🔄 Borrow', share: '📤 Share', bury: '🔒 Bury' }

function parseMenuId(menuId) {
  const match = String(menuId).match(/^(image|link|selection)-(keep|borrow|share|bury)(?:-(none|f-(.+)))?$/)
  if (!match) return null
  return { type: match[1], status: match[2], folderId: match[4] || null }
}

async function loadFoldersByScope() {
  const foldersByScope = { keep: [], borrow: [], share: [], bury: [] }
  try {
    const user = await getAuthenticatedUser()
    const { data } = await supabase
      .from('folders')
      .select('id, name, scope')
      .eq('user_id', user.id)
      .order('position')
    for (const folder of data ?? []) {
      const scope = STATUSES.includes(folder.scope) ? folder.scope : 'keep'
      foldersByScope[scope].push(folder)
    }
  } catch {
    // Not signed in — menus still work without folders
  }
  return foldersByScope
}

async function rebuildContextMenus() {
  await chrome.contextMenus.removeAll()

  chrome.contextMenus.create({ id: 'save-image', title: 'Save Image to LnkLokr…', contexts: ['image'] })
  chrome.contextMenus.create({ id: 'save-link', title: 'Save Link to LnkLokr…', contexts: ['link'] })
  chrome.contextMenus.create({ id: 'save-selection', title: 'Save Selection to LnkLokr…', contexts: ['selection'] })

  const foldersByScope = await loadFoldersByScope()

  for (const type of ['image', 'link', 'selection']) {
    const contexts = [type === 'image' ? 'image' : type === 'link' ? 'link' : 'selection']
    for (const status of STATUSES) {
      const parentId = `${type}-${status}`
      chrome.contextMenus.create({
        id: parentId,
        title: STATUS_LABELS[status],
        parentId: `save-${type}`,
        contexts,
      })

      const folders = foldersByScope[status]
      if (folders.length === 0) continue

      chrome.contextMenus.create({
        id: `${parentId}-none`,
        title: 'No folder',
        parentId,
        contexts,
      })
      for (const folder of folders) {
        chrome.contextMenus.create({
          id: `${parentId}-f-${folder.id}`,
          title: String(folder.name || 'Folder').slice(0, 60),
          parentId,
          contexts,
        })
      }
    }
  }
}

chrome.runtime.onInstalled.addListener(() => {
  rebuildContextMenus()
})

chrome.runtime.onStartup.addListener(() => {
  rebuildContextMenus()
})

rebuildContextMenus()

// ─── Context menu click handler ───────────────────────────────────────────────
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab?.id) return

  const parsed = parseMenuId(info.menuItemId)
  if (!parsed) return

  const { type, status, folderId } = parsed

  // ── Save image ─────────────────────────────────────────────────────────────
  if (type === 'image') {
    const imageSrc = info.srcUrl
    if (!imageSrc) return

    try {
      const response = await fetch(imageSrc)
      const blob = await response.blob()

      const metadata = {
        src: imageSrc,
        pageTitle: tab.title || '',
        pageUrl: tab.url || '',
        alt: '',
        title: 'Saved Image',
        status,
        folderId,
      }

      const result = await saveFileToLnklokr(blob, metadata)
      if (result.success) {
        const label = result.data.contentType === 'image' ? 'Image' : result.data.contentType === 'pdf' ? 'PDF' : 'File'
        notify(`${label} saved to ${status.charAt(0).toUpperCase() + status.slice(1)}!`, 'Saved to LnkLokr')
      } else {
        notify('Save Failed', result.error || 'Failed to save', 2)
      }
    } catch {
      notify('Error', 'Failed to fetch or save image', 2)
    }
    return
  }

  // ── Save link ──────────────────────────────────────────────────────────────
  if (type === 'link') {
    const url = info.linkUrl || info.srcUrl || tab.url
    const contentType = detectContentType(url)

    if (contentType !== 'url') {
      try {
        const response = await fetch(url)
        const blob = await response.blob()
        const metadata = {
          src: url,
          pageTitle: tab.title || '',
          pageUrl: tab.url || '',
          alt: '',
          title: url.split('/').pop() || 'Saved File',
          status,
          folderId,
        }
        const result = await saveFileToLnklokr(blob, metadata)
        if (result.success) {
          const label = result.data.contentType === 'image' ? 'Image' : result.data.contentType === 'pdf' ? 'PDF' : 'File'
          notify(`${label} saved to ${status.charAt(0).toUpperCase() + status.slice(1)}!`, 'Saved to LnkLokr')
        } else {
          notify('Save Failed', result.error || 'Failed to save', 2)
        }
      } catch {
        notify('Error', 'Failed to fetch or save file', 2)
      }
    } else {
      const result = await saveWebpageLink({
        url,
        title: info.selectionText || url,
        description: null,
        tabTitle: tab.title,
        status,
        folderId,
      })
      if (result.success) {
        notify(`Link saved to ${status.charAt(0).toUpperCase() + status.slice(1)}!`, 'Saved to LnkLokr')
      } else {
        notify('Save Failed', result.error || 'Failed to save link', 2)
      }
    }
    return
  }

  // ── Save selected text ─────────────────────────────────────────────────────
  if (type === 'selection') {
    const url = tab.url || ''
    const result = await saveWebpageLink({
      url,
      title: info.selectionText || tab.title || url,
      description: info.selectionText || null,
      tabTitle: tab.title,
      status,
      folderId,
    })
    if (result.success) {
      notify(`Saved to ${status.charAt(0).toUpperCase() + status.slice(1)}!`, 'Saved to LnkLokr')
    } else {
      notify('Save Failed', result.error || 'Failed to save', 2)
    }
  }
})

// ─── Message listener (popup ↔ background) ───────────────────────────────────
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  // Popup sends its Supabase session so the service worker can use it
  if (message.type === 'SYNC_SESSION') {
    supabase.auth.setSession(message.session).then(async () => {
      await rebuildContextMenus()
      sendResponse({ success: true })
    })
    return true
  }

  // Legacy token helpers — kept for compatibility
  if (message.type === 'AUTH_TOKEN') {
    chrome.storage.local.get(['auth_token'], (result) => sendResponse({ token: result.auth_token }))
    return true
  }
  if (message.type === 'SAVE_AUTH_TOKEN') {
    chrome.storage.local.set({ auth_token: message.token }, () => sendResponse({ success: true }))
    return true
  }
})
