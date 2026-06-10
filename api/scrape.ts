import type { VercelRequest, VercelResponse } from '@vercel/node'

/**
 * GET /api/scrape?url=<encoded-url>
 *
 * Server-side OG metadata extractor.  Fetches the target page and parses:
 *   og:title, og:description, og:image, og:type, twitter:image, <title>,
 *   meta[name=description], and the page favicon.
 *
 * Returns:
 *   { title, description, thumbnail_url, icon, content_type }
 *
 * Used by the browser extension background service worker to enrich link
 * saves without running into extension CSP / CORS restrictions.
 */

const IMAGE_EXT = /\.(jpg|jpeg|png|gif|webp|svg|bmp|ico)(\?|#|$)/i
const PDF_EXT = /\.pdf(\?|#|$)/i

function detectContentType(url: string): string {
  if (IMAGE_EXT.test(url)) return 'image'
  if (PDF_EXT.test(url)) return 'pdf'
  return 'url'
}

function extractMeta(html: string, property: string): string | null {
  // Handles both property= and name= attributes in any order
  const re = new RegExp(
    `<meta[^>]+(?:property|name)=["']${property}["'][^>]+content=["']([^"']+)["'][^>]*>|` +
    `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${property}["'][^>]*>`,
    'i',
  )
  const m = re.exec(html)
  return m ? (m[1] || m[2] || null) : null
}

function extractTitle(html: string): string | null {
  const m = /<title[^>]*>([^<]+)<\/title>/i.exec(html)
  return m ? m[1].trim() : null
}

function extractFavicon(html: string, baseUrl: string): string | null {
  // Try link[rel~=icon]
  const re = /<link[^>]+rel=["'][^"']*icon[^"']*["'][^>]+href=["']([^"']+)["'][^>]*>/i
  const m = re.exec(html)
  if (m) {
    try { return new URL(m[1], baseUrl).href } catch { /* ignore */ }
  }
  // Fallback: /favicon.ico
  try { return new URL('/favicon.ico', baseUrl).href } catch { return null }
}

function resolveUrl(src: string | null, base: string): string | null {
  if (!src) return null
  try { return new URL(src, base).href } catch { return null }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Allow the extension and the web app to call this endpoint
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(204).end()
  }
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const rawUrl = Array.isArray(req.query.url) ? req.query.url[0] : req.query.url
  if (!rawUrl) {
    return res.status(400).json({ error: 'Missing ?url parameter' })
  }

  let targetUrl: URL
  try {
    targetUrl = new URL(rawUrl)
  } catch {
    return res.status(400).json({ error: 'Invalid URL' })
  }

  // Direct image or PDF — no need to fetch
  const directType = detectContentType(targetUrl.href)
  if (directType === 'image') {
    return res.status(200).json({
      title: targetUrl.pathname.split('/').pop() || 'Image',
      description: null,
      thumbnail_url: targetUrl.href,
      icon: null,
      content_type: 'image',
    })
  }
  if (directType === 'pdf') {
    return res.status(200).json({
      title: targetUrl.pathname.split('/').pop() || 'Document',
      description: null,
      thumbnail_url: null,
      icon: null,
      content_type: 'pdf',
    })
  }

  // Fetch HTML — 5 s timeout, browser-like UA to avoid bot blocks
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 5000)

  try {
    const response = await fetch(targetUrl.href, {
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
          '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
    })
    clearTimeout(timer)

    const contentType = response.headers.get('content-type') || ''
    if (!contentType.includes('text/html')) {
      // Not HTML (e.g. JSON API, binary) — return minimal metadata
      return res.status(200).json({
        title: targetUrl.pathname.split('/').pop() || targetUrl.hostname,
        description: null,
        thumbnail_url: null,
        icon: null,
        content_type: 'url',
      })
    }

    // Only read the first 100 KB — enough for <head> content
    const reader = response.body?.getReader()
    let html = ''
    let bytes = 0
    if (reader) {
      const decoder = new TextDecoder()
      while (bytes < 100_000) {
        const { done, value } = await reader.read()
        if (done) break
        html += decoder.decode(value, { stream: true })
        bytes += value?.length ?? 0
      }
      reader.cancel()
    }

    const base = targetUrl.href
    const ogTitle = extractMeta(html, 'og:title')
    const ogDesc = extractMeta(html, 'og:description')
    const ogImage = extractMeta(html, 'og:image') || extractMeta(html, 'twitter:image')
    const metaDesc = extractMeta(html, 'description')
    const htmlTitle = extractTitle(html)
    const favicon = extractFavicon(html, base)

    return res.status(200).json({
      title: ogTitle || htmlTitle || targetUrl.hostname,
      description: ogDesc || metaDesc || null,
      thumbnail_url: resolveUrl(ogImage, base),
      icon: favicon,
      content_type: 'url',
    })
  } catch (err: unknown) {
    clearTimeout(timer)
    const message = err instanceof Error ? err.message : 'Unknown error'
    // Return a degraded response so the caller can still save the link
    return res.status(200).json({
      title: targetUrl.hostname,
      description: null,
      thumbnail_url: null,
      icon: null,
      content_type: 'url',
      _warning: `Scrape failed: ${message}`,
    })
  }
}
