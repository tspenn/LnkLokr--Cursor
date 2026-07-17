// Content script — copied to dist without bundling (see vite.config.ts).
;(function () {
  try {
    if (!chrome?.runtime?.onMessage?.addListener) {
      return
    }

    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message.type === 'SAVE_LINK') {
        const linkData = message.data

        chrome.runtime.sendMessage({
          type: 'SEND_TO_POPUP',
          data: {
            url: linkData.url,
            title: linkData.title,
            description: linkData.description,
            pageTitle: document.title,
            pageUrl: window.location.href,
          },
        })

        sendResponse({ success: true })
      }

      if (message.type === 'GET_IMAGE_METADATA') {
        const imageSrc = message.imageSrc
        let alt = ''

        try {
          const images = document.querySelectorAll('img')
          for (const img of images) {
            if (img.src === imageSrc || img.currentSrc === imageSrc) {
              alt = img.alt || img.title || ''
              break
            }
          }
        } catch (error) {
          console.error('Failed to extract image metadata:', error)
        }

        sendResponse({ alt })
        return true
      }

      if (message.type === 'READ_CLIPBOARD_IMAGE') {
        ;(async () => {
          try {
            const items = await navigator.clipboard.read()
            for (const item of items) {
              const imageType = item.types.find(t => t.startsWith('image/'))
              if (imageType) {
                const blob = await item.getType(imageType)
                const reader = new FileReader()
                reader.onload = () => sendResponse({ dataUrl: reader.result })
                reader.onerror = () => sendResponse({ dataUrl: null })
                reader.readAsDataURL(blob)
                return
              }
            }
            sendResponse({ dataUrl: null })
          } catch {
            sendResponse({ dataUrl: null })
          }
        })()
        return true
      }
    })
  } catch (error) {
    console.warn('LnkLokr content script:', error)
  }
})()
