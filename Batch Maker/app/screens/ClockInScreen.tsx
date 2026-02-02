// ============================================
// FILE: screens/ClockInScreen.tsx
// Mobile clock-in/out with shift schedule view
// ============================================

import { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { supabase } from '../../services/supabaseClient';

interface NetworkConnection {
  owner_id: string;
  owner_name: string;
  role: 'owner' | 'admin' | 'member';
  require_clock_in: boolean;
  allow_anytime_access: boolean;
}

interface Shift {
  id: string;
  owner_id: string;
  shift_date: string;
  start_time: string;
  end_time: string;
  role: string | null;
  notes: string | null;
  status: string;
}

interface ActiveEntry {
  id: string;
  owner_id: string;
  clock_in: string;
  shift_id: string | null;
}

export default function ClockInScreen() {
  const [user, setUser] = useState<any>(null);
  const [networks, setNetworks] = useState<NetworkConnection[]>([]);
  const [upcomingShifts, setUpcomingShifts] = useState<Record<string, Shift[]>>({});
  const [activeEntry, setActiveEntry] = useState<ActiveEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [clockingIn, setClockingIn] = useState(false);
  const [shiftAlert, setShiftAlert] = useState<{ alert: boolean; message?: string } | null>(null);

  // Load user and data
  useEffect(() => {
    loadUser();
  }, []);

  useEffect(() => {
    if (!user) return;
    loadNetworks();
    loadActiveEntry();
    loadUpcomingShifts();

    // Check for shift-end alert every 5 minutes
    const alertInterval = setInterval(checkShiftAlert, 5 * 60 * 1000);
    return () => clearInterval(alertInterval);
  }, [user]);

  async function loadUser() {
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    setUser(currentUser);
    setLoading(false);
  }

  async function loadNetworks() {
    // Get all network_member_roles where this user is a member
    const { data: roles } = await supabase
      .from('network_member_roles')
      .select('*, profiles!network_member_roles_owner_id_fkey(device_name, email)')
      .eq('user_id', user.id);

    if (roles) {
      const connections: NetworkConnection[] = roles.map(r => ({
        owner_id: r.owner_id,
        owner_name: r.profiles?.device_name || r.profiles?.email || 'Unknown Business',
        role: r.role,
        require_clock_in: r.require_clock_in,
        allow_anytime_access: r.allow_anytime_access,
      }));
      setNetworks(connections);
    }
  }

  async function loadActiveEntry() {
    const { data } = await supabase
      .from('time_entries')
      .select('*')
      .eq('user_id', user.id)
      .is('clock_out', null)
      .single();

    setActiveEntry(data);
  }

  async function loadUpcomingShifts() {
    const today = new Date().toISOString().split('T')[0];
    const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const { data: shifts } = await supabase
      .from('shifts')
      .select('*')
      .eq('assigned_to', user.id)
      .eq('status', 'scheduled')
      .gte('shift_date', today)
      .lte('shift_date', sevenDaysFromNow)
      .order('shift_date', { ascending: true })
      .order('start_time', { ascending: true });

    if (shifts) {
      const grouped: Record<string, Shift[]> = {};
      shifts.forEach(s => {
        if (!grouped[s.owner_id]) grouped[s.owner_id] = [];
        grouped[s.owner_id].push(s);
      });
      setUpcomingShifts(grouped);
    }
  }

  async function handleClockIn(ownerId: string) {
    setClockingIn(true);

    try {
      const { data, error } = await supabase.functions.invoke('clock-in', {
        body: { owner_id: ownerId },
      });

      if (error) throw error;

      await loadActiveEntry();
      Alert.alert('Clocked In', 'You are now on the clock');
    } catch (err: any) {
      Alert.alert('Clock In Failed', err.message || 'Unable to clock in at this time');
    } finally {
      setClockingIn(false);
    }
  }

  async function handleClockOut() {
    setClockingIn(true);

    try {
      const { error } = await supabase.functions.invoke('clock-out', {});

      if (error) throw error;

      await loadActiveEntry();
      Alert.alert('Clocked Out', 'You are now off the clock');
    } catch (err: any) {
      Alert.alert('Clock Out Failed', err.message || 'Unable to clock out');
    } finally {
      setClockingIn(false);
    }
  }

  async function checkShiftAlert() {
    if (!activeEntry) return;

    const { data } = await supabase.functions.invoke('check-shift-alert', {});

    if (data?.alert) {
      setShiftAlert(data);
      Alert.alert(
        'Still Working?',
        data.message,
        [
          { text: 'Yes, Still Working', style: 'default' },
          { text: 'Clock Out Now', onPress: handleClockOut, style: 'destructive' },
        ]
      );
    }
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  if (!user) {
    return (
      <View style={styles.container}>
        <Text style={styles.emptyText}>Please sign in to view your schedule</Text>
      </View>
    );
  }

  const currentNetwork = networks.find(n => n.owner_id === activeEntry?.owner_id);

  return (
    <ScrollView style={styles.scrollView} contentContainerStyle={styles.container}>
      {/* Current Status */}
      {activeEntry ? (
        <View style={styles.statusCard}>
          <View style={styles.statusHeader}>
            <View style={[styles.statusDot, { backgroundColor: '#22c55e' }]} />
            <Text style={styles.statusTitle}>Clocked In</Text>
          </View>
          <Text style={styles.statusBusiness}>{currentNetwork?.owner_name || 'Unknown'}</Text>
          <Text style={styles.statusTime}>
            Since {new Date(activeEntry.clock_in).toLocaleTimeString()}
          </Text>
          <TouchableOpacity
            style={[styles.clockButton, styles.clockOutButton]}
            onPress={handleClockOut}
            disabled={clockingIn}
          >
            {clockingIn ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.clockButtonText}>Clock Out</Text>
            )}
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.statusCard}>
          <View style={styles.statusHeader}>
            <View style={[styles.statusDot, { backgroundColor: '#9ca3af' }]} />
            <Text style={styles.statusTitle}>Not Clocked In</Text>
          </View>
          <Text style={styles.statusSubtitle}>Select a business below to clock in</Text>
        </View>
      )}

      {/* Connected Networks */}
      {networks.length === 0 ? (
        <View style={styles.card}>
          <Text style={styles.emptyText}>
            You're not connected to any businesses yet. Ask your employer to send you an invite.
          </Text>
        </View>
      ) : (
        networks.map(network => {
          const shifts = upcomingShifts[network.owner_id] || [];
          const isClockedInHere = activeEntry?.owner_id === network.owner_id;

          return (
            <View key={network.owner_id} style={styles.card}>
              <Text style={styles.cardTitle}>{network.owner_name}</Text>
              <Text style={styles.cardSubtitle}>
                {network.role === 'owner' ? '👑 Owner' : network.role === 'admin' ? '⭐ Admin' : '👤 Team Member'}
                {network.allow_anytime_access && ' • Access Anytime'}
              </Text>

              {/* Upcoming Shifts */}
              {shifts.length > 0 && (
                <View style={styles.shiftsSection}>
                  <Text style={styles.shiftsSectionTitle}>Upcoming Shifts</Text>
                  {shifts.slice(0, 3).map(shift => {
                    const shiftDate = new Date(shift.shift_date + 'T00:00:00');
                    const isToday = shiftDate.toDateString() === new Date().toDateString();

                    return (
                      <View key={shift.id} style={styles.shiftRow}>
                        <View>
                          <Text style={styles.shiftDate}>
                            {isToday ? 'Today' : shiftDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                          </Text>
                          <Text style={styles.shiftTime}>
                            {shift.start_time.slice(0, 5)} - {shift.end_time.slice(0, 5)}
                            {shift.role && ` • ${shift.role}`}
                          </Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}

              {/* Clock In Button */}
              {!activeEntry && !network.allow_anytime_access && (
                <TouchableOpacity
                  style={[styles.clockButton, styles.clockInButton]}
                  onPress={() => handleClockIn(network.owner_id)}
                  disabled={clockingIn}
                >
                  {clockingIn ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.clockButtonText}>Clock In</Text>
                  )}
                </TouchableOpacity>
              )}

              {isClockedInHere && (
                <View style={styles.activeIndicator}>
                  <Text style={styles.activeIndicatorText}>✓ Currently Clocked In Here</Text>
                </View>
              )}
            </View>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  container: {
    padding: 16,
    gap: 16,
  },

  // Status card
  statusCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  statusTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  statusBusiness: {
    fontSize: 15,
    fontWeight: '500',
    color: '#3b82f6',
    marginBottom: 4,
  },
  statusTime: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 16,
  },
  statusSubtitle: {
    fontSize: 13,
    color: '#6b7280',
  },

  // Cards
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 12,
  },

  // Shifts
  shiftsSection: {
    marginBottom: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  shiftsSectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  shiftRow: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  shiftDate: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1f2937',
    marginBottom: 2,
  },
  shiftTime: {
    fontSize: 12,
    color: '#6b7280',
  },

  // Buttons
  clockButton: {
    height: 48,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clockInButton: {
    backgroundColor: '#22c55e',
  },
  clockOutButton: {
    backgroundColor: '#dc2626',
  },
  clockButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },

  // Active indicator
  activeIndicator: {
    marginTop: 12,
    padding: 8,
    backgroundColor: '#dcfce7',
    borderRadius: 6,
  },
  activeIndicatorText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#16a34a',
    textAlign: 'center',
  },

  emptyText: {
    fontSize: 14,
    color: '#9ca3af',
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 32,
  },
});