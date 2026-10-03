import React, { useMemo, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, StatusBar } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { Colors, Radii, Shadows } from '../utils/theme';
import { useApp } from '../store/AppContext';
import { nextOccurrence } from '../utils/schedule';
import ReminderCard from '../components/ReminderCard';

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'on', label: 'On' },
  { id: 'paused', label: 'Paused' },
];

export default function RemindersScreen({ navigation }) {
  const { state, setReminderActive } = useApp();
  const { reminders } = state;
  const [filter, setFilter] = useState('all');

  const sorted = useMemo(() => {
    const now = Date.now();
    const key = r => (r.active ? nextOccurrence(r, now) ?? Infinity : Infinity);
    return [...reminders].sort((a, b) => (b.active - a.active) || (key(a) - key(b)) || ((b.createdAt || 0) - (a.createdAt || 0)));
  }, [reminders]);

  const visible = sorted.filter(r => filter === 'all' || (filter === 'on' ? r.active : !r.active));
  const onCount = reminders.filter(r => r.active).length;

  const openEdit = useCallback((reminder) => navigation.navigate('ReminderEdit', { reminder }), [navigation]);

  const onToggle = useCallback((reminder, value) => {
    // A one-time reminder whose time has passed needs a new time before it can ring
    if (value && reminder.repeatType === 'once' && (reminder.scheduledTime || 0) <= Date.now()) {
      navigation.navigate('ReminderEdit', { reminder, needsNewTime: true });
      return;
    }
    setReminderActive(reminder.id, value);
  }, [navigation, setReminderActive]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.mist} />

      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Reminders</Text>
          <Text style={styles.subtitle}>{reminders.length} total · {onCount} on</Text>
        </View>
        <Pressable
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); navigation.navigate('ReminderEdit'); }}
          style={({ pressed }) => [styles.addBtn, Shadows.md, pressed && { transform: [{ scale: 0.94 }] }]}
        >
          <Feather name="plus" size={22} color={Colors.white} />
        </Pressable>
      </View>

      {reminders.length > 0 && (
        <View style={styles.filters}>
          {FILTERS.map(f => {
            const sel = filter === f.id;
            return (
              <Pressable
                key={f.id}
                onPress={() => { Haptics.selectionAsync(); setFilter(f.id); }}
                style={[styles.filter, sel && styles.filterSel]}
              >
                <Text style={[styles.filterText, sel && styles.filterTextSel]}>{f.label}</Text>
              </Pressable>
            );
          })}
        </View>
      )}

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {reminders.length === 0 ? (
          <Animated.View entering={FadeIn.duration(300)} style={styles.empty}>
            <View style={styles.emptyIcon}><Feather name="bell" size={28} color={Colors.seafoamDeep} /></View>
            <Text style={styles.emptyTitle}>No reminders yet</Text>
            <Text style={styles.emptyText}>Medicine, birthdays, bills, anything.{'\n'}It will be read out loud on time.</Text>
            <Pressable onPress={() => navigation.navigate('ReminderEdit')} style={styles.emptyBtn}>
              <Feather name="plus" size={16} color={Colors.white} />
              <Text style={styles.emptyBtnText}>Create reminder</Text>
            </Pressable>
          </Animated.View>
        ) : visible.length === 0 ? (
          <Text style={styles.none}>Nothing here.</Text>
        ) : (
          visible.map(r => (
            <ReminderCard key={r.id} reminder={r} onToggle={onToggle} onPress={openEdit} />
          ))
        )}
        <View style={{ height: 120 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.mist },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 12, paddingBottom: 14,
  },
  title: { fontFamily: 'Georgia', fontSize: 28, fontWeight: '600', color: Colors.deeper },
  subtitle: { fontSize: 13, color: Colors.mid, marginTop: 2 },
  addBtn: {
    width: 50, height: 50, borderRadius: 18,
    backgroundColor: Colors.deep, alignItems: 'center', justifyContent: 'center',
  },
  filters: {
    flexDirection: 'row', marginHorizontal: 20, marginBottom: 14, padding: 4,
    backgroundColor: Colors.sea, borderRadius: Radii.full,
  },
  filter: { flex: 1, height: 36, borderRadius: Radii.full, alignItems: 'center', justifyContent: 'center' },
  filterSel: { backgroundColor: Colors.white, ...Shadows.sm },
  filterText: { fontSize: 13, color: Colors.mid, fontWeight: '600' },
  filterTextSel: { color: Colors.deeper },
  content: { paddingHorizontal: 20 },
  none: { textAlign: 'center', color: Colors.soft, marginTop: 40, fontSize: 14 },
  empty: { alignItems: 'center', paddingTop: 70, paddingHorizontal: 20 },
  emptyIcon: {
    width: 76, height: 76, borderRadius: 26, backgroundColor: Colors.sea,
    alignItems: 'center', justifyContent: 'center', marginBottom: 18,
  },
  emptyTitle: { fontFamily: 'Georgia', fontSize: 22, color: Colors.deeper, marginBottom: 8 },
  emptyText: { fontSize: 14, color: Colors.mid, textAlign: 'center', lineHeight: 21 },
  emptyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 24,
    backgroundColor: Colors.deep, height: 48, paddingHorizontal: 22, borderRadius: Radii.full,
  },
  emptyBtnText: { color: Colors.white, fontSize: 15, fontWeight: '600' },
});
