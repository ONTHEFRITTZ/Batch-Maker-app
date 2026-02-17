import type { User } from "@supabase/supabase-js";
import * as Linking from "expo-linking";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
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
import { pushToCloud } from "../services/cloudSync";

export default function HomeScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const syncIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const performSync = async (silent: boolean = true) => {
    try {
      console.log("Auto-syncing...");
      const result = await pushToCloud();

      if (result.success) {
        setLastSync(new Date());
        if (!silent && result.uploaded > 0) {
          console.log(`Synced ${result.uploaded} items`);
        }
      } else if (!silent) {
        Alert.alert("Sync Issues", result.errors.join("\n"));
      }
    } catch (error: any) {
      console.error("Sync error:", error);
      if (!silent) {
        Alert.alert("Sync Failed", error.message);
      }
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);

      if (session?.user) {
        performSync(false);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);

      if (session?.user) {
        performSync(false);
      }
    });

    const handleDeepLink = async (event: { url: string }) => {
      console.log("Deep link received:", event.url);
      
      const url = event.url;

      if (url.includes("#access_token=") || url.includes("?access_token=")) {
        try {
          const urlObj = new URL(url);
          const hashParams = new URLSearchParams(urlObj.hash.substring(1));
          const queryParams = urlObj.searchParams;
          
          const access_token = queryParams.get("access_token") || hashParams.get("access_token");
          const refresh_token = queryParams.get("refresh_token") || hashParams.get("refresh_token");

          if (access_token && refresh_token) {
            console.log("Setting session from deep link tokens...");
            const { error } = await supabase.auth.setSession({
              access_token,
              refresh_token,
            });

            if (error) {
              console.error("Error setting session:", error);
              Alert.alert("Sign In Error", error.message);
            } else {
              console.log("Session established successfully");
            }
          }
        } catch (error: any) {
          console.error("Error processing deep link:", error);
          Alert.alert("Error", "Failed to complete sign in");
        }
      }
    };

    const subscription2 = Linking.addEventListener("url", handleDeepLink);

    Linking.getInitialURL().then((url) => {
      if (url) {
        handleDeepLink({ url });
      }
    });

    return () => {
      subscription.unsubscribe();
      subscription2.remove();
    };
  }, []);

  useEffect(() => {
    if (user) {
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
      console.log("Starting Google OAuth...");

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: "batchmaker://",
          skipBrowserRedirect: true, // Get URL but don't auto-open
        },
      });

      if (error) {
        console.error("OAuth error:", error);
        Alert.alert("Error", error.message);
        return;
      }

      if (!data?.url) {
        Alert.alert("Error", "Failed to get sign-in URL");
        return;
      }

      // Manually open the URL in system browser
      const supported = await Linking.canOpenURL(data.url);
      if (supported) {
        await Linking.openURL(data.url);
      } else {
        Alert.alert("Error", "Cannot open sign-in page");
      }
    } catch (error: any) {
      console.error("Sign in error:", error);
      Alert.alert("Error", error.message || "Failed to sign in");
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
      {user ? (
        <View style={styles.topBar}>
          <View style={styles.syncIndicator}>
            <View
              style={[
                styles.syncDot,
                { backgroundColor: lastSync ? "#10b981" : "#6b7280" },
              ]}
            />
            <Text style={[styles.syncText, { color: colors.textSecondary }]}>
              {lastSync
                ? `Synced ${Math.floor((Date.now() - lastSync.getTime()) / 1000)}s ago`
                : "Syncing..."}
            </Text>
          </View>
          <TouchableOpacity onPress={signOut} style={styles.signOutButton}>
            <Text style={styles.signOutText}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      ) : null}

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
            onPress={() => router.push("/screens/WorkflowSelectScreen")}
            style={styles.menuButton}
          >
            <Text style={styles.menuButtonText}>Start Workflow</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.push("/screens/ClockInScreen")}
            style={styles.menuButton}
          >
            <Text style={styles.menuButtonText}>Clock In/Out</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.push("/screens/ReportsScreen")}
            style={styles.menuButton}
          >
            <Text style={styles.menuButtonText}>View Reports</Text>
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
  menuButtonText: {
    color: "#1f2937",
    fontSize: 16,
    fontWeight: "500",
    textAlign: "center",
  },
});