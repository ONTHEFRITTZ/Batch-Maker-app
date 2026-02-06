import { useEffect } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import { supabase } from './lib/supabase';
import { useTheme } from '../contexts/ThemeContext';

export default function NotFound() {
  const router = useRouter();
  const { colors } = useTheme();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        // Get the current URL
        const url = await Linking.getInitialURL();
        console.log('Not found screen - checking URL:', url);

        if (url) {
          // Check if this is an auth callback URL
          const parsedUrl = Linking.parse(url);
          console.log('Parsed URL:', parsedUrl);

          // Extract tokens from the URL
          if (parsedUrl.queryParams) {
            const access_token = parsedUrl.queryParams.access_token as string;
            const refresh_token = parsedUrl.queryParams.refresh_token as string;

            if (access_token && refresh_token) {
              console.log('✅ Found tokens in not-found, setting session...');
              
              await supabase.auth.setSession({
                access_token,
                refresh_token,
              });

              console.log('✅ Session set, redirecting to home...');
              setTimeout(() => {
                router.replace('/');
              }, 500);
              return;
            }
          }
        }

        // No auth tokens, just go home
        console.log('No auth data found, redirecting to home');
        setTimeout(() => {
          router.replace('/');
        }, 1000);
      } catch (error) {
        console.error('Error in not-found handler:', error);
        router.replace('/');
      }
    };

    checkAuth();
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={[styles.text, { color: colors.text }]}>
        Redirecting...
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