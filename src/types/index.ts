export interface User {
  id: string
  email: string
  is_premium: boolean
  premium_until: string | null
  created_at: string
  updated_at: string
}

export interface Folder {
  id: string
  name: string
  description?: string
  color?: string
  icon?: string
  position?: number
  created_at: string
}

export interface Tag {
  id: string
  name: string
  color: string
  created_at: string
}

export interface Link {
  id: string
  folder_id?: string | null
  url: string
  title: string
  description?: string | null
  thumbnail_url?: string | null
  notes?: string | null
  tags?: string[]
  is_favorite?: boolean
  created_at: string
}

export interface BorrowCategory {
  id: string
  user_id: string
  name: string
  position: number
  created_at: string
  updated_at: string
}

export interface SavedItem {
  id: string
  user_id: string
  file_name: string
  file_size: number
  mime_type: string
  storage_path: string
  thumbnail_url: string | null
  content_type: string
  status: 'keep' | 'borrow' | 'share' | 'bury'
  category_id: string | null
  created_at: string
  updated_at: string
}

export interface SavedImage {
  id: string
  data_url: string
  original_src?: string
  title?: string
  alt?: string
  page_title?: string
  page_url?: string
  created_at: string
}

export interface AuthState {
  isAuthenticated: boolean
  user: User | null
  loading: boolean
  error: string | null
}
