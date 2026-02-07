// ============================================
// FILE: app/screens/ClockInScreen.tsx
// Mobile clock-in/out with shift schedule view
// React 18/19 compatible version
// ============================================

import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { supabase } from '../lib/supabase';

interface Location {
  id: string;
  user_id: string;
  name: string;
  address: string | null;
}

interface NetworkConnection {
  location_id: string;
  owner_id: string;
  owner_name: string;
  location_name: string;
  role: 'owner' | 'admin' | 'member';
  require_clock_in: boolean;
  allow_anytime_access: boolean;
}

interface Shift {
  id: string;
  location_id: string;
  shift_date: string;
  start_time: string;
  end_time: string;
  role: string | null;
  notes: string | null;
  status: string;
}

interface ActiveEntry {
  id: string;
  location_id: string;
  clock_in: string;
  shift_id: string | null;
}

const ClockInScreen: React.FC = () => {
  const [user, setUser] = useState<any>(null);
  const [networks, setNetworks] = useState<NetworkConnection[]>([]);
  const [upcomingShifts, setUpcomingShifts] = useState<Record<string, Shift[]>>({});
  const [activeEntry, setActiveEntry] = useState<ActiveEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [clockingIn, setClockingIn] = useState(false);

  useEffect(() => {
    loadUser();
  }, []);

  useEffect(() => {
    if (!user) return;
    loadNetworks();
    loadActiveEntry();
    loadUpcomingShifts();

    const alertInterval = setInterval(checkShiftAlert, 5 * 60 * 1000);
    return () => clearInterval(alertInterval);
  }, [user]);

  async function loadUser() {
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    setUser(currentUser);
    setLoading(false);
  }

  async function loadNetworks() {
    if (!user) return;

    const connections: NetworkConnection[] = [];

    const { data: ownedLocations } = await supabase
      .from('locations')
      .select('*')
      .eq('user_id', user.id);

    const { data: memberRoles } = await supabase
      .from('network_member_roles')
      .select(`
        *,
        profiles:owner_id (device_name, email)
      `)
      .eq('user_id', user.id);

    if (ownedLocations) {
      ownedLocations.forEach((loc: Location) => {
        connections.push({
          location_id: loc.id,
          owner_id: user.id,
          owner_name: 'My Business',
          location_name: loc.name,
          role: 'owner',
          require_clock_in: false,
          allow_anytime_access: true,
        });
      });
    }

    if (memberRoles) {
      for (const r of memberRoles) {
        const { data: locationData } = await supabase
          .from('locations')
          .select('id, name, user_id')
          .eq('user_id', r.owner_id)
          .single();

        if (locationData) {
          connections.push({
            location_id: locationData.id,
            owner_id: r.owner_id,
            owner_name: (r.profiles as any)?.device_name || (r.profiles as any)?.email || 'Unknown Business',
            location_name: locationData.name,
            role: r.role,
            require_clock_in: r.require_clock_in,
            allow_anytime_access: r.allow_anytime_access,
          });
        }
      }
    }

    setNetworks(connections);
  }

  async function loadActiveEntry() {
    if (!user) return;

    const { data } = await supabase
      .from('time_entries')
      .select('*')
      .eq('user_id', user.id)
      .is('clock_out', null)
      .single();

    setActiveEntry(data);
  }

  async function loadUpcomingShifts() {
    if (!user) return;

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
      shifts.forEach((s: Shift) => {
        if (!grouped[s.location_id]) grouped[s.location_id] = [];
        grouped[s.location_id].push(s);
      });
      setUpcomingShifts(grouped);
    }
  }

  async function handleClockIn(locationId: string) {
    setClockingIn(true);

    try {
      const today = new Date().toISOString().split('T')[0];
      const { data: todayShifts } = await supabase
        .from('shifts')
        .select('*')
        .eq('assigned_to', user.id)
        .eq('location_id', locationId)
        .eq('shift_date', today)
        .eq('status', 'scheduled');

      if (!todayShifts || todayShifts.length === 0) {
        Alert.alert(
          'No Shift Scheduled',
          'You don\'t have a scheduled shift today. Are you sure you want to clock in?',
          [
            { text: 'Cancel', style: 'cancel', onPress: () => setClockingIn(false) },
            { text: 'Yes, Clock In', onPress: () => performClockIn(locationId) }
          ]
        );
        return;
      }

      await performClockIn(locationId, todayShifts[0].id);
    } catch (err: any) {
      Alert.alert('Clock In Failed', err.message || 'Unable to clock in at this time');
      setClockingIn(false);
    }
  }

  async function performClockIn(locationId: string, shiftId?: string) {
    try {
      const { error } = await supabase
        .from('time_entries')
        .insert({
          user_id: user.id,
          location_id: locationId,
          shift_id: shiftId || null,
          clock_in: new Date().toISOString(),
        });

      if (error) throw error;

      await loadActiveEntry();
      Alert.alert('Clocked In', 'You are now on the clock');
    } catch (err: any) {
      Alert.alert('Clock In Failed', err.message || 'Unable to clock in');
    } finally {
      setClockingIn(false);
    }
  }

  async function handleClockOut() {
    setClockingIn(true);

    try {
      if (!activeEntry) {
        throw new Error('No active time entry found');
      }

      const { error } = await supabase
        .from('time_entries')
        .update({ clock_out: new Date().toISOString() })
        .eq('id', activeEntry.id);

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
    if (!activeEntry || !activeEntry.shift_id) return;

    const { data: shift } = await supabase
      .from('shifts')
      .select('end_time')
      .eq('id', activeEntry.shift_id)
      .single();

    if (!shift) return;

    const now = new Date();
    const shiftEnd = new Date(`${new Date().toISOString().split('T')[0]}T${shift.end_time}`);
    const thirtyMinutesAfterShift = new Date(shiftEnd.getTime() + 30 * 60 * 1000);

    if (now > thirtyMinutesAfterShift) {
      Alert.alert(
        'Still Working?',
        'Your shift ended over 30 minutes ago. Are you still working?',
        [
          { text: 'Yes, Still Working', style: 'default' },
          { text: 'Clock Out Now', onPress: handleClockOut, style: 'destructive' },
        ]
      );
    }
  }

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  if (!user) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={styles.emptyText}>Please sign in to view your schedule</Text>
      </View>
    );
  }

  const currentNetwork = networks.find(n => n.location_id === activeEntry?.location_id);

  return (
    <ScrollView style={styles.scrollView} contentContainerStyle={styles.container}>
      {activeEntry ? (
        <View style={styles.statusCard}>
          <View style={styles.statusHeader}>
            <View style={[styles.statusDot, { backgroundColor: '#22c55e' }]} />
            <Text style={styles.statusTitle}>Clocked In</Text>
          </View>
          <Text style={styles.statusBusiness}>{currentNetwork?.location_name || 'Unknown'}</Text>
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
          <Text style={styles.statusSubtitle}>Select a location below to clock in</Text>
        </View>
      )}

      {networks.length === 0 ? (
        <View style={styles.card}>
          <Text style={styles.emptyText}>
            You don't have any locations yet. Create a location or ask your employer for an invite.
          </Text>
        </View>
      ) : (
        networks.map((network, index) => {
          const shifts = upcomingShifts[network.location_id] || [];
          const isClockedInHere = activeEntry?.location_id === network.location_id;

          return (
            <View key={`${network.location_id}-${index}`} style={styles.card}>
              <Text style={styles.cardTitle}>{network.location_name}</Text>
              <Text style={styles.cardSubtitle}>
                {network.role === 'owner' ? '👑 Owner' : network.role === 'admin' ? '⭐ Admin' : '👤 Team Member'}
                {network.allow_anytime_access && ' • Access Anytime'}
              </Text>

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

              {!activeEntry && (
                <TouchableOpacity
                  style={[styles.clockButton, styles.clockInButton]}
                  onPress={() => handleClockIn(network.location_id)}
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
};

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  container: {
    padding: 16,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
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
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
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

export default ClockInScreen;