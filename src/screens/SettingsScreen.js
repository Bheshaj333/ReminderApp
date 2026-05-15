import React from 'react';
import { View, Text, StyleSheet, ScrollView, Switch, Pressable, StatusBar } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { Colors, Radii, Shadows } from '../utils/theme';
import { useApp } from '../store/AppContext';
import { cancelAllReminders } from '../utils/notifications';

const SECTIONS = [
  {
    title: 'Behavior',
    items: [
      { key: 'escalationEnabled', label: 'Escalating intensity', desc: 'Gets louder and more urgent if ignored', icon: 'trending-up' },
      { key: 'untilDoneEnabled', label: '"Until done" mode', desc: 'Asks if you actually completed the task', icon: 'check-circle' },
      { key: 'soundEnabled', label: 'Sound', desc: 'Play sound with notifications', icon: 'volume-2' },
      { key: 'hapticsEnabled', label: 'Haptics', desc: 'Vibration feedback', icon: 'smartphone' },
    ],
  },
];

export default function SettingsScreen({ navigation }) {
  const { state, updateSettings } = useApp();
  const { settings } = state;

  const toggle = (key) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    updateSettings({ [key]: !settings[key] });
  };

  const clearAll = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    await cancelAllReminders();
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
        {SECTIONS.map((section, si) => (
          <Animated.View key={section.title} entering={FadeInDown.delay(si * 80).duration(400)}>
            <Text style={styles.sectionLabel}>{section.title}</Text>
            <View style={[styles.card, Shadows.sm]}>
              {section.items.map((item, ii) => (
                <View
                  key={item.key}
                  style={[
                    styles.row,
                    ii < section.items.length - 1 && styles.rowBorder,
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
        ))}

        {/* About Card */}
        <Animated.View entering={FadeInDown.delay(200).duration(400)}>
          <Text style={styles.sectionLabel}>About</Text>
          <View style={[styles.card, Shadows.sm]}>
            <View style={styles.aboutRow}>
              <Text style={styles.wordmark}>inter<Text style={{ color: Colors.seafoam }}>rupt</Text></Text>
              <Text style={styles.version}>v1.0.0</Text>
            </View>
            <Text style={styles.aboutText}>
              You are not using a reminder app. You are using an interruption system optimized for human attention and compliance.
            </Text>
          </View>
        </Animated.View>

        {/* Danger Zone */}
        <Animated.View entering={FadeInDown.delay(280).duration(400)}>
          <Text style={styles.sectionLabel}>Danger zone</Text>
          <View style={[styles.card, Shadows.sm]}>
            <Pressable style={styles.dangerRow} onPress={clearAll}>
              <Feather name="bell-off" size={15} color={Colors.coralDeep} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={[styles.rowLabel, { color: Colors.coralDeep }]}>Cancel all reminders</Text>
                <Text style={styles.rowDesc}>Removes all scheduled notifications</Text>
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
  content: { paddingHorizontal: 20 },
  sectionLabel: {
    fontSize: 10, letterSpacing: 0.8, textTransform: 'uppercase',
    color: Colors.soft, marginBottom: 10, marginTop: 16,
  },
  card: {
    backgroundColor: Colors.white, borderRadius: Radii.lg,
    borderWidth: 0.5, borderColor: Colors.border, overflow: 'hidden',
  },
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
  rowLabel: { fontSize: 14, color: Colors.ink, fontWeight: '400' },
  rowDesc: { fontSize: 12, color: Colors.soft, marginTop: 2 },
  aboutRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', padding: 16, borderBottomWidth: 0.5, borderBottomColor: Colors.borderLight },
  wordmark: { fontFamily: 'Georgia', fontSize: 20, fontWeight: '600', color: Colors.deeper },
  version: { fontSize: 12, color: Colors.soft },
  aboutText: { padding: 16, fontSize: 13, color: Colors.mid, lineHeight: 20, fontStyle: 'italic', fontFamily: 'Georgia' },
  dangerRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
  },
});
