import type { VercelRequest, VercelResponse } from '@vercel/node'

/**
 * GET /api/scrape?url=<encoded-url>
 *
 * Server-side OG metadata extractor.  Fetches the target page and parses:
 *   og:title, og:description, og:image, og:type, twitter:image, <title>,
 *   meta[name=description], and the page favicon.
 *
 * Returns:
 *   { title, description, thumbnail_url, icon, content_type,
 *     listing_price, listing_currency, listing_colors, listing_options,
 *     listing_description }
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

function decodeEntities(value: string | null): string | null {
  if (!value) return null
  const decoded = value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/\s+/g, ' ')
    .trim()
  if (!decoded) return null
  return decoded.length > 2000 ? `${decoded.slice(0, 1997)}...` : decoded
}

function asStringList(value: unknown): string[] {
  if (value == null) return []
  if (Array.isArray(value)) return value.flatMap(asStringList)
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed ? [trimmed] : []
  }
  if (typeof value === 'object' && value !== null && 'name' in value) {
    return asStringList((value as { name: unknown }).name)
  }
  return []
}

function isProduct(item: unknown): item is Record<string, unknown> {
  if (!item || typeof item !== 'object') return false
  const type = (item as { '@type'?: unknown })['@type']
  const types = Array.isArray(type) ? type : [type]
  return types.some(t => String(t).toLowerCase() === 'product')
}

function collectProducts(node: unknown, into: Record<string, unknown>[]): void {
  if (!node) return
  if (Array.isArray(node)) {
    for (const item of node) collectProducts(item, into)
    return
  }
  if (typeof node !== 'object') return
  const rec = node as Record<string, unknown>
  if (isProduct(rec)) into.push(rec)
  if (rec['@graph']) collectProducts(rec['@graph'], into)
}

function extractJsonLdProducts(html: string): Record<string, unknown>[] {
  const products: Record<string, unknown>[] = []
  const re = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  let match: RegExpExecArray | null
  while ((match = re.exec(html))) {
    try {
      collectProducts(JSON.parse(match[1]), products)
    } catch {
      // Ignore malformed JSON-LD blocks
    }
  }
  return products
}

function firstOffer(product: Record<string, unknown>): Record<string, unknown> | null {
  const offers = product.offers
  if (Array.isArray(offers)) {
    return (offers[0] as Record<string, unknown>) ?? null
  }
  if (offers && typeof offers === 'object') return offers as Record<string, unknown>
  return null
}

function extractListing(html: string): {
  listing_price: string | null
  listing_currency: string | null
  listing_colors: string | null
  listing_options: string | null
  listing_description: string | null
} {
  let price: string | null = null
  let currency: string | null = null
  let listingDescription: string | null = null
  const colors = new Set<string>()
  const options = new Set<string>()

  for (const product of extractJsonLdProducts(html)) {
    if (!listingDescription) {
      const fromProduct = asStringList(product.description).join(' ').trim()
      if (fromProduct) listingDescription = fromProduct
    }
    const offer = firstOffer(product)
    if (offer) {
      if (!price && offer.price != null) price = String(offer.price)
      if (!price && offer.lowPrice != null) price = String(offer.lowPrice)
      if (!currency && offer.priceCurrency != null) currency = String(offer.priceCurrency)
    }
    for (const color of asStringList(product.color)) colors.add(color)
    for (const size of asStringList(product.size)) options.add(`Size: ${size}`)
    for (const material of asStringList(product.material)) options.add(`Material: ${material}`)

    const props = product.additionalProperty
    const propList = Array.isArray(props) ? props : props ? [props] : []
    for (const prop of propList) {
      if (!prop || typeof prop !== 'object') continue
      const rec = prop as Record<string, unknown>
      const name = String(rec.name ?? '').trim()
      const value = asStringList(rec.value).join(', ')
      if (!name || !value) continue
      if (/color/i.test(name)) colors.add(value)
      else options.add(`${name}: ${value}`)
    }

    const variants = product.hasVariant
    const variantList = Array.isArray(variants) ? variants : variants ? [variants] : []
    for (const variant of variantList) {
      if (!variant || typeof variant !== 'object') continue
      const rec = variant as Record<string, unknown>
      for (const color of asStringList(rec.color)) colors.add(color)
      for (const name of asStringList(rec.name)) options.add(name)
    }
  }

  if (!price) price = extractMeta(html, 'product:price:amount')
  if (!currency) currency = extractMeta(html, 'product:price:currency')
  for (const color of asStringList(extractMeta(html, 'product:color'))) colors.add(color)

  return {
    listing_price: price,
    listing_currency: currency,
    listing_colors: colors.size ? [...colors].join('; ') : null,
    listing_options: options.size ? [...options].join('; ') : null,
    listing_description: decodeEntities(listingDescription),
  }
}

const EMPTY_LISTING = {
  listing_price: null,
  listing_currency: null,
  listing_colors: null,
  listing_options: null,
  listing_description: null,
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
      ...EMPTY_LISTING,
    })
  }
  if (directType === 'pdf') {
    return res.status(200).json({
      title: targetUrl.pathname.split('/').pop() || 'Document',
      description: null,
      thumbnail_url: null,
      icon: null,
      content_type: 'pdf',
      ...EMPTY_LISTING,
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
        ...EMPTY_LISTING,
      })
    }

    // Read enough HTML to catch JSON-LD Product blocks in the body
    const reader = response.body?.getReader()
    let html = ''
    let bytes = 0
    if (reader) {
      const decoder = new TextDecoder()
      while (bytes < 250_000) {
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
    const listing = extractListing(html)

    return res.status(200).json({
      title: ogTitle || htmlTitle || targetUrl.hostname,
      description: listing.listing_description || decodeEntities(ogDesc) || decodeEntities(metaDesc),
      thumbnail_url: resolveUrl(ogImage, base),
      icon: favicon,
      content_type: 'url',
      ...listing,
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
      ...EMPTY_LISTING,
      _warning: `Scrape failed: ${message}`,
    })
  }
}
