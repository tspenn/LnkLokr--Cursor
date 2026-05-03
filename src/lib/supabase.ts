import { createClient } from '@supabase/supabase-js'

/**
 * Supabase project URL + anon key. Configure these in the Vercel project as
 * VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (also exposed via the
 * `Production`, `Preview` and `Development` environments).
 */
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your Vercel project settings.'
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})
