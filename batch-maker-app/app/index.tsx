import { View, Text, TouchableOpacity, Image, StyleSheet, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../contexts/ThemeContext';
import { supabase } from './lib/supabase';
import { useEffect, useState, useRef } from 'react';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import type { User } from '@supabase/supabase-js';
import { pushToCloud } from '../services/cloudSync';

WebBrowser.maybeCompleteAuthSession();

export default function HomeScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const syncIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-sync function
  const performSync = async (silent: boolean = true) => {
    try {
      console.log('🔄 Auto-syncing...');
      const result = await pushToCloud();
      
      if (result.success) {
        setLastSync(new Date());
        if (!silent && result.uploaded > 0) {
          console.log(`✅ Synced ${result.uploaded} items`);
        }
      } else if (!silent) {
        Alert.alert('Sync Issues', result.errors.join('\n'));
      }
    } catch (error: any) {
      console.error('Sync error:', error);
      if (!silent) {
        Alert.alert('Sync Failed', error.message);
      }
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
      
      // Sync immediately on sign in
      if (session?.user) {
        performSync(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      
      // Sync when user signs in
      if (session?.user) {
        performSync(false);
      }
    });

    const handleDeepLink = (event: { url: string }) => {
      console.log('🔗 handleDeepLink FIRED!');
      const url = event.url;
      console.log('Deep link received:', url);
      
      if (url.includes('#access_token=') || url.includes('?access_token=')) {
        const paramString = url.includes('#') ? url.split('#')[1] : url.split('?')[1];
        const params = new URLSearchParams(paramString);
        const access_token = params.get('access_token');
        const refresh_token = params.get('refresh_token');
        
        if (access_token && refresh_token) {
          console.log('✅ Tokens found in deep link, setting session...');
          supabase.auth.setSession({
            access_token,
            refresh_token,
          }).then(({ data, error }) => {
            if (error) {
              console.error('❌ Error setting session:', error);
            } else {
              console.log('✅ Session set successfully! User:', data.user?.email);
              router.replace('/');
            }
          }).catch((error) => {
            console.error('❌ Error setting session:', error);
          });
        }
      }
    };

    const subscription2 = Linking.addEventListener('url', handleDeepLink);

    return () => {
      subscription.unsubscribe();
      subscription2.remove();
    };
  }, []);

  // Set up auto-sync interval when user is signed in
  useEffect(() => {
    if (user) {
      // Sync every 30 seconds
      syncIntervalRef.current = setInterval(() => {
        performSync(true);
      }, 30000);

      return () => {
        if (syncIntervalRef.current) {
          clearInterval(syncIntervalRef.current);
        }
      };
    }
  }, [user]);

  const signInWithGoogle = async () => {
    try {
      const redirectUrl = 'batchmaker://';
      console.log('Redirect URL:', redirectUrl);

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          skipBrowserRedirect: false,
        },
      });

      if (error) {
        Alert.alert('Error', error.message);
        return;
      }

      if (data?.url) {
        const result = await WebBrowser.openAuthSessionAsync(
          data.url,
          redirectUrl
        );

        if (result.type === 'success' && result.url) {
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
    if (syncIntervalRef.current) {
      clearInterval(syncIntervalRef.current);
    }
    await supabase.auth.signOut();
    setLastSync(null);
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
      {/* Sign In/Out Button - Top Right */}
      {user ? (
        <View style={styles.topBar}>
          <View style={styles.syncIndicator}>
            <View style={[styles.syncDot, { backgroundColor: lastSync ? '#10b981' : '#6b7280' }]} />
            <Text style={[styles.syncText, { color: colors.textSecondary }]}>
              {lastSync ? `Synced ${Math.floor((Date.now() - lastSync.getTime()) / 1000)}s ago` : 'Syncing...'}
            </Text>
          </View>
          <TouchableOpacity
            onPress={signOut}
            style={styles.signOutButton}
          >
            <Text style={styles.signOutText}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* Logo and Title */}
      <View style={styles.header}>
        <Image 
          source={require('../assets/images/splash-alpha.png')}
          style={styles.logo}
          resizeMode="cover"
        />
        
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Digital SOP System
        </Text>
      </View>

      {/* Main Content */}
      {!user ? (
        <View style={styles.signInContainer}>
          <TouchableOpacity
            onPress={signInWithGoogle}
            style={styles.signInButton}
          >
            <Text style={styles.signInButtonText}>Sign In with Google</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.menuContainer}>
          <Text style={[styles.email, { color: colors.textSecondary }]}>
            {user.email}
          </Text>
          
          <TouchableOpacity
            onPress={() => router.push('/screens/WorkflowSelectScreen')}
            style={styles.menuButton}
          >
            <Text style={styles.menuButtonText}>Start Workflow</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            onPress={() => router.push('/screens/ClockInScreen')}
            style={styles.menuButton}
          >
            <Text style={styles.menuButtonText}>Clock In/Out</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            onPress={() => router.push('/screens/ReportsScreen')}
            style={styles.menuButton}
          >
            <Text style={styles.menuButtonText}>View Reports</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            onPress={() => router.push('/screens/NetworkScanScreen')}
            style={styles.menuButton}
          >
            <Text style={styles.menuButtonText}>Local Network Sync</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
  },
  topBar: {
    position: 'absolute',
    top: 50,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    zIndex: 10,
  },
  syncIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  syncDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  syncText: {
    fontSize: 12,
  },
  signOutButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
  },
  signOutText: {
    color: '#374151',
    fontSize: 14,
    fontWeight: '500',
  },
  header: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    width: 200,
    height: 200,
    marginBottom: 16,
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 40,
  },
  signInContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  signInButton: {
    backgroundColor: '#1f2937',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  signInButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  menuContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    maxWidth: 400,
    width: '100%',
    alignSelf: 'center',
  },
  email: {
    fontSize: 14,
    marginBottom: 32,
  },
  menuButton: {
    width: '100%',
    backgroundColor: '#ffffff',
    paddingVertical: 18,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  menuButtonText: {
    color: '#1f2937',
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
  },
});