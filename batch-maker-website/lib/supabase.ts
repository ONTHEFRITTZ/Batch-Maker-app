import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

let browserSupabase: SupabaseClient | null = null;

export function getSupabaseClient() {
  if (typeof window === 'undefined') {
    // Server-side: always create a new instance
    return createClient(supabaseUrl, supabaseAnonKey);
  }
  // Browser-side: reuse the same instance
  if (!browserSupabase) {
    browserSupabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    });
  }
  return browserSupabase;
}

/**
 * Profile type used across the website.
 * Keep in sync with the profiles table schema.
 * Tier logic (isPremium, hasDashboardAccess, etc.) lives in lib/userTier.ts — not here.
 */
export interface Profile {
  id: string;
  email?: string;
  device_name?: string;
  role?: 'free' | 'premium' | 'admin';
  subscription_status?: 'trial' | 'active' | 'cancelled' | 'expired';
  subscription_platform?: 'ios' | 'android' | null;
  trial_started_at?: string | null;
  trial_expires_at?: string | null;
  subscription_expires_at?: string | null;
  business_email?: string;
  business_settings?: Record<string, any>;
  job_title?: string;
  phone?: string;
  created_at?: string;
  updated_at?: string;
}