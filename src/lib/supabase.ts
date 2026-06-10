import { createClient } from '@supabase/supabase-js'
import { isSupabaseConfigured } from '@/lib/supabaseConfig'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!isSupabaseConfigured) {
  throw new Error(
    'Missing Supabase environment variables. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.',
  )
}

// When the React app is bundled into the extension popup, share auth state
// with the background service worker via chrome.storage.local.  Both contexts
// read/write sessions from the same bucket, fixing the auth split.
interface ChromeStorageLocal {
  get(keys: string[]): Promise<Record<string, string | null>>
  set(items: Record<string, string>): Promise<void>
  remove(keys: string[]): Promise<void>
}
interface ChromeAPI {
  storage: { local: ChromeStorageLocal }
  runtime: { sendMessage: (msg: unknown) => Promise<unknown> }
}

function getChromeAPI(): ChromeAPI | undefined {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const g = (typeof globalThis !== 'undefined' ? globalThis : undefined) as any
  return g?.chrome?.storage?.local ? (g.chrome as ChromeAPI) : undefined
}

const chromeAPI = getChromeAPI()

const extensionStorage = chromeAPI
  ? {
      getItem: async (key: string): Promise<string | null> => {
        const result = await chromeAPI.storage.local.get([key])
        return result[key] ?? null
      },
      setItem: async (key: string, value: string): Promise<void> => {
        await chromeAPI.storage.local.set({ [key]: value })
      },
      removeItem: async (key: string): Promise<void> => {
        await chromeAPI.storage.local.remove([key])
      },
    }
  : undefined

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    ...(extensionStorage ? { storage: extensionStorage } : {}),
  },
})

// After sign-in, push the active session to the background service worker so
// it can make authenticated Supabase calls without the popup being open.
export async function syncSessionToBackground(): Promise<void> {
  if (!chromeAPI) return
  try {
    const { data } = await supabase.auth.getSession()
    if (!data.session) return
    await chromeAPI.runtime.sendMessage({ type: 'SYNC_SESSION', session: data.session })
  } catch {
    // Background page may not be ready — non-fatal
  }
}
