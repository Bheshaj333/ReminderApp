import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  Pressable, StatusBar, Keyboard,
} from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring, withTiming,
  withSequence, withRepeat, FadeInDown, FadeIn, SlideInRight,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import uuid from 'react-native-uuid';

import { Colors, Radii, Shadows, Typography, VOICE_PHRASES } from '../utils/theme';
import { useApp } from '../store/AppContext';
import EscalationBar from '../components/EscalationBar';
import PressButton from '../components/PressButton';
import FullscreenReminder from '../components/FullscreenReminder';
import { speak } from '../utils/speech';

const MODES = ['Focus', 'Health', 'Study', 'Sleep', 'Gym'];
const MODE_ICONS = { Focus: 'cpu', Health: 'heart', Study: 'book-open', Sleep: 'moon', Gym: 'zap' };
const MODE_COLORS = {
  Focus: Colors.seafoam, Health: Colors.coral, Study: Colors.petalDeep,
  Sleep: Colors.deep, Gym: Colors.jasmineDark,
};

export default function HomeScreen({ navigation }) {
  const { state, updateSettings, addReminder, dismissReminder, snoozeReminder, ignoreReminder } = useApp();
  const { settings, reminders, activeReminder } = state;

  const [quickText, setQuickText] = useState('');
  const [currentPhrase, setCurrentPhrase] = useState('Drink some water.');
  const [phraseSet, setPhraseSet] = useState('water');
  const [escStep, setEscStep] = useState(2);
  const [showFullscreen, setShowFullscreen] = useState(false);

  const phraseOpacity = useSharedValue(1);
  const liveY = useSharedValue(0);
  const inputRef = useRef(null);

  const displayPhrase = activeReminder?.text || currentPhrase;
  const displayIcon = activeReminder?.icon || phraseSet;

  const phraseKeys = Object.keys(VOICE_PHRASES);
  let phraseIdx = useRef(0);
  let setIdx = useRef(0);

  useEffect(() => {
    const interval = setInterval(() => {
      phraseOpacity.value = withTiming(0, { duration: 300 }, () => {
        phraseIdx.current = (phraseIdx.current + 1) % VOICE_PHRASES[phraseKeys[setIdx.current]].length;
        if (phraseIdx.current === 0) {
          setIdx.current = (setIdx.current + 1) % phraseKeys.length;
        }
        const key = phraseKeys[setIdx.current];
        const phrase = VOICE_PHRASES[key][phraseIdx.current];
        
        // Use runOnJS to update state from the worklet scope if needed, 
        // but here we are just triggering the fade back in
      });

      setTimeout(() => {
        const key = phraseKeys[setIdx.current];
        const phrase = VOICE_PHRASES[key][phraseIdx.current];
        setCurrentPhrase(phrase);
        setPhraseSet(key);
        phraseOpacity.value = withTiming(1, { duration: 400 });
      }, 320);
    }, 5000); // Increased interval to 5s for better UX
    return () => clearInterval(interval);
  }, []);

  // Subtle bounce on active card
  useEffect(() => {
    liveY.value = withRepeat(
      withSequence(
        withTiming(-2, { duration: 2000 }),
        withTiming(0, { duration: 2000 })
      ),
      -1,
      true
    );
  }, []);

  const phraseStyle = useAnimatedStyle(() => ({ opacity: phraseOpacity.value }));
  const liveStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: liveY.value }],
  }));

  const activeCount = reminders.filter(r => r.active).length;

  const handleQuickAdd = () => {
    if (!quickText.trim()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const reminder = {
      id: uuid.v4(),
      text: quickText.trim(),
      active: true,
      repeatType: 'custom',
      repeatInterval: 30,
      repeatUnit: 'minutes',
      repeatCount: 0,
      burstInterval: 0,
      mode: settings.activeMode,
      escalation: settings.escalationEnabled,
      createdAt: Date.now(),
    };
    addReminder(reminder);
    setQuickText('');
    Keyboard.dismiss();
  };

  const handleDone = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setShowFullscreen(false);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.mist} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <Animated.View entering={FadeIn.duration(400)} style={styles.header}>
          <View>
            <Text style={styles.wordmark}>inter<Text style={styles.accent}>rupt</Text></Text>
            <Text style={styles.subtitle}>your attention, redirected</Text>
          </View>
          <Pressable onPress={() => navigation.navigate('Settings')} style={styles.settingsBtn}>
            <Feather name="settings" size={18} color={Colors.mid} />
          </Pressable>
        </Animated.View>

        {/* Live Pill */}
        <Animated.View entering={FadeIn.delay(100).duration(400)} style={styles.liveRow}>
          <View style={styles.livePill}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>{activeCount} active</Text>
          </View>
          <Text style={styles.dateText}>{new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</Text>
        </Animated.View>

        {/* Active Reminder Card */}
        <Animated.View entering={FadeInDown.delay(150).springify()}>
          <Animated.View style={liveStyle}>
            <Pressable onPress={() => setShowFullscreen(true)} style={[styles.mainCard, Shadows.md]}>
              <View style={styles.cardAccent} />
              <View style={styles.cardBody}>
                <Text style={styles.cardEyebrow}>{activeReminder ? 'Attention Required' : 'Right now · escalating'}</Text>
                <Animated.Text style={[styles.cardPhrase, phraseStyle]}>{displayPhrase}</Animated.Text>
                <EscalationBar currentStep={activeReminder ? (activeReminder.burstIndex ?? 0) + 1 : escStep} />
                <View style={styles.actionRow}>
                  <PressButton
                    label="Done"
                    onPress={() => { 
                      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); 
                      if (activeReminder) dismissReminder(activeReminder);
                    }}
                    variant="primary"
                    style={{ flex: 1, backgroundColor: activeReminder ? Colors.deep : Colors.seafoam }}
                  />
                  <PressButton
                    label="Snooze 5m"
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      if (activeReminder) snoozeReminder(activeReminder);
                    }}
                    variant="secondary"
                  />
                  <PressButton
                    label="Ignore"
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      if (activeReminder) ignoreReminder(activeReminder);
                    }}
                    variant="ghost"
                  />
                </View>
              </View>
            </Pressable>
          </Animated.View>
        </Animated.View>

        {/* Quick Add */}
        <Animated.View entering={FadeInDown.delay(250).duration(400)} style={[styles.quickWrap, Shadows.sm]}>
          <Feather name="plus" size={16} color={Colors.soft} style={{ marginLeft: 4 }} />
          <TextInput
            ref={inputRef}
            style={styles.quickInput}
            placeholder="Remind me to…"
            placeholderTextColor={Colors.soft}
            value={quickText}
            onChangeText={setQuickText}
            onSubmitEditing={handleQuickAdd}
            returnKeyType="done"
          />
          <Pressable onPress={handleQuickAdd} style={styles.addBtn}>
            <Text style={styles.addBtnText}>Add</Text>
          </Pressable>
        </Animated.View>

        {/* Mode Chips */}
        <Animated.View entering={FadeInDown.delay(300).duration(400)}>
          <Text style={styles.sectionLabel}>Mode</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.modeScroll}
            contentContainerStyle={styles.modeScrollContent}
          >
            {MODES.map((mode, i) => {
              const active = settings.activeMode === mode;
              const color = MODE_COLORS[mode];
              return (
                <Animated.View key={mode} entering={FadeInDown.delay(300 + i * 40).duration(300)}>
                  <Pressable
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      updateSettings({ activeMode: mode });
                    }}
                    style={[
                      styles.modeChip,
                      active && { backgroundColor: color + '18', borderColor: color },
                    ]}
                  >
                    <Feather name={MODE_ICONS[mode]} size={13} color={active ? color : Colors.soft} />
                    <Text style={[styles.modeText, active && { color, fontWeight: '600' }]}>{mode}</Text>
                  </Pressable>
                </Animated.View>
              );
            })}
          </ScrollView>
        </Animated.View>

        {/* Recent Reminders Preview */}
        {reminders.length > 0 && (
          <Animated.View entering={FadeInDown.delay(350).duration(400)}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionLabel}>Upcoming</Text>
              <Pressable onPress={() => navigation.navigate('Reminders')}>
                <Text style={styles.seeAll}>See all →</Text>
              </Pressable>
            </View>
            {reminders.slice(0, 3).map((r, i) => (
              <Animated.View key={r.id} entering={FadeInDown.delay(i * 60)}>
                <Pressable style={[styles.miniCard, Shadows.sm]}>
                  <View style={[styles.miniAccent, { backgroundColor: (MODE_COLORS[r.mode] || Colors.seafoam) + (r.active ? 'FF' : '40') }]} />
                  <Text style={[styles.miniText, !r.active && { color: Colors.soft }]} numberOfLines={1}>
                    {r.text}
                  </Text>
                  <View style={[styles.miniTag, r.active && styles.miniTagActive]}>
                    <Text style={[styles.miniTagText, r.active && { color: Colors.deep }]}>
                      {r.active ? 'on' : 'off'}
                    </Text>
                  </View>
                </Pressable>
              </Animated.View>
            ))}
          </Animated.View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      <FullscreenReminder
        visible={showFullscreen}
        reminder={{ id: '1', text: currentPhrase, icon: phraseSet }}
        onDone={handleDone}
        onSnooze={() => setShowFullscreen(false)}
        onIgnore={() => setShowFullscreen(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.mist },
  scroll: { flex: 1 },
  content: { padding: 20 },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 20,
    paddingTop: 4,
  },
  wordmark: { fontFamily: 'Georgia', fontSize: 26, fontWeight: '600', color: Colors.deeper },
  accent: { color: Colors.seafoam },
  subtitle: { fontSize: 12, color: Colors.soft, marginTop: 2, letterSpacing: 0.5 },
  settingsBtn: {
    width: 38, height: 38, borderRadius: Radii.full,
    backgroundColor: Colors.white, borderWidth: 0.5, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  liveRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 16,
  },
  livePill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.sea, borderWidth: 0.5, borderColor: Colors.sea3,
    borderRadius: Radii.full, paddingHorizontal: 12, paddingVertical: 5,
  },
  liveDot: {
    width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.seafoam,
  },
  liveText: { fontSize: 12, color: Colors.deep, letterSpacing: 0.3 },
  dateText: { fontSize: 12, color: Colors.soft, letterSpacing: 0.3 },
  mainCard: {
    backgroundColor: Colors.white, borderRadius: Radii.xl,
    flexDirection: 'row', marginBottom: 16,
    borderWidth: 0.5, borderColor: Colors.sea2, overflow: 'hidden',
  },
  cardAccent: { width: 3, backgroundColor: Colors.seafoam },
  cardBody: { flex: 1, padding: 20 },
  cardEyebrow: {
    fontSize: 10, letterSpacing: 0.8, textTransform: 'uppercase',
    color: Colors.soft, marginBottom: 10,
  },
  cardPhrase: {
    fontFamily: 'Georgia', fontSize: 24, fontWeight: '500',
    color: Colors.deeper, marginBottom: 20, lineHeight: 32,
  },
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 18 },
  quickWrap: {
    backgroundColor: Colors.white, borderRadius: Radii.lg,
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 14, paddingVertical: 4,
    borderWidth: 0.5, borderColor: Colors.border, marginBottom: 20,
  },
  quickInput: {
    flex: 1, fontSize: 14, color: Colors.ink,
    paddingVertical: 12, fontWeight: '300',
  },
  addBtn: {
    backgroundColor: Colors.seafoam, borderRadius: Radii.sm,
    paddingHorizontal: 14, paddingVertical: 8,
  },
  addBtnText: { fontSize: 13, color: Colors.white, fontWeight: '500', letterSpacing: 0.3 },
  sectionLabel: {
    fontSize: 10, letterSpacing: 0.8, textTransform: 'uppercase',
    color: Colors.soft, marginBottom: 10,
  },
  modeScroll: { marginBottom: 20 },
  modeScrollContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 4,
    paddingRight: 10,
  },
  modeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.white,
    borderRadius: Radii.full,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadows.sm,
  },
  modeText: { fontSize: 13, color: Colors.mid, letterSpacing: 0.3 },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 10,
  },
  seeAll: { fontSize: 12, color: Colors.seafoam, letterSpacing: 0.3 },
  miniCard: {
    backgroundColor: Colors.white, borderRadius: Radii.md,
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 0.5, borderColor: Colors.border,
    overflow: 'hidden', marginBottom: 8,
  },
  miniAccent: { width: 3, alignSelf: 'stretch' },
  miniText: { flex: 1, fontSize: 14, color: Colors.ink, paddingVertical: 12, paddingHorizontal: 12 },
  miniTag: {
    paddingHorizontal: 10, paddingVertical: 4,
    borderLeftWidth: 0.5, borderLeftColor: Colors.borderLight,
    marginRight: 12,
  },
  miniTagActive: {},
  miniTagText: { fontSize: 10, color: Colors.soft, letterSpacing: 0.4 },
});
