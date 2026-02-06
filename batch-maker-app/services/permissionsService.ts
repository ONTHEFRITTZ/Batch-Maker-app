// ============================================
// FILE: services/permissionsService.ts
// Manages user roles and permissions
// ============================================

import AsyncStorage from '@react-native-async-storage/async-storage';

const USER_ROLE_KEY = '@user_role';

export type UserRole = 'basic' | 'premium' | 'admin';

class PermissionsService {
  private currentRole: UserRole = 'basic';

  /**
   * Initialize permissions service
   */
  async initialize(): Promise<void> {
    try {
      const storedRole = await AsyncStorage.getItem(USER_ROLE_KEY);
      if (storedRole) {
        this.currentRole = storedRole as UserRole;
      }
      console.log('✅ Permissions initialized:', this.currentRole);
    } catch (error) {
      console.error('❌ Error initializing permissions:', error);
    }
  }

  /**
   * Get current user role
   */
  getUserRole(): UserRole {
    return this.currentRole;
  }

  /**
   * Get user role display text
   */
  getUserRoleDisplay(): string {
    switch (this.currentRole) {
      case 'admin':
        return 'Admin';
      case 'premium':
        return 'Premium';
      case 'basic':
      default:
        return 'Basic';
    }
  }

  /**
   * Set user role (e.g., after subscription purchase)
   */
  async setUserRole(role: UserRole): Promise<void> {
    this.currentRole = role;
    await AsyncStorage.setItem(USER_ROLE_KEY, role);
    console.log('✅ User role updated:', role);
  }

  /**
   * Check if user has premium access
   */
  hasPremiumAccess(): boolean {
    return this.currentRole === 'premium' || this.currentRole === 'admin';
  }

  /**
   * Check if user is admin
   */
  isAdmin(): boolean {
    return this.currentRole === 'admin';
  }

  /**
   * Check if user can access reports
   */
  canAccessReports(): boolean {
    // For now, everyone can access reports
    // Later, you can make this premium-only:
    // return this.hasPremiumAccess();
    return true;
  }

  /**
   * Check if Reports button should be shown
   */
  shouldShowReportsButton(): boolean {
    return this.canAccessReports();
  }

  /**
   * Check if user can access network sync
   */
  canAccessNetworkSync(): boolean {
    return this.hasPremiumAccess();
  }

  /**
   * Check if user can access custom workflows
   */
  canCreateCustomWorkflows(): boolean {
    // Everyone can create workflows for now
    return true;
  }

  /**
   * Get feature access level
   */
  getFeatureAccess(feature: 'reports' | 'network' | 'custom_workflows' | 'export'): boolean {
    switch (feature) {
      case 'reports':
        return this.canAccessReports();
      case 'network':
        return this.canAccessNetworkSync();
      case 'custom_workflows':
        return this.canCreateCustomWorkflows();
      case 'export':
        return this.hasPremiumAccess();
      default:
        return false;
    }
  }

  /**
   * Clear user role (logout)
   */
  async clearRole(): Promise<void> {
    this.currentRole = 'basic';
    await AsyncStorage.removeItem(USER_ROLE_KEY);
    console.log('✅ User role cleared');
  }
}

// Export singleton instance
export const permissionsService = new PermissionsService();

// Export for direct imports
export default permissionsService;