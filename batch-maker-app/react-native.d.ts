// Type declarations to fix React 19 + React Native compatibility
// Place this file in your project root

import * as React from 'react';

declare module 'react-native' {
  // Re-export everything from the original react-native module
  export * from 'react-native/index';
  
  // Import original types
  import type * as RN from 'react-native/index';
  
  // Override component exports to be React 19 compatible
  export const View: React.FC<RN.ViewProps>;
  export const Text: React.FC<RN.TextProps>;
  export const ScrollView: React.FC<RN.ScrollViewProps>;
  export const TouchableOpacity: React.FC<RN.TouchableOpacityProps>;
  export const ActivityIndicator: React.FC<RN.ActivityIndicatorProps>;
  export const TextInput: React.FC<RN.TextInputProps>;
  export const Image: React.FC<RN.ImageProps>;
  export const FlatList: React.FC<RN.FlatListProps<any>>;
  export const SafeAreaView: React.FC<RN.ViewProps>;
  export const Button: React.FC<RN.ButtonProps>;
  export const Pressable: React.FC<RN.PressableProps>;
  
  // Keep all utilities and APIs as-is
  export const StyleSheet: typeof RN.StyleSheet;
  export const Alert: typeof RN.Alert;
  export const Platform: typeof RN.Platform;
  export const Dimensions: typeof RN.Dimensions;
  export const Animated: typeof RN.Animated;
  export const Keyboard: typeof RN.Keyboard;
}