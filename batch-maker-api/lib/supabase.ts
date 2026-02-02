import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

// Database types
export interface Profile {
  id: string;
  email: string;
  device_name: string;
  role: 'free' | 'admin' | 'premium';
  subscription_status: string;
  created_at: string;
}

export interface Workflow {
  id: string;
  user_id: string;
  name: string;
  steps: any;
  claimed_by?: string;
  claimed_by_name?: string;
  created_at: string;
  updated_at: string;
}

export interface Batch {
  id: string;
  user_id: string;
  workflow_id: string;
  name: string;
  mode: string;
  units_per_batch: number;
  batch_size_multiplier: number;
  current_step_index: number;
  completed_steps: string[];
  active_timers: any;
  created_at: string;
}

export interface Report {
  id: string;
  user_id: string;
  batch_id: string;
  type: string;
  data: any;
  created_at: string;
}

export interface Photo {
  id: string;
  user_id: string;
  batch_id?: string;
  workflow_id?: string;
  step_id?: string;
  url: string;
  created_at: string;
}

// Helper: Get user from request (works with both Next.js and Vercel)
export async function getUserFromRequest(req: any) {
  const authHeader = req.headers?.authorization || req.headers?.Authorization;
  
  if (!authHeader?.startsWith('Bearer ')) {
    throw new Error('No authorization token provided');
  }

  const token = authHeader.substring(7);
  
  const { data: { user }, error } = await supabase.auth.getUser(token);
  
  if (error) {
    console.error('Auth error:', error);
    throw new Error('Invalid or expired token');
  }
  
  if (!user) {
    throw new Error('User not found');
  }

  return user;
}

// Helper: Check subscription status
export async function checkSubscription(userId: string): Promise<boolean> {
  const { data: profile, error } = await supabaseAdmin
    .from('profiles')
    .select('subscription_status, role')
    .eq('id', userId)
    .single();

  if (error) {
    console.error('Subscription check error:', error);
    return false;
  }

  // Allow access for active subscriptions, premium users, and admins
  return profile?.subscription_status === 'active' || 
         profile?.role === 'premium' || 
         profile?.role === 'admin';
}

// Helper: Get full subscription details
export async function getSubscriptionDetails(userId: string) {
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('subscription_status, role')
    .eq('id', userId)
    .single();

  return {
    isActive: profile?.subscription_status === 'active' || 
              profile?.role === 'premium' || 
              profile?.role === 'admin',
    role: profile?.role || 'free',
    status: profile?.subscription_status || 'inactive'
  };
}