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
async function saveWebpageLink({ url, title, description, tabTitle }) {
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
      status: 'keep',
      content_type: 'url',
      tags: [],
      is_favorite: false,
    })

    if (error) throw new Error(error.message)
    return { success: true }
  } catch (err) {
    return { success: false, error: err.message }
  }
}

// ─── Upload a binary file (image/pdf/etc.) to Supabase Storage ───────────────
async function saveFileToLnklokr(blob, metadata) {
  try {
    const user = await getAuthenticatedUser()

    const timestamp = Date.now()
    const urlPath = new URL(metadata.src).pathname
    const originalFilename = urlPath.split('/').pop() || 'file'
    const sanitizedFilename = originalFilename
      .replace(/[^a-zA-Z0-9.-]/g, '_')
      .replace(/_{2,}/g, '_')
      .slice(0, 100)
    const filename = `${user.id}/${timestamp}-${sanitizedFilename}`
    const contentType = detectContentType(metadata.src, blob.type)

    const { error: uploadError } = await supabase.storage
      .from('saved-images')
      .upload(filename, blob, {
        contentType: blob.type,
        cacheControl: '3600',
        upsert: false,
      })
    if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`)

    const { data: publicUrlData } = supabase.storage.from('saved-images').getPublicUrl(filename)

    const { data: recordData, error: recordError } = await supabase
      .from('saved_items')
      .insert({
        user_id: user.id,
        storage_path: filename,
        public_url: publicUrlData.publicUrl,
        original_src: metadata.src,
        title: metadata.title || originalFilename,
        alt: metadata.alt || '',
        page_title: metadata.pageTitle || '',
        page_url: metadata.pageUrl || '',
        mime_type: blob.type,
        file_size: blob.size,
        file_name: originalFilename,
        content_type: contentType,
        status: 'keep',
        thumbnail_url: contentType === 'image' ? publicUrlData.publicUrl : null,
      })
      .select('id')
      .single()

    if (recordError) {
      await supabase.storage.from('saved-images').remove([filename])
      throw new Error(`Metadata save failed: ${recordError.message}`)
    }

    return { success: true, data: { id: recordData.id, publicUrl: publicUrlData.publicUrl, contentType } }
  } catch (err) {
    return { success: false, error: err.message }
  }
}

// ─── Context menu setup ───────────────────────────────────────────────────────
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({ id: 'save-link', title: 'Save to LnkLokr', contexts: ['link'] })
  chrome.contextMenus.create({ id: 'save-image', title: 'Save to LnkLokr', contexts: ['image'] })
  chrome.contextMenus.create({ id: 'save-selection', title: 'Save to LnkLokr', contexts: ['selection'] })
})

// ─── Context menu click handler ───────────────────────────────────────────────
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab?.id) return

  // ── Save image (binary blob upload) ──────────────────────────────────────
  if (info.menuItemId === 'save-image') {
    const imageSrc = info.srcUrl
    if (!imageSrc) return

    try {
      const response = await fetch(imageSrc)
      const blob = await response.blob()

      let alt = ''
      try {
        const altResult = await chrome.tabs.sendMessage(tab.id, { type: 'GET_IMAGE_METADATA', imageSrc }, { frameId: 0 })
        if (altResult?.alt) alt = altResult.alt
      } catch { /* content script may not be injected */ }

      const metadata = {
        src: imageSrc,
        pageTitle: tab.title || '',
        pageUrl: tab.url || '',
        alt,
        title: alt || 'Saved Image',
      }

      const result = await saveFileToLnklokr(blob, metadata)
      if (result.success) {
        const label = result.data.contentType === 'image' ? 'Image' : result.data.contentType === 'pdf' ? 'PDF' : 'File'
        notify(`${label} Saved!`, `Successfully saved to ${label}s in LnkLokr`)
      } else {
        notify('Save Failed', result.error || 'Failed to save', 2)
      }
    } catch (err) {
      notify('Error', 'Failed to fetch or save file', 2)
    }
    return
  }

  // ── Save a link (right-click on hyperlink) ────────────────────────────────
  if (info.menuItemId === 'save-link') {
    const url = info.linkUrl || info.srcUrl || tab.url
    const contentType = detectContentType(url)

    if (contentType !== 'url') {
      // Binary asset — upload to Storage
      try {
        const response = await fetch(url)
        const blob = await response.blob()
        const metadata = {
          src: url,
          pageTitle: tab.title || '',
          pageUrl: tab.url || '',
          alt: '',
          title: url.split('/').pop() || 'Saved File',
        }
        const result = await saveFileToLnklokr(blob, metadata)
        if (result.success) {
          const label = result.data.contentType === 'image' ? 'Image' : result.data.contentType === 'pdf' ? 'PDF' : 'File'
          notify(`${label} Saved!`, `Successfully saved to LnkLokr`)
        } else {
          notify('Save Failed', result.error || 'Failed to save', 2)
        }
      } catch {
        notify('Error', 'Failed to fetch or save file', 2)
      }
    } else {
      // Webpage URL — scrape metadata and insert into links table directly
      const result = await saveWebpageLink({
        url,
        title: info.selectionText || url,
        description: null,
        tabTitle: tab.title,
      })
      if (result.success) {
        notify('Link Saved!', 'Successfully saved to LnkLokr')
      } else {
        notify('Save Failed', result.error || 'Failed to save link', 2)
      }
    }
    return
  }

  // ── Save selection (right-click on selected text) ─────────────────────────
  if (info.menuItemId === 'save-selection') {
    const url = tab.url || ''
    const result = await saveWebpageLink({
      url,
      title: info.selectionText || tab.title || url,
      description: info.selectionText || null,
      tabTitle: tab.title,
    })
    if (result.success) {
      notify('Link Saved!', 'Successfully saved to LnkLokr')
    } else {
      notify('Save Failed', result.error || 'Failed to save', 2)
    }
  }
})

// ─── Message listener (popup ↔ background) ───────────────────────────────────
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  // Popup sends its Supabase session so the service worker can use it
  if (message.type === 'SYNC_SESSION') {
    supabase.auth.setSession(message.session).then(() => sendResponse({ success: true }))
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
