import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Switch, Pressable, StatusBar, Alert } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { Colors, Radii, Shadows } from '../utils/theme';
import { useApp } from '../store/AppContext';
import Logo from '../components/Logo';
import { scheduleNativeAlarm, isNativeAlarmSupported } from '../utils/nativeAlarm';
import { PERMISSIONS, usePermissions } from '../utils/permissions';

const SNOOZE_OPTIONS = [5, 10, 15, 30];

export default function SettingsScreen() {
  const { state, updateSettings, pauseAll } = useApp();
  const { settings, reminders } = state;
  const { perms: livePerms, missing: missingList, refresh } = usePermissions();
  const perms = livePerms || {};
  const [testing, setTesting] = useState(false);
  const missing = missingList.length;

  const testAlarm = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setTesting(true);
    await scheduleNativeAlarm({
      id: 'test_alarm_' + Date.now(),
      text: 'This is a test reminder. Your alarms are working.',
      category: 'general',
      scheduledTime: Date.now() + 10 * 1000,
      repeatType: 'once',
      repeatCount: 0,
      burstInterval: 0,
      active: true,
    });
    Alert.alert('Test in 10 seconds', 'Lock your phone or leave the app. It will ring and speak in 10 seconds.');
    setTimeout(() => setTesting(false), 11 * 1000);
  };

  const confirmPauseAll = () => {
    Alert.alert('Pause all reminders?', 'Nothing will ring until you turn reminders back on.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Pause all', style: 'destructive',
        onPress: async () => { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning); await pauseAll(); },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.mist} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Animated.View entering={FadeIn.duration(300)}>
          <Text style={styles.title}>Settings</Text>
        </Animated.View>

        {PERMISSIONS.length > 0 && (
          <>
            <View style={styles.sectionRow}>
              <Text style={styles.section}>Reliability</Text>
              <Text style={[styles.status, missing ? styles.statusWarn : styles.statusOk]}>
                {missing ? `${missing} need${missing === 1 ? 's' : ''} attention` : 'All set'}
              </Text>
            </View>
            <View style={[styles.card, Shadows.sm]}>
              {PERMISSIONS.map((p, i) => {
                const ok = perms[p.key] !== false;
                return (
                  <View key={p.key} style={[styles.row, i > 0 && styles.border]}>
                    <View style={[styles.rowIco, !ok && styles.rowIcoWarn]}>
                      <Feather name={p.icon} size={16} color={ok ? Colors.deep : Colors.coralDeep} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rowTitle}>{p.title}</Text>
                      <Text style={styles.rowDesc}>{ok ? p.ok : p.need}</Text>
                    </View>
                    {ok ? (
                      <View style={styles.check}><Feather name="check" size={14} color={Colors.white} /></View>
                    ) : (
                      <Pressable onPress={async () => { await p.request(); refresh(); }} style={styles.allow} hitSlop={6}>
                        <Text style={styles.allowText}>Allow</Text>
                      </Pressable>
                    )}
                  </View>
                );
              })}
            </View>
          </>
        )}

        <Text style={styles.section}>When it rings</Text>
        <View style={[styles.card, Shadows.sm]}>
          <View style={styles.rowCol}>
            <Text style={styles.rowTitle}>Snooze length</Text>
            <View style={styles.segment}>
              {SNOOZE_OPTIONS.map(m => {
                const sel = (settings.snoozeMinutes || 5) === m;
                return (
                  <Pressable key={m} onPress={() => { Haptics.selectionAsync(); updateSettings({ snoozeMinutes: m }); }} style={[styles.seg, sel && styles.segSel]}>
                    <Text style={[styles.segText, sel && styles.segTextSel]}>{m} min</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
          <View style={[styles.row, styles.border]}>
            <View style={styles.rowIco}><Feather name="smartphone" size={16} color={Colors.deep} /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>Vibrate</Text>
              <Text style={styles.rowDesc}>Vibrate while the reminder is speaking</Text>
            </View>
            <Switch
              value={settings.vibrate !== false}
              onValueChange={v => { Haptics.selectionAsync(); updateSettings({ vibrate: v }); }}
              trackColor={{ false: Colors.sea2, true: Colors.seafoam }}
              thumbColor={Colors.white}
            />
          </View>
          {isNativeAlarmSupported && (
            <Pressable onPress={testAlarm} disabled={testing} style={({ pressed }) => [styles.row, styles.border, pressed && { backgroundColor: Colors.sea }]}>
              <View style={styles.rowIco}><Feather name="volume-2" size={16} color={Colors.deep} /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{testing ? 'Test scheduled…' : 'Test alarm'}</Text>
                <Text style={styles.rowDesc}>Rings and speaks in 10 seconds</Text>
              </View>
              <Feather name="chevron-right" size={18} color={Colors.soft} />
            </Pressable>
          )}
        </View>

        <Text style={styles.section}>Reminders</Text>
        <View style={[styles.card, Shadows.sm]}>
          <Pressable
            onPress={confirmPauseAll}
            disabled={!reminders.some(r => r.active)}
            style={({ pressed }) => [styles.row, pressed && { backgroundColor: '#FDF1ED' }, !reminders.some(r => r.active) && { opacity: 0.45 }]}
          >
            <View style={[styles.rowIco, styles.rowIcoWarn]}><Feather name="pause" size={16} color={Colors.coralDeep} /></View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowTitle, { color: Colors.coralDeep }]}>Pause all reminders</Text>
              <Text style={styles.rowDesc}>Stops everything from ringing</Text>
            </View>
          </Pressable>
        </View>

        <View style={styles.about}>
          <Logo size={64} tile />
          <Text style={styles.aboutName}>ReminderApp</Text>
          <Text style={styles.aboutText}>Reminders that speak to you. v1.0.0</Text>
        </View>
        <View style={{ height: 120 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.mist },
  content: { paddingHorizontal: 20, paddingTop: 12 },
  title: { fontFamily: 'Georgia', fontSize: 28, fontWeight: '600', color: Colors.deeper, marginBottom: 6 },
  sectionRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  section: { fontSize: 12, letterSpacing: 1.5, textTransform: 'uppercase', color: Colors.mid, fontWeight: '700', marginTop: 22, marginBottom: 10 },
  status: { fontSize: 12, fontWeight: '700' },
  statusOk: { color: Colors.seafoamDeep },
  statusWarn: { color: Colors.coralDeep },
  card: { backgroundColor: Colors.white, borderRadius: 20, borderWidth: 1, borderColor: Colors.borderLight, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 14 },
  rowCol: { paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
  border: { borderTopWidth: 1, borderTopColor: Colors.borderLight },
  rowIco: { width: 36, height: 36, borderRadius: 12, backgroundColor: Colors.sea, alignItems: 'center', justifyContent: 'center' },
  rowIcoWarn: { backgroundColor: '#FDEDE8' },
  rowTitle: { fontSize: 15, fontWeight: '600', color: Colors.ink },
  rowDesc: { fontSize: 12, color: Colors.soft, marginTop: 2 },
  check: { width: 24, height: 24, borderRadius: 12, backgroundColor: Colors.seafoam, alignItems: 'center', justifyContent: 'center' },
  allow: { height: 34, paddingHorizontal: 16, borderRadius: Radii.full, backgroundColor: Colors.deep, justifyContent: 'center' },
  allowText: { color: Colors.white, fontSize: 13, fontWeight: '700' },
  segment: { flexDirection: 'row', padding: 4, backgroundColor: Colors.sea, borderRadius: Radii.full },
  seg: { flex: 1, height: 36, borderRadius: Radii.full, alignItems: 'center', justifyContent: 'center' },
  segSel: { backgroundColor: Colors.white, ...Shadows.sm },
  segText: { fontSize: 13, color: Colors.mid, fontWeight: '600' },
  segTextSel: { color: Colors.deeper },
  about: { alignItems: 'center', marginTop: 36, gap: 6 },
  aboutName: { fontFamily: 'Georgia', fontSize: 18, fontWeight: '600', color: Colors.deeper, marginTop: 8 },
  aboutText: { fontSize: 12, color: Colors.soft },
});
