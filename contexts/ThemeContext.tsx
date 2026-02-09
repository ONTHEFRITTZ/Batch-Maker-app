import React, { createContext, useContext, useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const THEME_KEY = '@theme_preference';

type Theme = 'light' | 'dark' | 'auto';
type ResolvedTheme = 'light' | 'dark';

interface ThemeColors {
  background: string;
  surface: string;
  surfaceVariant: string;
  text: string;
  textSecondary: string;
  primary: string;
  primaryVariant: string;
  error: string;
  success: string;
  warning: string;
  border: string;
  shadow: string;
  disabled: string;
}

const lightColors: ThemeColors = {
  background: '#f5f5f5',
  surface: '#ffffff',
  surfaceVariant: '#f0f0f0',
  text: '#333333',
  textSecondary: '#666666',
  primary: '#007AFF',
  primaryVariant: '#0051D5',
  error: '#ff0000',
  success: '#28a745',
  warning: '#ffc107',
  border: '#e0e0e0',
  shadow: '#000000',
  disabled: '#cccccc',
};

const darkColors: ThemeColors = {
  background: '#121212',
  surface: '#1e1e1e',
  surfaceVariant: '#2a2a2a',
  text: '#ffffff',
  textSecondary: '#b0b0b0',
  primary: '#0a84ff',
  primaryVariant: '#0066cc',
  error: '#ff453a',
  success: '#32d74b',
  warning: '#ffd60a',
  border: '#3a3a3a',
  shadow: '#000000',
  disabled: '#4a4a4a',
};

interface ThemeContextType {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  colors: ThemeColors;
  setTheme: (theme: Theme) => Promise<void>;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemColorScheme = useColorScheme();
  const [theme, setThemeState] = useState<Theme>('auto');
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>('light');

  useEffect(() => {
    loadTheme();
  }, []);

  useEffect(() => {
    if (theme === 'auto') {
      setResolvedTheme(systemColorScheme === 'dark' ? 'dark' : 'light');
    } else {
      setResolvedTheme(theme);
    }
  }, [theme, systemColorScheme]);

  const loadTheme = async () => {
    try {
      const saved = await AsyncStorage.getItem(THEME_KEY);
      if (saved) {
        setThemeState(saved as Theme);
      }
    } catch (error) {
      console.error('Error loading theme:', error);
    }
  };

  const setTheme = async (newTheme: Theme) => {
    try {
      await AsyncStorage.setItem(THEME_KEY, newTheme);
      setThemeState(newTheme);
    } catch (error) {
      console.error('Error saving theme:', error);
    }
  };

  const colors = resolvedTheme === 'dark' ? darkColors : lightColors;

  return (
    <ThemeContext.Provider
      value={{
        theme,
        resolvedTheme,
        colors,
        setTheme,
        isDark: resolvedTheme === 'dark',
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}