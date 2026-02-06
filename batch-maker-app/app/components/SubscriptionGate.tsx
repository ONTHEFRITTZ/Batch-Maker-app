import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../../contexts/ThemeContext';
import { supabase } from '../lib/supabase';

interface SubscriptionGateProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export default function SubscriptionGate({ children, fallback }: SubscriptionGateProps) {
  const router = useRouter();
  const { colors } = useTheme();
  const [hasSubscription, setHasSubscription] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkSubscription();
  }, []);

  const checkSubscription = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        setHasSubscription(false);
        setLoading(false);
        return;
      }

      // Check subscription status from your Supabase database
      // You'll need a subscriptions table that tracks Stripe subscriptions
      const { data: subscription, error } = await supabase
        .from('subscriptions')
        .select('status, current_period_end')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        console.error('Error checking subscription:', error);
        setHasSubscription(false);
        setLoading(false);
        return;
      }

      // Check if subscription is active and not expired
      const isActive = subscription && 
        subscription.status === 'active' && 
        new Date(subscription.current_period_end) > new Date();

      setHasSubscription(isActive);
      setLoading(false);
    } catch (error) {
      console.error('Error checking subscription:', error);
      setHasSubscription(false);
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.text, { color: colors.text }]}>
          Checking subscription...
        </Text>
      </View>
    );
  }

  if (!hasSubscription) {
    if (fallback) {
      return <>{fallback}</>;
    }

    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={[styles.title, { color: colors.text }]}>
          Premium Feature
        </Text>
        <Text style={[styles.message, { color: colors.textSecondary }]}>
          This feature requires an active subscription.
        </Text>
        <TouchableOpacity
          onPress={() => {
            // Navigate to your website's subscription page
            // You can use Linking.openURL() to open the website
            console.log('Navigate to subscription page');
          }}
          style={[styles.button, { backgroundColor: colors.primary }]}
        >
          <Text style={styles.buttonText}>Subscribe Now</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => router.back()}
          style={[styles.backButton, { borderColor: colors.border }]}
        >
          <Text style={[styles.backButtonText, { color: colors.text }]}>
            Go Back
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  message: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 32,
  },
  text: {
    marginTop: 16,
    fontSize: 16,
  },
  button: {
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    marginBottom: 12,
    minWidth: 200,
    alignItems: 'center',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  backButton: {
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    borderWidth: 1,
    minWidth: 200,
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});