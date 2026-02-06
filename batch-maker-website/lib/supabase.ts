import { createClient, SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

let browserSupabase: SupabaseClient | null = null

export function getSupabaseClient() {
  if (typeof window === 'undefined') {
    // Server-side: always create a new one
    return createClient(supabaseUrl, supabaseAnonKey)
  }

  // Browser-side: reuse the same instance
  if (!browserSupabase) {
    browserSupabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  }

  return browserSupabase
}
