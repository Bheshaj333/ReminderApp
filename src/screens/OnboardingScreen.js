import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, StatusBar } from 'react-native';
import Animated, { FadeIn, FadeInDown, ZoomIn } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import Logo from '../components/Logo';
import { PERMISSIONS, usePermissions } from '../utils/permissions';
import { useApp } from '../store/AppContext';

/** First-launch setup: walk through every permission the alarms need. */
export default function OnboardingScreen() {
  const { updateSettings } = useApp();
  const { perms, missing, refresh } = usePermissions();
  const done = perms ? PERMISSIONS.length - missing.length : 0;
  const allSet = perms && missing.length === 0;

  const allow = async (p) => {
    Haptics.selectionAsync();
    await p.request();
    refresh();
  };

  const finish = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    updateSettings({ onboarded: true });
  };

  return (
    <LinearGradient colors={['#061614', '#0B2421', '#1A4A40']} style={styles.fill}>
      <StatusBar barStyle="light-content" backgroundColor="#061614" />
      <SafeAreaView style={styles.fill} edges={['top', 'bottom']}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Animated.View entering={ZoomIn.duration(600).springify()} style={styles.logo}>
            <Logo size={92} tile />
          </Animated.View>
          <Animated.Text entering={FadeInDown.delay(120).duration(500)} style={styles.title}>
            Never miss a reminder
          </Animated.Text>
          <Animated.Text entering={FadeInDown.delay(180).duration(500)} style={styles.subtitle}>
            Android needs a few permissions so your reminders can ring on time and speak, even when the phone is locked.
          </Animated.Text>

          <Animated.View entering={FadeIn.delay(240).duration(400)} style={styles.progressRow}>
            <View style={styles.track}>
              <View style={[styles.fillBar, { width: `${(done / PERMISSIONS.length) * 100}%` }]} />
            </View>
            <Text style={styles.progressText}>{done} of {PERMISSIONS.length}</Text>
          </Animated.View>

          {PERMISSIONS.map((p, i) => {
            const ok = perms?.[p.key] === true;
            return (
              <Animated.View key={p.key} entering={FadeInDown.delay(280 + i * 70).duration(450)} style={[styles.card, ok && styles.cardOk]}>
                <View style={[styles.icon, ok && styles.iconOk]}>
                  <Feather name={ok ? 'check' : p.icon} size={18} color={ok ? '#0B2421' : '#A8F0DC'} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>{p.title}</Text>
                  <Text style={styles.cardWhy}>{p.why}</Text>
                </View>
                {ok ? (
                  <Text style={styles.okText}>Done</Text>
                ) : (
                  <Pressable onPress={() => allow(p)} style={({ pressed }) => [styles.allow, pressed && { transform: [{ scale: 0.95 }] }]}>
                    <Text style={styles.allowText}>Allow</Text>
                  </Pressable>
                )}
              </Animated.View>
            );
          })}
        </ScrollView>

        <View style={styles.footer}>
          <Pressable onPress={finish} style={({ pressed }) => [styles.cta, !allSet && styles.ctaGhost, pressed && { transform: [{ scale: 0.97 }] }]}>
            <Text style={[styles.ctaText, !allSet && styles.ctaTextGhost]}>
              {allSet ? 'Start using the app' : 'Skip for now'}
            </Text>
          </Pressable>
          {!allSet && <Text style={styles.footNote}>You can finish this anytime in Settings.</Text>}
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { paddingHorizontal: 22, paddingTop: 28, paddingBottom: 20 },
  logo: { alignSelf: 'center', marginBottom: 22 },
  title: { fontFamily: 'Georgia', fontSize: 30, color: '#fff', textAlign: 'center', fontWeight: '600' },
  subtitle: { fontSize: 15, lineHeight: 22, color: 'rgba(255,255,255,0.7)', textAlign: 'center', marginTop: 10 },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 26, marginBottom: 14 },
  track: { flex: 1, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.12)', overflow: 'hidden' },
  fillBar: { height: 6, borderRadius: 3, backgroundColor: '#78E8C8' },
  progressText: { color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: '600' },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, marginBottom: 10, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
  },
  cardOk: { backgroundColor: 'rgba(120,232,200,0.08)', borderColor: 'rgba(120,232,200,0.35)' },
  icon: { width: 40, height: 40, borderRadius: 14, backgroundColor: 'rgba(168,240,220,0.12)', alignItems: 'center', justifyContent: 'center' },
  iconOk: { backgroundColor: '#78E8C8' },
  cardTitle: { color: '#fff', fontSize: 15, fontWeight: '700' },
  cardWhy: { color: 'rgba(255,255,255,0.6)', fontSize: 12, lineHeight: 17, marginTop: 2 },
  okText: { color: '#78E8C8', fontSize: 13, fontWeight: '700' },
  allow: { height: 36, paddingHorizontal: 18, borderRadius: 999, backgroundColor: '#A8F0DC', justifyContent: 'center' },
  allowText: { color: '#0B2421', fontSize: 13, fontWeight: '800' },
  footer: { paddingHorizontal: 22, paddingTop: 8, paddingBottom: 14 },
  cta: { height: 58, borderRadius: 999, backgroundColor: '#F7F2E8', alignItems: 'center', justifyContent: 'center' },
  ctaGhost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)' },
  ctaText: { color: '#0B2421', fontSize: 17, fontWeight: '700' },
  ctaTextGhost: { color: 'rgba(255,255,255,0.85)', fontSize: 15, fontWeight: '600' },
  footNote: { color: 'rgba(255,255,255,0.45)', fontSize: 12, textAlign: 'center', marginTop: 10 },
});
