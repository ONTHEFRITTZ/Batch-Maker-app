// ============================================
// FILE: app/index.tsx
// Offline-aware home screen.
// Uses useAppInit for startup state and
// useConnectionStatus for live sync status.
// ============================================

import type { User } from "@supabase/supabase-js";
import * as Linking from "expo-linking";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  Alert,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useTheme } from "../contexts/ThemeContext";
import { supabase } from "../lib/supabase";
import { SyncStatusBar } from "../app/components/SyncStatusBar";
import { useConnectionStatus } from "../hooks/useConnectionStatus";
import { useAppInit } from "../hooks/useAppInit";

export default function HomeScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const [user, setUser] = useState<User | null>(null);

  // ── Offline-aware init ─────────────────────────────────────────────────────
  const { initState } = useAppInit();

  // ── Live connection + sync status ──────────────────────────────────────────
  const connection = useConnectionStatus();

  // ── Auth state (mirrors session in/out events after init) ─────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // ── Deep link handler (OAuth callback) ────────────────────────────────────
  useEffect(() => {
    const handleDeepLink = async (event: { url: string }) => {
      const url = event.url;
      if (url.includes("#access_token=") || url.includes("?access_token=")) {
        try {
          const urlObj = new URL(url);
          const hashParams = new URLSearchParams(urlObj.hash.substring(1));
          const queryParams = urlObj.searchParams;
          const access_token = queryParams.get("access_token") || hashParams.get("access_token");
          const refresh_token = queryParams.get("refresh_token") || hashParams.get("refresh_token");

          if (access_token && refresh_token) {
            const { error } = await supabase.auth.setSession({ access_token, refresh_token });
            if (error) Alert.alert("Sign In Error", error.message);
          }
        } catch {
          Alert.alert("Error", "Failed to complete sign in");
        }
      }
    };

    const sub = Linking.addEventListener("url", handleDeepLink);
    Linking.getInitialURL().then(url => { if (url) handleDeepLink({ url }); });
    return () => sub.remove();
  }, []);

  // ── Auth actions ───────────────────────────────────────────────────────────
  const signInWithGoogle = async () => {
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: "batchmaker://", skipBrowserRedirect: true },
      });
      if (error) { Alert.alert("Error", error.message); return; }
      if (!data?.url) { Alert.alert("Error", "Failed to get sign-in URL"); return; }
      const supported = await Linking.canOpenURL(data.url);
      if (supported) await Linking.openURL(data.url);
      else Alert.alert("Error", "Cannot open sign-in page");
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to sign in");
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  // ── Loading splash ─────────────────────────────────────────────────────────
  if (initState === 'loading') {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.header}>
          <Image
            source={require("../assets/images/splash-alpha.png")}
            style={styles.logo}
            resizeMode="cover"
          />
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Digital SOP System
          </Text>
        </View>
      </View>
    );
  }

  // ── Not authenticated ──────────────────────────────────────────────────────
  if (initState === 'unauthenticated' && !user) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.header}>
          <Image
            source={require("../assets/images/splash-alpha.png")}
            style={styles.logo}
            resizeMode="cover"
          />
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Digital SOP System
          </Text>
        </View>
        <View style={styles.signInContainer}>
          <TouchableOpacity onPress={signInWithGoogle} style={styles.signInButton}>
            <Text style={styles.signInButtonText}>Sign In with Google</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── Main app (online or offline with cached session) ───────────────────────
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>

      {/* Offline / sync status banner */}
      <SyncStatusBar connection={connection} />

      {/* Top bar: sync dot + sign out */}
      <View style={styles.topBar}>
        <View style={styles.syncIndicator}>
          <View style={[
            styles.syncDot,
            {
              backgroundColor:
                connection.state === 'offline'  ? '#ef4444' :
                connection.state === 'checking' ? '#f59e0b' :
                connection.pendingCount > 0     ? '#f59e0b' :
                                                  '#10b981',
            }
          ]} />
          <Text style={[styles.syncText, { color: colors.textSecondary }]}>
            {connection.state === 'offline'
              ? 'Offline'
              : connection.state === 'checking'
              ? 'Connecting…'
              : connection.pendingCount > 0
              ? `${connection.pendingCount} pending`
              : connection.lastSyncedAt
              ? `Synced ${Math.floor((Date.now() - connection.lastSyncedAt.getTime()) / 1000)}s ago`
              : 'Connected'}
          </Text>
        </View>
        <TouchableOpacity onPress={signOut} style={styles.signOutButton}>
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>
      </View>

      {/* Logo */}
      <View style={styles.header}>
        <Image
          source={require("../assets/images/splash-alpha.png")}
          style={styles.logo}
          resizeMode="cover"
        />
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Digital SOP System
        </Text>
      </View>

      {/* Menu */}
      <View style={styles.menuContainer}>
        {user && (
          <Text style={[styles.email, { color: colors.textSecondary }]}>
            {user.email}
            {initState === 'offline' && (
              <Text style={styles.offlineBadge}> · Offline mode</Text>
            )}
          </Text>
        )}

        <TouchableOpacity
          onPress={() => router.push("/screens/WorkflowSelectScreen")}
          style={styles.menuButton}
        >
          <Text style={styles.menuButtonText}>Start Workflow</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => router.push("/screens/ClockInScreen")}
          style={[
            styles.menuButton,
            connection.state === 'offline' && styles.menuButtonDisabled,
          ]}
          disabled={connection.state === 'offline'}
        >
          <Text style={[
            styles.menuButtonText,
            connection.state === 'offline' && styles.menuButtonTextDisabled,
          ]}>
            Clock In/Out
          </Text>
          {connection.state === 'offline' && (
            <Text style={styles.requiresNet}>Requires internet</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => router.push("/screens/ReportsScreen")}
          style={[
            styles.menuButton,
            connection.state === 'offline' && styles.menuButtonDisabled,
          ]}
          disabled={connection.state === 'offline'}
        >
          <Text style={[
            styles.menuButtonText,
            connection.state === 'offline' && styles.menuButtonTextDisabled,
          ]}>
            View Reports
          </Text>
          {connection.state === 'offline' && (
            <Text style={styles.requiresNet}>Requires internet</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
  },
  topBar: {
    position: "absolute",
    top: 50,
    right: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    zIndex: 10,
  },
  syncIndicator: {
    flexDirection: "row",
    alignItems: "center",
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
    backgroundColor: "#f3f4f6",
    borderRadius: 8,
  },
  signOutText: {
    color: "#374151",
    fontSize: 14,
    fontWeight: "500",
  },
  header: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
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
    justifyContent: "center",
    alignItems: "center",
  },
  signInButton: {
    backgroundColor: "#1f2937",
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  signInButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
  },
  menuContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    maxWidth: 400,
    width: "100%",
    alignSelf: "center",
  },
  email: {
    fontSize: 14,
    marginBottom: 32,
  },
  offlineBadge: {
    color: '#ef4444',
    fontSize: 12,
  },
  menuButton: {
    width: "100%",
    backgroundColor: "#ffffff",
    paddingVertical: 18,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    elevation: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  menuButtonDisabled: {
    opacity: 0.45,
  },
  menuButtonText: {
    color: "#1f2937",
    fontSize: 16,
    fontWeight: "500",
    textAlign: "center",
  },
  menuButtonTextDisabled: {
    color: "#9ca3af",
  },
  requiresNet: {
    fontSize: 11,
    color: "#9ca3af",
    textAlign: "center",
    marginTop: 2,
  },
});