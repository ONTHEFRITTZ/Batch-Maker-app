import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';

export default function ThemeToggle() {
  const { theme, setTheme, colors } = useTheme();

  const options: Array<{ value: 'light' | 'dark' | 'auto'; label: string; icon: string }> = [
    { value: 'light', label: 'Light', icon: '☀️' },
    { value: 'dark', label: 'Dark', icon: '🌙' },
    { value: 'auto', label: 'Auto', icon: '🔄' },
  ];

  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: colors.text }]}>Theme</Text>
      <View style={styles.toggleContainer}>
        {options.map(option => (
          <TouchableOpacity
            key={option.value}
            style={[
              styles.toggleButton,
              { borderColor: colors.border },
              theme === option.value && {
                backgroundColor: colors.primary,
              },
            ]}
            onPress={() => setTheme(option.value)}
          >
            <Text style={styles.toggleIcon}>{option.icon}</Text>
            <Text
              style={[
                styles.toggleText,
                theme === option.value
                  ? styles.toggleTextActive
                  : { color: colors.textSecondary },
              ]}
            >
              {option.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 12,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  toggleContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  toggleButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 2,
    gap: 8,
  },
  toggleIcon: {
    fontSize: 20,
  },
  toggleText: {
    fontSize: 14,
    fontWeight: '600',
  },
  toggleTextActive: {
    color: 'white',
  },
});