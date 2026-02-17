import React from 'react';
import { View, Image, TouchableOpacity, StyleSheet, Text } from 'react-native';
import { useRouter, useNavigation } from 'expo-router';
import { useTheme } from '../../contexts/ThemeContext';

const logo = require('../../assets/images/batch-maker-alpha.png');

export default function CustomHeader({ canGoBack }: { canGoBack?: boolean }) {
  const router = useRouter();
  const navigation = useNavigation();
  const { colors } = useTheme();

  const handleBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      router.back();
    }
  };

  return (
    <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
      {canGoBack && (
        <TouchableOpacity 
          onPress={handleBack}
          style={styles.backButton}
          activeOpacity={0.6}
        >
          <Text style={[styles.backArrow, { color: colors.primary }]}>←</Text>
        </TouchableOpacity>
      )}
      
      <Image 
        source={logo}
        style={styles.logo}
        resizeMode="contain"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 106,
    paddingTop: 50,
    borderBottomWidth: 0,
  },
  backButton: {
    position: 'absolute',
    paddingTop: 50,
    left: 8,
    padding: 8,
    zIndex: 10,
  },
  backArrow: {
    fontSize: 28,
    paddingBottom: 14,
    fontWeight: '600',
  },
  logo: {
    height: 60,
    width: 146,
    paddingBottom: 4,
  },
});