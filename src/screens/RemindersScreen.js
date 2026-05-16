import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  Pressable, StatusBar,
} from 'react-native';
import Animated, {
  FadeInDown, FadeIn, useSharedValue, useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { Colors, Radii, Shadows } from '../utils/theme';
import { useApp } from '../store/AppContext';
import ReminderCard from '../components/ReminderCard';
import FullscreenReminder from '../components/FullscreenReminder';

const MODES = ['Focus', 'Health', 'Study', 'Sleep', 'Gym'];
const MODE_COLORS = {
  Focus: Colors.seafoam, Health: Colors.coral, Study: Colors.petalDeep,
  Sleep: Colors.deep, Gym: Colors.jasmineDark,
};

const defaultForm = () => ({
  text: '',
  repeatType: 'daily', // once | daily | weekend | custom
  repeatInterval: 1, 
  repeatUnit: 'hours', // minutes | hours | days
  repeatCount: 1, 
  burstInterval: 1, 
  mode: 'Focus',
  escalation: true,
  untilDone: true,
  scheduledTime: Date.now(),
  active: true,
});

export default function RemindersScreen({ navigation }) {
  const { state, deleteReminder, toggleReminder } = useApp();
  const { reminders } = state;

  const [fsReminder, setFsReminder] = useState(null);

  const fabScale = useSharedValue(1);
  const fabStyle = useAnimatedStyle(() => ({ transform: [{ scale: fabScale.value }] }));

  const openAdd = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate('ReminderEdit');
  };

  const openEdit = (reminder) => {
    navigation.navigate('ReminderEdit', { reminder });
  };

  const handleDelete = async (id) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await deleteReminder(id);
  };

  const activeReminders = reminders.filter(r => r.active);
  const inactiveReminders = reminders.filter(r => !r.active);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="dark-content" />

      <Animated.View entering={FadeIn.duration(300)} style={styles.headerRow}>
        <View>
          <Text style={styles.pageTitle}>Reminders</Text>
          <Text style={styles.pageCount}>{reminders.length} total · {activeReminders.length} active</Text>
        </View>
        <Animated.View style={fabStyle}>
          <Pressable
            onPress={openAdd}
            onPressIn={() => { fabScale.value = withSpring(0.9); }}
            onPressOut={() => { fabScale.value = withSpring(1); }}
            style={styles.fab}
          >
            <Feather name="plus" size={20} color={Colors.white} />
          </Pressable>
        </Animated.View>
      </Animated.View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {reminders.length === 0 ? (
          <Animated.View entering={FadeIn.delay(200)} style={styles.empty}>
            <Text style={styles.emptyEmoji}>🔔</Text>
            <Text style={styles.emptyTitle}>No reminders yet</Text>
            <Text style={styles.emptyText}>Tap + to add your first reminder</Text>
          </Animated.View>
        ) : (
          <>
            {activeReminders.length > 0 && (
              <Animated.View entering={FadeInDown.delay(100)}>
                <Text style={styles.section}>Active</Text>
                {activeReminders.map((r, i) => (
                  <Animated.View key={r.id} entering={FadeInDown.delay(i * 50).duration(300)}>
                    <ReminderCard
                      reminder={r}
                      onToggle={toggleReminder}
                      onDelete={handleDelete}
                      onEdit={openEdit}
                      onTap={(r) => setFsReminder(r)}
                    />
                  </Animated.View>
                ))}
              </Animated.View>
            )}
            {inactiveReminders.length > 0 && (
              <Animated.View entering={FadeInDown.delay(200)}>
                <Text style={[styles.section, { marginTop: 10 }]}>Paused</Text>
                {inactiveReminders.map((r, i) => (
                  <Animated.View key={r.id} entering={FadeInDown.delay(i * 50)}>
                    <ReminderCard
                      reminder={r}
                      onToggle={toggleReminder}
                      onDelete={handleDelete}
                      onEdit={openEdit}
                    />
                  </Animated.View>
                ))}
              </Animated.View>
            )}
          </>
        )}
        <View style={{ height: 100 }} />
      </ScrollView>

      <FullscreenReminder
        visible={!!fsReminder}
        reminder={fsReminder}
        onDone={() => setFsReminder(null)}
        onSnooze={() => setFsReminder(null)}
        onIgnore={() => setFsReminder(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.mist },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 8 },
  headerRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12,
  },
  pageTitle: { fontFamily: 'Georgia', fontSize: 26, fontWeight: '600', color: Colors.deeper },
  pageCount: { fontSize: 12, color: Colors.soft, marginTop: 2, letterSpacing: 0.3 },
  fab: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: Colors.seafoam, alignItems: 'center', justifyContent: 'center',
    ...Shadows.md,
  },
  empty: { alignItems: 'center', paddingTop: 80 },
  emptyEmoji: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { fontFamily: 'Georgia', fontSize: 20, color: Colors.deeper, marginBottom: 6 },
  emptyText: { fontSize: 14, color: Colors.soft },
  section: {
    fontSize: 10, letterSpacing: 0.8, textTransform: 'uppercase',
    color: Colors.soft, marginBottom: 10,
  },
});
