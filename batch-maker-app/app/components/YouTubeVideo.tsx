import React from 'react';
import { View, StyleSheet, Linking, TouchableOpacity, Text } from 'react-native';
import { WebView } from 'react-native-webview';
import { useTheme } from '../../contexts/ThemeContext';

interface YouTubeVideoProps {
  url: string;
}

// Extract YouTube video ID from various URL formats
function getYouTubeVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /youtube\.com\/watch\?.*v=([^&\n?#]+)/
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }
  return null;
}

export default function YouTubeVideo({ url }: YouTubeVideoProps) {
  const { colors } = useTheme();
  const videoId = getYouTubeVideoId(url);

  if (!videoId) {
    // Fallback: just show a link if we can't parse the ID
    return (
      <View style={[styles.container, { backgroundColor: colors.surfaceVariant }]}>
        <TouchableOpacity
          style={[styles.linkButton, { backgroundColor: colors.primary }]}
          onPress={() => Linking.openURL(url)}
        >
          <Text style={styles.linkButtonText}>🎥 Open Video in YouTube</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Embed URL with parameters to remove related videos and controls
  const embedUrl = `https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1&playsinline=1`;

  return (
    <View style={styles.container}>
      <View style={styles.videoContainer}>
        <WebView
          style={styles.video}
          source={{ uri: embedUrl }}
          allowsFullscreenVideo
          mediaPlaybackRequiresUserAction={false}
          javaScriptEnabled
          domStorageEnabled
        />
      </View>
      
      <TouchableOpacity
        style={[styles.openButton, { backgroundColor: colors.surfaceVariant }]}
        onPress={() => Linking.openURL(url)}
      >
        <Text style={[styles.openButtonText, { color: colors.primary }]}>
          Open in YouTube App →
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    marginVertical: 8,
  },
  videoContainer: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: '#000',
    borderRadius: 12,
    overflow: 'hidden',
  },
  video: {
    flex: 1,
  },
  linkButton: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  linkButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  openButton: {
    marginTop: 8,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  openButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
});