import type { CSSProperties } from 'react'

export type IconName =
  | 'alert-circle'
  | 'archive'
  | 'check-circle'
  | 'cloud'
  | 'copy'
  | 'crown'
  | 'database'
  | 'download'
  | 'edit'
  | 'external-link'
  | 'eye'
  | 'eye-off'
  | 'file'
  | 'file-text'
  | 'globe'
  | 'hard-drive'
  | 'heart'
  | 'image'
  | 'info'
  | 'key'
  | 'link'
  | 'loader'
  | 'lock'
  | 'log-out'
  | 'mail'
  | 'more-vertical'
  | 'plus'
  | 'refresh'
  | 'search'
  | 'settings'
  | 'share'
  | 'trash'
  | 'upload'
  | 'x'
  | 'x-circle'

interface IconProps {
  name: IconName
  size?: number
  className?: string
  fill?: string
  style?: CSSProperties
  strokeWidth?: number
  title?: string
}

/**
 * Static PNG art served from /public/icons. Used for Crown (premium badge)
 * and Lock (bury feature) so the brand assets show through instead of the
 * generic Lucide glyphs that the Bolt scaffold introduced.
 */
const PNG_ICONS: Partial<Record<IconName, string>> = {
  crown: '/icons/Yellow lockbox.png',
  lock: '/icons/combination_lock.png',
}

export function Icon({
  name,
  size = 20,
  className = '',
  fill = 'none',
  style,
  strokeWidth = 2,
  title,
}: IconProps) {
  const pngSrc = PNG_ICONS[name]
  if (pngSrc) {
    return (
      <img
        src={pngSrc}
        alt={title || name}
        width={size}
        height={size}
        className={`${className} object-contain`}
        style={style}
      />
    )
  }

  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill,
    stroke: 'currentColor',
    strokeWidth,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    className,
    style,
    'aria-hidden': title ? undefined : true,
    role: title ? 'img' : undefined,
  }

  switch (name) {
    case 'alert-circle':
      return (
        <svg xmlns="http://www.w3.org/2000/svg" {...common}>
          {title && <title>{title}</title>}
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      )
    case 'archive':
      return (
        <svg xmlns="http://www.w3.org/2000/svg" {...common}>
          {title && <title>{title}</title>}
          <polyline points="21 8 21 21 3 21 3 8" />
          <rect x="1" y="3" width="22" height="5" />
          <line x1="10" y1="12" x2="14" y2="12" />
        </svg>
      )
    case 'check-circle':
      return (
        <svg xmlns="http://www.w3.org/2000/svg" {...common}>
          {title && <title>{title}</title>}
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
          <polyline points="22 4 12 14.01 9 11.01" />
        </svg>
      )
    case 'cloud':
      return (
        <svg xmlns="http://www.w3.org/2000/svg" {...common}>
          {title && <title>{title}</title>}
          <path d="M17.5 19a4.5 4.5 0 1 0 0-9h-1.8A7 7 0 1 0 4 16" />
        </svg>
      )
    case 'copy':
      return (
        <svg xmlns="http://www.w3.org/2000/svg" {...common}>
          {title && <title>{title}</title>}
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
      )
    case 'database':
      return (
        <svg xmlns="http://www.w3.org/2000/svg" {...common}>
          {title && <title>{title}</title>}
          <ellipse cx="12" cy="5" rx="9" ry="3" />
          <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
          <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
        </svg>
      )
    case 'download':
      return (
        <svg xmlns="http://www.w3.org/2000/svg" {...common}>
          {title && <title>{title}</title>}
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
      )
    case 'edit':
      return (
        <svg xmlns="http://www.w3.org/2000/svg" {...common}>
          {title && <title>{title}</title>}
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
        </svg>
      )
    case 'external-link':
      return (
        <svg xmlns="http://www.w3.org/2000/svg" {...common}>
          {title && <title>{title}</title>}
          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
          <polyline points="15 3 21 3 21 9" />
          <line x1="10" y1="14" x2="21" y2="3" />
        </svg>
      )
    case 'eye':
      return (
        <svg xmlns="http://www.w3.org/2000/svg" {...common}>
          {title && <title>{title}</title>}
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      )
    case 'eye-off':
      return (
        <svg xmlns="http://www.w3.org/2000/svg" {...common}>
          {title && <title>{title}</title>}
          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
          <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
          <line x1="1" y1="1" x2="23" y2="23" />
        </svg>
      )
    case 'file':
      return (
        <svg xmlns="http://www.w3.org/2000/svg" {...common}>
          {title && <title>{title}</title>}
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
        </svg>
      )
    case 'file-text':
      return (
        <svg xmlns="http://www.w3.org/2000/svg" {...common}>
          {title && <title>{title}</title>}
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
          <polyline points="10 9 9 9 8 9" />
        </svg>
      )
    case 'globe':
      return (
        <svg xmlns="http://www.w3.org/2000/svg" {...common}>
          {title && <title>{title}</title>}
          <circle cx="12" cy="12" r="10" />
          <line x1="2" y1="12" x2="22" y2="12" />
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        </svg>
      )
    case 'hard-drive':
      return (
        <svg xmlns="http://www.w3.org/2000/svg" {...common}>
          {title && <title>{title}</title>}
          <line x1="22" y1="12" x2="2" y2="12" />
          <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
          <line x1="6" y1="16" x2="6.01" y2="16" />
          <line x1="10" y1="16" x2="10.01" y2="16" />
        </svg>
      )
    case 'heart':
      return (
        <svg xmlns="http://www.w3.org/2000/svg" {...common}>
          {title && <title>{title}</title>}
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
        </svg>
      )
    case 'image':
      return (
        <svg xmlns="http://www.w3.org/2000/svg" {...common}>
          {title && <title>{title}</title>}
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <polyline points="21 15 16 10 5 21" />
        </svg>
      )
    case 'info':
      return (
        <svg xmlns="http://www.w3.org/2000/svg" {...common}>
          {title && <title>{title}</title>}
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="16" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12.01" y2="8" />
        </svg>
      )
    case 'key':
      return (
        <svg xmlns="http://www.w3.org/2000/svg" {...common}>
          {title && <title>{title}</title>}
          <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
        </svg>
      )
    case 'link':
      return (
        <svg xmlns="http://www.w3.org/2000/svg" {...common}>
          {title && <title>{title}</title>}
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
        </svg>
      )
    case 'loader':
      return (
        <svg xmlns="http://www.w3.org/2000/svg" {...common}>
          {title && <title>{title}</title>}
          <line x1="12" y1="2" x2="12" y2="6" />
          <line x1="12" y1="18" x2="12" y2="22" />
          <line x1="4.93" y1="4.93" x2="7.76" y2="7.76" />
          <line x1="16.24" y1="16.24" x2="19.07" y2="19.07" />
          <line x1="2" y1="12" x2="6" y2="12" />
          <line x1="18" y1="12" x2="22" y2="12" />
          <line x1="4.93" y1="19.07" x2="7.76" y2="16.24" />
          <line x1="16.24" y1="7.76" x2="19.07" y2="4.93" />
        </svg>
      )
    case 'log-out':
      return (
        <svg xmlns="http://www.w3.org/2000/svg" {...common}>
          {title && <title>{title}</title>}
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <polyline points="16 17 21 12 16 7" />
          <line x1="21" y1="12" x2="9" y2="12" />
        </svg>
      )
    case 'mail':
      return (
        <svg xmlns="http://www.w3.org/2000/svg" {...common}>
          {title && <title>{title}</title>}
          <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
          <polyline points="22,6 12,13 2,6" />
        </svg>
      )
    case 'more-vertical':
      return (
        <svg xmlns="http://www.w3.org/2000/svg" {...common}>
          {title && <title>{title}</title>}
          <circle cx="12" cy="12" r="1" />
          <circle cx="12" cy="5" r="1" />
          <circle cx="12" cy="19" r="1" />
        </svg>
      )
    case 'plus':
      return (
        <svg xmlns="http://www.w3.org/2000/svg" {...common}>
          {title && <title>{title}</title>}
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      )
    case 'refresh':
      return (
        <svg xmlns="http://www.w3.org/2000/svg" {...common}>
          {title && <title>{title}</title>}
          <polyline points="23 4 23 10 17 10" />
          <polyline points="1 20 1 14 7 14" />
          <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
        </svg>
      )
    case 'search':
      return (
        <svg xmlns="http://www.w3.org/2000/svg" {...common}>
          {title && <title>{title}</title>}
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
      )
    case 'settings':
      return (
        <svg xmlns="http://www.w3.org/2000/svg" {...common}>
          {title && <title>{title}</title>}
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      )
    case 'share':
      return (
        <svg xmlns="http://www.w3.org/2000/svg" {...common}>
          {title && <title>{title}</title>}
          <circle cx="18" cy="5" r="3" />
          <circle cx="6" cy="12" r="3" />
          <circle cx="18" cy="19" r="3" />
          <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
          <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
        </svg>
      )
    case 'trash':
      return (
        <svg xmlns="http://www.w3.org/2000/svg" {...common}>
          {title && <title>{title}</title>}
          <polyline points="3 6 5 6 21 6" />
          <path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          <line x1="10" y1="11" x2="10" y2="17" />
          <line x1="14" y1="11" x2="14" y2="17" />
        </svg>
      )
    case 'upload':
      return (
        <svg xmlns="http://www.w3.org/2000/svg" {...common}>
          {title && <title>{title}</title>}
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
      )
    case 'x':
      return (
        <svg xmlns="http://www.w3.org/2000/svg" {...common}>
          {title && <title>{title}</title>}
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      )
    case 'x-circle':
      return (
        <svg xmlns="http://www.w3.org/2000/svg" {...common}>
          {title && <title>{title}</title>}
          <circle cx="12" cy="12" r="10" />
          <line x1="15" y1="9" x2="9" y2="15" />
          <line x1="9" y1="9" x2="15" y2="15" />
        </svg>
      )
    default:
      return null
  }
}
