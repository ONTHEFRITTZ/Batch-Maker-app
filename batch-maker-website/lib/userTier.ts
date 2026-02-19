/**
 * lib/userTier.ts
 * ─────────────────────────────────────────────────────────────
 * SINGLE SOURCE OF TRUTH for user tier logic.
 *
 * All tier checks across the website must import from here.
 * Never inline `role === 'premium'` checks anywhere else.
 *
 * Tier hierarchy:
 *   'admin'   → full access, always
 *   'premium' → full access (active subscription via RevenueCat)
 *   'trial'   → full access until trial_expires_at
 *   'free'    → account management only (delete account, sign out)
 *   'expired' → subscription lapsed, downgraded to free behaviour
 */

export type UserTier = 'admin' | 'premium' | 'trial' | 'free' | 'expired'

export interface TierProfile {
  role?: string | null
  subscription_status?: string | null
  trial_expires_at?: string | null
}

/**
 * Derive the effective tier from a profile row.
 * This is the only place this logic lives.
 */
export function getUserTier(profile: TierProfile | null | undefined): UserTier {
  if (!profile) return 'free'

  const role = profile.role
  const status = profile.subscription_status

  // Admins always have full access
  if (role === 'admin') return 'admin'

  // Active paid subscription
  if (role === 'premium' && status === 'active') return 'premium'

  // Trial — check if still valid
  if (status === 'trial') {
    if (!profile.trial_expires_at) return 'trial' // no expiry set, treat as active
    const trialExpiry = new Date(profile.trial_expires_at)
    if (trialExpiry > new Date()) return 'trial'
    return 'expired' // trial has lapsed
  }

  // Premium role but subscription expired/cancelled via webhook
  if (role === 'premium' && (status === 'expired' || status === 'cancelled')) return 'expired'

  // Legacy: premium role without a status set (grandfathered accounts)
  if (role === 'premium') return 'premium'

  return 'free'
}

/**
 * Does this user have full dashboard access?
 * True for: admin, premium, trial (within trial period)
 */
export function hasDashboardAccess(profile: TierProfile | null | undefined): boolean {
  const tier = getUserTier(profile)
  return tier === 'admin' || tier === 'premium' || tier === 'trial'
}

/**
 * Redirect path after sign-in, based on profile.
 */
export function getPostLoginRedirect(profile: TierProfile | null | undefined): string {
  return hasDashboardAccess(profile) ? '/dashboard' : '/account'
}

/**
 * Human-readable label for the user's tier, shown in UI.
 */
export function getTierLabel(profile: TierProfile | null | undefined): string {
  const tier = getUserTier(profile)
  switch (tier) {
    case 'admin':   return 'Admin'
    case 'premium': return 'Premium'
    case 'trial':   return 'Free Trial'
    case 'expired': return 'Expired'
    case 'free':    return 'Free'
  }
}

/**
 * Days remaining in trial. Returns null if not on trial or already expired.
 */
export function getTrialDaysRemaining(profile: TierProfile | null | undefined): number | null {
  if (!profile || profile.subscription_status !== 'trial') return null
  if (!profile.trial_expires_at) return null
  const diff = new Date(profile.trial_expires_at).getTime() - Date.now()
  if (diff <= 0) return 0
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}