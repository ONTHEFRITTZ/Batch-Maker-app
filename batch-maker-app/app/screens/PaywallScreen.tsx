import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../../contexts/ThemeContext';
import { supabase } from '../lib/supabase';

export default function PaywallScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [hasSubscription, setHasSubscription] = useState(false);
  const [subscribing, setSubscribing] = useState(false);

  useEffect(() => {
    checkSubscription();
  }, []);

  const checkSubscription = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        setLoading(false);
        return;
      }

      setUserEmail(user.email || null);

      // Check if user already has a subscription
      const { data: subscription } = await supabase
        .from('subscriptions')
        .select('status, current_period_end')
        .eq('user_id', user.id)
        .single();

      const isActive = subscription && 
        subscription.status === 'active' && 
        new Date(subscription.current_period_end) > new Date();

      setHasSubscription(!!isActive);
      setLoading(false);
    } catch (error) {
      console.error('Error checking subscription:', error);
      setLoading(false);
    }
  };

  const handleSubscribe = async () => {
    try {
      setSubscribing(true);
      // Redirect to your website's Stripe checkout page
      const checkoutUrl = `https://batchmaker.app/subscribe?email=${encodeURIComponent(userEmail || '')}`;
      
      const canOpen = await Linking.canOpenURL(checkoutUrl);
      if (canOpen) {
        await Linking.openURL(checkoutUrl);
      } else {
        console.error('Cannot open URL:', checkoutUrl);
      }
    } catch (error) {
      console.error('Error opening subscription page:', error);
    } finally {
      setSubscribing(false);
    }
  };

  const handleManageSubscription = async () => {
    try {
      // Redirect to your website's subscription management page
      const manageUrl = `https://batchmaker.app/dashboard`;
      
      const canOpen = await Linking.canOpenURL(manageUrl);
      if (canOpen) {
        await Linking.openURL(manageUrl);
      }
    } catch (error) {
      console.error('Error opening manage page:', error);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.text }]}>
          Loading subscription options...
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>
            {hasSubscription ? 'Team Plan Active' : 'Upgrade to Team Plan'}
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            {hasSubscription 
              ? 'Collaborate with your team' 
              : 'Sync & collaborate with up to 5 users'}
          </Text>
        </View>

        {hasSubscription && (
          <View style={[styles.statusBadge, { backgroundColor: colors.success || '#10b981' }]}>
            <Text style={styles.statusText}>✓ Active Subscription</Text>
          </View>
        )}

        <View style={[styles.featuresCard, { backgroundColor: colors.surface }]}>
          <Text style={[styles.featuresTitle, { color: colors.text }]}>Team Plan Features:</Text>
          {[
            'Up to 5 active users',
            'Everything in Free plan',
            'Team sync & collaboration',
            'Cloud storage & backup',
            'Priority support',
            'Advanced reporting & analytics',
            'Export to Excel & CSV'
          ].map((feature, index) => (
            <View key={index} style={styles.featureRow}>
              <Text style={[styles.checkmark, { color: colors.success || '#10b981' }]}>✓</Text>
              <Text style={[styles.featureText, { color: colors.text }]}>{feature}</Text>
            </View>
          ))}
        </View>

        {!hasSubscription && (
          <>
            <View style={styles.plansContainer}>
              {/* Team Plan - Only Option */}
              <TouchableOpacity
                style={[styles.planCard, { 
                  backgroundColor: colors.primary + '15',
                  borderColor: colors.primary,
                  borderWidth: 2
                }]}
                onPress={handleSubscribe}
                disabled={subscribing}
              >
                <View style={[styles.badge, { backgroundColor: colors.success || '#10b981' }]}>
                  <Text style={styles.badgeText}>POPULAR</Text>
                </View>
                <Text style={[styles.planName, { color: colors.text }]}>Team Plan</Text>
                <Text style={[styles.planPrice, { color: colors.primary }]}>
                  $10/month
                </Text>
                <Text style={[styles.planDetail, { color: colors.textSecondary }]}>
                  Up to 5 active users
                </Text>
                <Text style={[styles.planDetail, { color: colors.textSecondary }]}>
                  + $1/month per additional user
                </Text>
                {subscribing ? (
                  <ActivityIndicator color={colors.primary} style={{ marginTop: 12 }} />
                ) : (
                  <View style={[styles.selectButton, { backgroundColor: colors.primary }]}>
                    <Text style={styles.selectButtonText}>Get Started</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>

            <View style={[styles.freeInfo, { backgroundColor: colors.surface }]}>
              <Text style={[styles.freeTitle, { color: colors.text }]}>
                Currently on Free Plan
              </Text>
              <Text style={[styles.freeText, { color: colors.textSecondary }]}>
                ✓ Unlimited workflows & batches{'\n'}
                ✓ Solo use only{'\n'}
                ✓ Local device storage{'\n'}
                ✓ Core features included
              </Text>
            </View>

            <View style={styles.legal}>
              <Text style={[styles.legalText, { color: colors.textSecondary }]}>
                Subscription automatically renews unless cancelled at least 24 hours before the end of the current period.
              </Text>
              <Text style={[styles.legalText, { color: colors.textSecondary }]}>
                Privacy Policy • Terms of Service
              </Text>
            </View>
          </>
        )}

        {hasSubscription && (
          <TouchableOpacity
            onPress={handleManageSubscription}
            style={[styles.manageButton, { backgroundColor: colors.primary }]}
          >
            <Text style={styles.buttonText}>Manage Subscription</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      <TouchableOpacity style={styles.closeButton} onPress={() => router.back()}>
        <Text style={[styles.closeButtonText, { color: colors.textSecondary }]}>
          {hasSubscription ? 'Close' : 'Maybe Later'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1 
  },
  scrollContent: { 
    padding: 20, 
    paddingBottom: 100 
  },
  header: { 
    alignItems: 'center', 
    marginBottom: 32, 
    marginTop: 20 
  },
  title: { 
    fontSize: 32, 
    fontWeight: 'bold', 
    marginBottom: 8 
  },
  subtitle: { 
    fontSize: 16, 
    textAlign: 'center' 
  },
  statusBadge: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    alignSelf: 'center',
    marginBottom: 24,
  },
  statusText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  featuresCard: { 
    borderRadius: 16, 
    padding: 20, 
    marginBottom: 24 
  },
  featuresTitle: { 
    fontSize: 20, 
    fontWeight: 'bold', 
    marginBottom: 16 
  },
  featureRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    marginBottom: 12 
  },
  checkmark: { 
    fontSize: 20, 
    marginRight: 12, 
    fontWeight: 'bold' 
  },
  featureText: { 
    fontSize: 16, 
    flex: 1 
  },
  trialInfo: { 
    borderRadius: 12, 
    padding: 16, 
    alignItems: 'center', 
    marginBottom: 24 
  },
  trialText: { 
    fontSize: 18, 
    marginBottom: 4 
  },
  trialSubtext: { 
    fontSize: 14 
  },
  freeInfo: {
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
    marginBottom: 24,
  },
  freeTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  freeText: {
    fontSize: 14,
    lineHeight: 22,
  },
  plansContainer: { 
    marginBottom: 24 
  },
  planCard: { 
    borderRadius: 16, 
    padding: 24, 
    marginBottom: 16, 
    alignItems: 'center', 
    position: 'relative' 
  },
  badge: { 
    position: 'absolute', 
    top: -10, 
    right: 20, 
    paddingHorizontal: 12, 
    paddingVertical: 4, 
    borderRadius: 12 
  },
  badgeText: { 
    color: 'white', 
    fontSize: 12, 
    fontWeight: 'bold' 
  },
  planName: { 
    fontSize: 24, 
    fontWeight: 'bold', 
    marginBottom: 8 
  },
  planPrice: { 
    fontSize: 32, 
    fontWeight: 'bold', 
    marginBottom: 4 
  },
  planDetail: { 
    fontSize: 14, 
    marginBottom: 16 
  },
  selectButton: { 
    paddingVertical: 12, 
    paddingHorizontal: 32, 
    borderRadius: 12 
  },
  selectButtonText: { 
    color: 'white', 
    fontSize: 16, 
    fontWeight: '600' 
  },
  manageButton: {
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
  },
  legal: { 
    alignItems: 'center', 
    gap: 8 
  },
  legalText: { 
    fontSize: 12, 
    textAlign: 'center', 
    lineHeight: 18 
  },
  closeButton: { 
    position: 'absolute', 
    bottom: 30, 
    left: 0, 
    right: 0, 
    alignItems: 'center', 
    padding: 16 
  },
  closeButtonText: { 
    fontSize: 16 
  },
  loadingText: { 
    marginTop: 16, 
    fontSize: 16 
  },
});