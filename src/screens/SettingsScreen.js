import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Switch, Pressable, StatusBar, Platform, Alert } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { Colors, Radii, Shadows } from '../utils/theme';
import { useApp } from '../store/AppContext';
import { cancelAllReminders } from '../utils/notifications';
import {
  canScheduleExactAlarms,
  requestExactAlarmPermission,
  isIgnoringBatteryOptimizations,
  requestIgnoreBatteryOptimizations,
  scheduleNativeAlarm,
  isNativeAlarmSupported,
} from '../utils/nativeAlarm';

const BEHAVIOR_ITEMS = [
  { key: 'escalationEnabled', label: 'Escalating intensity', desc: 'Gets louder and more urgent if ignored', icon: 'trending-up' },
  { key: 'untilDoneEnabled', label: '"Until done" mode', desc: 'Asks if you actually completed the task', icon: 'check-circle' },
  { key: 'soundEnabled', label: 'Sound', desc: 'Play sound with notifications', icon: 'volume-2' },
  { key: 'hapticsEnabled', label: 'Haptics', desc: 'Vibration feedback', icon: 'smartphone' },
];

export default function SettingsScreen({ navigation }) {
  const { state, updateSettings } = useApp();
  const { settings } = state;

  const [exactAlarmAllowed, setExactAlarmAllowed] = useState(true);
  const [ignoringBattery, setIgnoringBattery] = useState(true);
  const [testScheduled, setTestScheduled] = useState(false);

  useEffect(() => {
    async function checkPerms() {
      if (isNativeAlarmSupported) {
        const exact = await canScheduleExactAlarms();
        setExactAlarmAllowed(exact);
        const ignoring = await isIgnoringBatteryOptimizations();
        setIgnoringBattery(ignoring);
      }
    }
    checkPerms();
  }, []);

  const toggle = (key) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    updateSettings({ [key]: !settings[key] });
  };

  const clearAll = async () => {
    Alert.alert(
      'Cancel All Reminders',
      'Are you sure you want to cancel all active reminders and alarms?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel All',
          style: 'destructive',
          onPress: async () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            await cancelAllReminders();
          },
        },
      ]
    );
  };

  const handleTestAlarm = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setTestScheduled(true);

    const testId = 'test_alarm_' + Date.now();
    await scheduleNativeAlarm({
      id: testId,
      text: 'Attention: This is a test spoken reminder. Your alarm system is working perfectly.',
      scheduledTime: Date.now() + 5000,
      repeatType: 'once',
      repeatCount: 1,
      burstInterval: 1,
      voiceStyle: settings.voiceStyle || 'default',
      escalation: true,
      active: true,
    });

    Alert.alert(
      'Test Alarm Scheduled (5s)',
      'You can now lock your screen or exit the app. In 5 seconds, the phone will automatically trigger the alarm and speak the reminder text.',
      [{ text: 'Got it' }]
    );

    setTimeout(() => setTestScheduled(false), 7000);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.nav}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Feather name="arrow-left" size={18} color={Colors.mid} />
        </Pressable>
        <Text style={styles.navTitle}>Settings</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Test Spoken Alarm Banner */}
        <Animated.View entering={FadeInDown.delay(50).duration(400)}>
          <View style={[styles.testCard, Shadows.sm]}>
            <View style={styles.testCardHeader}>
              <View style={styles.testIconWrap}>
                <Feather name="volume-2" size={18} color={Colors.seafoam} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.testTitle}>Test Native Alarm & TTS</Text>
                <Text style={styles.testDesc}>Trigger an alarm in 5 seconds to test background speech with screen locked</Text>
              </View>
            </View>
            <Pressable
              onPress={handleTestAlarm}
              disabled={testScheduled}
              style={[styles.testBtn, testScheduled && styles.testBtnActive]}
            >
              <Feather name={testScheduled ? 'clock' : 'play'} size={14} color={Colors.white} />
              <Text style={styles.testBtnText}>{testScheduled ? 'Alarm Armed (5s)...' : 'Test Spoken Alarm (5s)'}</Text>
            </Pressable>
          </View>
        </Animated.View>

        {/* Android Exact Alarm & Battery Permissions */}
        {Platform.OS === 'android' && (
          <Animated.View entering={FadeInDown.delay(100).duration(400)}>
            <Text style={styles.sectionLabel}>Alarm Reliability & Permissions</Text>
            <View style={[styles.card, Shadows.sm]}>
              {/* Exact Alarms */}
              <View style={[styles.row, styles.rowBorder]}>
                <View style={styles.rowIco}>
                  <Feather name="clock" size={15} color={exactAlarmAllowed ? Colors.seafoam : Colors.coralDeep} />
                </View>
                <View style={styles.rowInfo}>
                  <Text style={styles.rowLabel}>Exact Alarms (Android 12+)</Text>
                  <Text style={styles.rowDesc}>
                    {exactAlarmAllowed ? 'Granted · Alarms fire to the exact second' : 'Permission required for exact second triggers'}
                  </Text>
                </View>
                {!exactAlarmAllowed ? (
                  <Pressable
                    onPress={async () => {
                      await requestExactAlarmPermission();
                      const status = await canScheduleExactAlarms();
                      setExactAlarmAllowed(status);
                    }}
                    style={styles.actionBtn}
                  >
                    <Text style={styles.actionBtnText}>Grant</Text>
                  </Pressable>
                ) : (
                  <Feather name="check" size={18} color={Colors.seafoam} />
                )}
              </View>

              {/* Battery Optimization */}
              <View style={styles.row}>
                <View style={styles.rowIco}>
                  <Feather name="zap" size={15} color={ignoringBattery ? Colors.seafoam : Colors.warning} />
                </View>
                <View style={styles.rowInfo}>
                  <Text style={styles.rowLabel}>Battery Optimization Exemption</Text>
                  <Text style={styles.rowDesc}>
                    {ignoringBattery ? 'Exempted · Background execution protected from Doze' : 'Prevent Android from killing alarms in deep sleep'}
                  </Text>
                </View>
                {!ignoringBattery ? (
                  <Pressable
                    onPress={async () => {
                      await requestIgnoreBatteryOptimizations();
                      const status = await isIgnoringBatteryOptimizations();
                      setIgnoringBattery(status);
                    }}
                    style={[styles.actionBtn, { backgroundColor: Colors.warning }]}
                  >
                    <Text style={styles.actionBtnText}>Exempt</Text>
                  </Pressable>
                ) : (
                  <Feather name="check" size={18} color={Colors.seafoam} />
                )}
              </View>
            </View>
          </Animated.View>
        )}

        {/* Behavior */}
        <Animated.View entering={FadeInDown.delay(150).duration(400)}>
          <Text style={styles.sectionLabel}>Behavior</Text>
          <View style={[styles.card, Shadows.sm]}>
            {BEHAVIOR_ITEMS.map((item, ii) => (
              <View
                key={item.key}
                style={[
                  styles.row,
                  ii < BEHAVIOR_ITEMS.length - 1 && styles.rowBorder,
                ]}
              >
                <View style={styles.rowIco}>
                  <Feather name={item.icon} size={15} color={Colors.seafoam} />
                </View>
                <View style={styles.rowInfo}>
                  <Text style={styles.rowLabel}>{item.label}</Text>
                  <Text style={styles.rowDesc}>{item.desc}</Text>
                </View>
                <Switch
                  value={!!settings[item.key]}
                  onValueChange={() => toggle(item.key)}
                  trackColor={{ false: Colors.sea2, true: Colors.sea3 }}
                  thumbColor={settings[item.key] ? Colors.seafoam : Colors.soft}
                  ios_backgroundColor={Colors.sea2}
                  style={{ transform: [{ scaleX: 0.85 }, { scaleY: 0.85 }] }}
                />
              </View>
            ))}
          </View>
        </Animated.View>

        {/* About Card */}
        <Animated.View entering={FadeInDown.delay(200).duration(400)}>
          <Text style={styles.sectionLabel}>About</Text>
          <View style={[styles.card, Shadows.sm]}>
            <View style={styles.aboutRow}>
              <Text style={styles.wordmark}>inter<Text style={{ color: Colors.seafoam }}>rupt</Text></Text>
              <Text style={styles.version}>v1.0.0 (Native Alarm Engine)</Text>
            </View>
            <Text style={styles.aboutText}>
              Configured with Android exact AlarmManager and native Text-To-Speech engine. Reminders trigger reliably even when the device is locked or the app is terminated.
            </Text>
          </View>
        </Animated.View>

        {/* Danger Zone */}
        <Animated.View entering={FadeInDown.delay(250).duration(400)}>
          <Text style={styles.sectionLabel}>Danger zone</Text>
          <View style={[styles.card, Shadows.sm]}>
            <Pressable style={styles.dangerRow} onPress={clearAll}>
              <Feather name="bell-off" size={15} color={Colors.coralDeep} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={[styles.rowLabel, { color: Colors.coralDeep }]}>Cancel all reminders</Text>
                <Text style={styles.rowDesc}>Removes all scheduled alarms and notifications</Text>
              </View>
              <Feather name="chevron-right" size={14} color={Colors.coral} />
            </Pressable>
          </View>
        </Animated.View>

        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.mist },
  nav: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: Colors.white, borderWidth: 0.5, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  navTitle: { fontFamily: 'Georgia', fontSize: 18, color: Colors.deeper },
  content: { paddingHorizontal: 20, paddingTop: 6 },
  sectionLabel: {
    fontSize: 10, letterSpacing: 0.8, textTransform: 'uppercase',
    color: Colors.soft, marginBottom: 10, marginTop: 16,
  },
  card: {
    backgroundColor: Colors.white, borderRadius: Radii.lg,
    borderWidth: 0.5, borderColor: Colors.border, overflow: 'hidden',
  },
  testCard: {
    backgroundColor: Colors.white, borderRadius: Radii.lg,
    padding: 16, borderWidth: 0.5, borderColor: Colors.sea3,
    marginBottom: 8,
  },
  testCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  testIconWrap: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: Colors.sea, alignItems: 'center', justifyContent: 'center',
  },
  testTitle: { fontSize: 15, fontWeight: '600', color: Colors.deeper },
  testDesc: { fontSize: 12, color: Colors.mid, marginTop: 2, lineHeight: 16 },
  testBtn: {
    backgroundColor: Colors.seafoam, borderRadius: Radii.md,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 11,
  },
  testBtnActive: { backgroundColor: Colors.deep },
  testBtnText: { color: Colors.white, fontSize: 13, fontWeight: '600', letterSpacing: 0.3 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 14,
  },
  rowBorder: { borderBottomWidth: 0.5, borderBottomColor: Colors.borderLight },
  rowIco: {
    width: 32, height: 32, borderRadius: Radii.sm,
    backgroundColor: Colors.sea, alignItems: 'center', justifyContent: 'center',
  },
  rowInfo: { flex: 1 },
  rowLabel: { fontSize: 14, color: Colors.ink, fontWeight: '500' },
  rowDesc: { fontSize: 12, color: Colors.soft, marginTop: 2 },
  actionBtn: {
    backgroundColor: Colors.seafoam, borderRadius: Radii.sm,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  actionBtnText: { color: Colors.white, fontSize: 12, fontWeight: '600' },
  aboutRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', padding: 16, borderBottomWidth: 0.5, borderBottomColor: Colors.borderLight },
  wordmark: { fontFamily: 'Georgia', fontSize: 20, fontWeight: '600', color: Colors.deeper },
  version: { fontSize: 12, color: Colors.soft },
  aboutText: { padding: 16, fontSize: 13, color: Colors.mid, lineHeight: 20, fontStyle: 'italic', fontFamily: 'Georgia' },
  dangerRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
  },
});
