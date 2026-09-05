import type { Link } from '@/types'

function csvEscape(value: unknown): string {
  const text = value == null ? '' : Array.isArray(value) ? value.join('; ') : String(value)
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`
  return text
}

export function folderCsvFilename(folderName: string): string {
  const safe = folderName
    .replace(/[<>:"/\\|?*]+/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60)
  return `lnklokr-${safe || 'folder'}-${new Date().toISOString().split('T')[0]}.csv`
}

const HEADERS = [
  'title',
  'url',
  'image_url',
  'description',
  'folder',
  'status',
  'price',
  'currency',
  'colors',
  'options',
  'tags',
  'notes',
  'content_type',
  'created_at',
]

/** Download one CSV for the links in a single folder. */
export function downloadFolderCsv(links: Link[], folderName: string): void {
  const rows = links.map(link => [
    csvEscape(link.title),
    csvEscape(link.url),
    csvEscape(link.thumbnail_url),
    csvEscape(link.description),
    csvEscape(folderName),
    csvEscape(link.status),
    csvEscape(link.listing_price),
    csvEscape(link.listing_currency),
    csvEscape(link.listing_colors),
    csvEscape(link.listing_options),
    csvEscape(link.tags),
    csvEscape(link.notes),
    csvEscape(link.content_type),
    csvEscape(link.created_at),
  ].join(','))
  const csv = [HEADERS.join(','), ...rows].join('\r\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = folderCsvFilename(folderName)
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
