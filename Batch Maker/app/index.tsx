import { View, Text, TouchableOpacity, Image, StyleSheet, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../contexts/ThemeContext';
import { supabase } from './lib/supabase';
import { useEffect, useState } from 'react';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import type { User } from '@supabase/supabase-js';

// This is required for the OAuth flow to work properly
WebBrowser.maybeCompleteAuthSession();

export default function HomeScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    // Handle deep links from OAuth redirect
    const handleDeepLink = (event: { url: string }) => {
      const url = event.url;
      console.log('Deep link received:', url);
      
      // Extract tokens from URL and set session
      if (url.includes('#access_token=')) {
        const params = new URLSearchParams(url.split('#')[1]);
        const access_token = params.get('access_token');
        const refresh_token = params.get('refresh_token');
        
        if (access_token && refresh_token) {
          supabase.auth.setSession({
            access_token,
            refresh_token,
          });
        }
      }
    };

    // Subscribe to deep link events
    const subscription2 = Linking.addEventListener('url', handleDeepLink);

    return () => {
      subscription.unsubscribe();
      subscription2.remove();
    };
  }, []);

  const signInWithGoogle = async () => {
    try {
      // Create the redirect URL for your app
      const redirectUrl = Linking.createURL('/');
      console.log('Redirect URL:', redirectUrl);

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          skipBrowserRedirect: true, // We'll handle the browser ourselves
        },
      });

      if (error) {
        Alert.alert('Error', error.message);
        return;
      }

      if (data?.url) {
        // Open the OAuth URL in the system browser
        const result = await WebBrowser.openAuthSessionAsync(
          data.url,
          redirectUrl
        );

        if (result.type === 'success' && result.url) {
          // The session will be set automatically via the deep link handler
          console.log('✅ OAuth successful');
        } else if (result.type === 'cancel') {
          Alert.alert('Cancelled', 'Sign in was cancelled');
        }
      }
    } catch (error: any) {
      console.error('Google sign in error:', error);
      Alert.alert('Error', error.message || 'Failed to sign in');
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.text }}>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Image 
        source={require('../assets/images/batch-maker-alpha.png')}
        style={styles.logo}
        resizeMode="contain"
      />
      
      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
        Digital SOP System
      </Text>

      {!user ? (
        <TouchableOpacity
          onPress={signInWithGoogle}
          style={[styles.button, { backgroundColor: colors.primary }]}
        >
          <Text style={styles.buttonText}>Sign In with Google</Text>
        </TouchableOpacity>
      ) : (
        <>
          <Text style={{ color: colors.text, marginBottom: 20 }}>
            Signed in as: {user.email}
          </Text>
          
          <TouchableOpacity
            onPress={() => router.push('/screens/WorkflowSelectScreen')}
            style={[styles.button, { backgroundColor: colors.primary }]}
          >
            <Text style={styles.buttonText}>Start Workflow</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            onPress={() => router.push('/screens/ReportsScreen')}
            style={[styles.button, { backgroundColor: colors.success }]}
          >
            <Text style={styles.buttonText}>Reports</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            onPress={() => router.push('/screens/NetworkScanScreen')}
            style={[styles.button, { backgroundColor: colors.warning }]}
          >
            <Text style={styles.buttonText}>Sync Devices</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            onPress={signOut}
            style={[styles.button, { backgroundColor: colors.error || '#dc2626' }]}
          >
            <Text style={styles.buttonText}>Sign Out</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  logo: {
    width: 250,
    height: 250,
    marginBottom: 20,
  },
  subtitle: {
    fontSize: 18,
    marginBottom: 40,
  },
  button: {
    padding: 16,
    borderRadius: 12,
    minWidth: 200,
    alignItems: 'center',
    marginBottom: 12,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});
