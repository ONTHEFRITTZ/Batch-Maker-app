import { useEffect } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from './lib/supabase';
import { useTheme } from '../contexts/ThemeContext';

export default function Callback() {
  const router = useRouter();
  const { colors } = useTheme();
  const params = useLocalSearchParams();

  useEffect(() => {
    const handleCallback = async () => {
      try {
        console.log('🔄 Callback screen loaded');
        console.log('All params:', params);

        // Try multiple ways to get the tokens
        const access_token = (
          params.access_token || 
          params['access_token'] || 
          params['#access_token']
        ) as string;
        
        const refresh_token = (
          params.refresh_token || 
          params['refresh_token'] || 
          params['#refresh_token']
        ) as string;

        console.log('Access token found:', !!access_token);
        console.log('Refresh token found:', !!refresh_token);

        if (access_token && refresh_token) {
          console.log('✅ Setting session with tokens...');
          
          const { data, error } = await supabase.auth.setSession({
            access_token,
            refresh_token,
          });

          if (error) {
            console.error('❌ Error setting session:', error);
            router.replace('/');
            return;
          }

          console.log('✅ Session set! User:', data.user?.email);
          
          // Navigate to home
          setTimeout(() => {
            router.replace('/');
          }, 500);
        } else {
          console.log('⚠️ No tokens found, going home');
          router.replace('/');
        }
      } catch (error) {
        console.error('❌ Error in callback:', error);
        router.replace('/');
      }
    };

    handleCallback();
  }, [params]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={[styles.text, { color: colors.text }]}>
        Completing sign in...
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    marginTop: 16,
    fontSize: 16,
  },
});