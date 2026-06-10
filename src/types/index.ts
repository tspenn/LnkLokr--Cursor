export interface User {
  id: string
  email: string
  is_premium: boolean
  subscription_tier: 'free' | 'standard' | 'premium' | 'complimentary'
  premium_until: string | null
  cloud_sync: boolean
  device_limit: number
  stripe_customer_id: string | null
  last_purchase_tier: string | null
  bury_password: string | null
  storage_used: number
  created_at: string
  updated_at: string
}

export interface Folder {
  id: string
  user_id: string
  name: string
  description?: string
  color?: string
  icon?: string
  position?: number
  created_at: string
  updated_at?: string
}

export interface Tag {
  id: string
  name: string
  color: string
  created_at: string
}

export interface Link {
  id: string
  user_id?: string
  folder_id?: string | null
  url: string
  title: string
  description?: string | null
  thumbnail_url?: string | null
  icon?: string | null
  notes?: string | null
  tags?: string[]
  is_favorite?: boolean
  status?: 'keep' | 'borrow' | 'share' | 'bury'
  category_id?: string | null
  content_type?: string
  created_at: string
  updated_at?: string
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
  storage_path: string
  public_url: string
  original_src: string
  title: string
  alt?: string
  page_title?: string
  page_url?: string
  mime_type: string
  file_size: number
  file_name: string
  content_type: string
  status: 'keep' | 'borrow' | 'share' | 'bury'
  category_id: string | null
  thumbnail_url: string | null
  folder_id?: string | null
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
  /** True after PASSWORD_RECOVERY until the user sets a new password. */
  passwordRecovery: boolean
}
