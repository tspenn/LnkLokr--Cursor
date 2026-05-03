import { createClient } from '@supabase/supabase-js'

console.log('Background service worker starting')

const SUPABASE_URL = 'https://multehbzauvwmonzwivh.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im11bHRlaGJ6YXV2d21vbnp3aXZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAxMDg5ODksImV4cCI6MjA4NTY4NDk4OX0.dqI2z_qsrAEoiqiVcf8P7LwC23pRkOcX3abySpcO1wM'

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
    storage: {
      getItem: async (key) => {
        const result = await chrome.storage.local.get([key])
        return result[key] || null
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

  if (mimeLower.startsWith('application/') || mimeLower.startsWith('video/') ||
      mimeLower.startsWith('audio/') || /\.(zip|rar|7z|tar|gz|doc|docx|xls|xlsx|ppt|pptx|txt|mp4|mp3|avi|mov)(\?|$)/.test(urlLower)) {
    return 'file'
  }

  return 'url'
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'save-link',
    title: 'Save to LnkLokr',
    contexts: ['link'],
  })

  chrome.contextMenus.create({
    id: 'save-image',
    title: 'Save to LnkLokr',
    contexts: ['image'],
  })

  chrome.contextMenus.create({
    id: 'save-selection',
    title: 'Save to LnkLokr',
    contexts: ['selection'],
  })
})

async function saveFileToLnklokr(blob, metadata) {
  try {
    const { data: userData, error: userError } = await supabase.auth.getUser()

    if (userError || !userData?.user) {
      throw new Error('User not authenticated. Please log in first.')
    }

    const userId = userData.user.id
    const timestamp = Date.now()

    const urlPath = new URL(metadata.src).pathname
    const originalFilename = urlPath.split('/').pop() || 'file'

    const sanitizedFilename = originalFilename
      .replace(/[^a-zA-Z0-9.-]/g, '_')
      .replace(/_{2,}/g, '_')
      .slice(0, 100)

    const filename = `${userId}/${timestamp}-${sanitizedFilename}`

    const contentType = detectContentType(metadata.src, blob.type)

    const { error: uploadError } = await supabase.storage
      .from('saved-images')
      .upload(filename, blob, {
        contentType: blob.type,
        cacheControl: '3600',
        upsert: false,
      })

    if (uploadError) {
      throw new Error(`Failed to upload file: ${uploadError.message}`)
    }

    const { data: publicUrlData } = supabase.storage
      .from('saved-images')
      .getPublicUrl(filename)

    const publicUrl = publicUrlData.publicUrl

    const { data: recordData, error: recordError } = await supabase
      .from('saved_items')
      .insert({
        user_id: userId,
        storage_path: filename,
        public_url: publicUrl,
        original_src: metadata.src,
        title: metadata.title || originalFilename,
        alt: metadata.alt || '',
        page_title: metadata.pageTitle || '',
        page_url: metadata.pageUrl || '',
        mime_type: blob.type,
        file_size: blob.size,
        content_type: contentType,
      })
      .select('id')
      .single()

    if (recordError) {
      await supabase.storage.from('saved-images').remove([filename])
      throw new Error(`Failed to save file metadata: ${recordError.message}`)
    }

    return {
      success: true,
      data: {
        id: recordData.id,
        publicUrl: publicUrl,
        contentType: contentType,
      },
    }
  } catch (error) {
    console.error('Error saving file:', error)
    return {
      success: false,
      error: error.message || 'Unknown error occurred',
    }
  }
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab?.id) return

  if (info.menuItemId === 'save-image') {
    try {
      const imageSrc = info.srcUrl
      if (!imageSrc) return

      const response = await fetch(imageSrc)
      const blob = await response.blob()

      let metadata = {
        src: imageSrc,
        pageTitle: tab.title || '',
        pageUrl: tab.url || '',
        alt: '',
        title: 'Saved Image',
      }

      try {
        const altText = await chrome.tabs.sendMessage(
          tab.id,
          {
            type: 'GET_IMAGE_METADATA',
            imageSrc: imageSrc,
          },
          { frameId: 0 }
        )

        if (altText?.alt) {
          metadata.alt = altText.alt
          metadata.title = altText.alt || 'Saved Image'
        }
      } catch (error) {
        console.log('Could not get image metadata from content script')
      }

      const result = await saveFileToLnklokr(blob, metadata)

      if (result.success) {
        const typeLabel = result.data.contentType === 'image' ? 'Image' :
                         result.data.contentType === 'pdf' ? 'PDF' : 'File'
        chrome.notifications.create({
          type: 'basic',
          iconUrl: 'icons/icon-128.png',
          title: `${typeLabel} Saved!`,
          message: `Successfully saved to ${typeLabel}s in LnkLokr`,
          priority: 1,
        })
      } else {
        chrome.notifications.create({
          type: 'basic',
          iconUrl: 'icons/icon-128.png',
          title: 'Save Failed',
          message: result.error || 'Failed to save',
          priority: 2,
        })
      }
    } catch (error) {
      console.error('Failed to fetch file:', error)
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon-128.png',
        title: 'Error',
        message: 'Failed to fetch or save file',
        priority: 2,
      })
    }
  } else if (info.menuItemId === 'save-link') {
    const url = info.linkUrl || info.srcUrl || tab.url
    const contentType = detectContentType(url)

    if (contentType === 'image' || contentType === 'pdf' || contentType === 'file') {
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
          const typeLabel = result.data.contentType === 'image' ? 'Image' :
                           result.data.contentType === 'pdf' ? 'PDF' : 'File'
          chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icons/icon-128.png',
            title: `${typeLabel} Saved!`,
            message: `Successfully saved to ${typeLabel}s in LnkLokr`,
            priority: 1,
          })
        } else {
          chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icons/icon-128.png',
            title: 'Save Failed',
            message: result.error || 'Failed to save',
            priority: 2,
          })
        }
      } catch (error) {
        console.error('Failed to fetch file:', error)
        chrome.notifications.create({
          type: 'basic',
          iconUrl: 'icons/icon-128.png',
          title: 'Error',
          message: 'Failed to fetch or save file',
          priority: 2,
        })
      }
    } else {
      const linkData = {
        url: url,
        title: info.selectionText || tab.title || 'Link',
        description: info.selectionText || null,
      }

      chrome.tabs
        .sendMessage(
          tab.id,
          {
            type: 'SAVE_LINK',
            data: linkData,
          },
          { frameId: 0 }
        )
        .catch(() => {
          chrome.runtime.openOptionsPage?.()
        })
    }
  } else {
    const linkData = {
      url: info.linkUrl || info.srcUrl || tab.url,
      title: info.selectionText || tab.title || 'Link',
      description: info.selectionText || null,
    }

    chrome.tabs
      .sendMessage(
        tab.id,
        {
          type: 'SAVE_LINK',
          data: linkData,
        },
        { frameId: 0 }
      )
      .catch(() => {
        chrome.runtime.openOptionsPage?.()
      })
  }
})

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'AUTH_TOKEN') {
    chrome.storage.local.get(['auth_token'], (result) => {
      sendResponse({ token: result.auth_token })
    })
    return true
  }

  if (message.type === 'SAVE_AUTH_TOKEN') {
    chrome.storage.local.set({ auth_token: message.token }, () => {
      sendResponse({ success: true })
    })
    return true
  }
})
