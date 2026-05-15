import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, StatusBar } from 'react-native';
import Animated, {
  FadeIn, FadeInDown, useSharedValue, useAnimatedStyle,
  withRepeat, withSequence, withTiming, withSpring, Easing,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { Colors, Radii, Shadows, VOICE_PHRASES } from '../utils/theme';
import { useApp } from '../store/AppContext';
import PressButton from '../components/PressButton';

const VOICE_OPTIONS = [
  { id: 'default', label: 'Default', desc: 'Clean system TTS', icon: 'cpu' },
  { id: 'gentle', label: 'Gentle', desc: '"Hey, just a nudge."', icon: 'smile' },
  { id: 'firm', label: 'Firm', desc: '"Get it done. Now."', icon: 'alert-circle' },
  { id: 'own', label: 'Your voice', desc: 'Record yourself', icon: 'mic' },
  { id: 'someone', label: 'Someone else', desc: 'Upload audio', icon: 'heart' },
];

const SAMPLE_PHRASES = [
  { key: 'water', phrases: ['Drink some water.', 'Hydration check.', 'Your body needs water.'] },
  { key: 'stretch', phrases: ['Stand up and stretch.', 'Time to move.', 'Get off your chair.'] },
  { key: 'breathe', phrases: ['Take a deep breath.', 'Pause. Breathe.', 'One slow breath.'] },
];

export default function VoiceScreen() {
  const { state, updateSettings } = useApp();
  const [recording, setRecording] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState(state.settings.voiceStyle || 'default');
  const [expandedSet, setExpandedSet] = useState(null);

  const orbScale = useSharedValue(1);
  const orbRingScale = useSharedValue(1);
  const waveOpacity1 = useSharedValue(0);
  const waveOpacity2 = useSharedValue(0);
  const waveOpacity3 = useSharedValue(0);

  useEffect(() => {
    if (recording) {
      // Orb pulse
      orbScale.value = withRepeat(
        withSequence(
          withTiming(1.08, { duration: 600 }),
          withTiming(1, { duration: 600 })
        ), -1, true
      );
      // Expanding waves
      const waveDelay = (sv, delay) => {
        sv.value = withRepeat(
          withSequence(
            withTiming(0, { duration: 0 }),
            withTiming(0.6, { duration: delay * 0.3 }),
            withTiming(0, { duration: delay * 0.7 })
          ), -1, false
        );
      };
      setTimeout(() => waveDelay(waveOpacity1, 1400), 0);
      setTimeout(() => waveDelay(waveOpacity2, 1400), 350);
      setTimeout(() => waveDelay(waveOpacity3, 1400), 700);
    } else {
      orbScale.value = withSpring(1);
      waveOpacity1.value = withTiming(0, { duration: 300 });
      waveOpacity2.value = withTiming(0, { duration: 300 });
      waveOpacity3.value = withTiming(0, { duration: 300 });
    }
  }, [recording]);

  const orbStyle = useAnimatedStyle(() => ({ transform: [{ scale: orbScale.value }] }));
  const w1Style = useAnimatedStyle(() => ({ opacity: waveOpacity1.value }));
  const w2Style = useAnimatedStyle(() => ({ opacity: waveOpacity2.value }));
  const w3Style = useAnimatedStyle(() => ({ opacity: waveOpacity3.value }));

  const toggleRecord = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setRecording(r => !r);
  };

  const selectVoice = (id) => {
    Haptics.selectionAsync();
    setSelectedVoice(id);
    updateSettings({ voiceStyle: id });
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="dark-content" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Animated.View entering={FadeIn.duration(400)} style={styles.header}>
          <Text style={styles.title}>Voice</Text>
          <Text style={styles.subtitle}>Make reminders feel personal</Text>
        </Animated.View>

        {/* Orb */}
        <Animated.View entering={FadeIn.delay(100).duration(500)} style={styles.orbSection}>
          {/* Expanding rings */}
          <Animated.View style={[styles.wave, styles.wave3, w3Style]} />
          <Animated.View style={[styles.wave, styles.wave2, w2Style]} />
          <Animated.View style={[styles.wave, styles.wave1, w1Style]} />
          <Animated.View style={orbStyle}>
            <Pressable
              onPress={toggleRecord}
              style={[styles.orb, recording && styles.orbActive]}
            >
              <Feather
                name={recording ? 'mic' : 'mic-off'}
                size={32}
                color={recording ? Colors.white : Colors.mid}
              />
            </Pressable>
          </Animated.View>
          <Text style={styles.orbLabel}>
            {recording ? 'Recording… tap to stop' : 'Tap orb to record'}
          </Text>
        </Animated.View>

        {/* Voice Options */}
        <Animated.View entering={FadeInDown.delay(200).duration(400)}>
          <Text style={styles.sectionLabel}>Voice style</Text>
          {VOICE_OPTIONS.map((opt, i) => {
            const sel = selectedVoice === opt.id;
            return (
              <Animated.View key={opt.id} entering={FadeInDown.delay(i * 60)}>
                <Pressable
                  onPress={() => selectVoice(opt.id)}
                  style={[styles.voiceRow, sel && styles.voiceRowSel]}
                >
                  <View style={[styles.voiceIco, sel && { backgroundColor: Colors.seafoam + '20' }]}>
                    <Feather name={opt.icon} size={16} color={sel ? Colors.seafoam : Colors.mid} />
                  </View>
                  <View style={styles.voiceInfo}>
                    <Text style={[styles.voiceLabel, sel && { color: Colors.deep }]}>{opt.label}</Text>
                    <Text style={styles.voiceDesc}>{opt.desc}</Text>
                  </View>
                  {sel && (
                    <View style={styles.checkWrap}>
                      <Feather name="check" size={14} color={Colors.seafoam} />
                    </View>
                  )}
                  {(opt.id === 'own' || opt.id === 'someone') && (
                    <Feather name="chevron-right" size={14} color={Colors.soft} />
                  )}
                </Pressable>
              </Animated.View>
            );
          })}
        </Animated.View>

        {/* Phrase Variation Preview */}
        <Animated.View entering={FadeInDown.delay(350).duration(400)} style={{ marginTop: 8 }}>
          <Text style={styles.sectionLabel}>Phrase variation preview</Text>
          <Text style={styles.phraseNote}>
            Randomized phrasing reduces habituation — your brain stays alert.
          </Text>

          {SAMPLE_PHRASES.map((set, si) => (
            <Pressable
              key={set.key}
              onPress={() => { setExpandedSet(expandedSet === set.key ? null : set.key); Haptics.selectionAsync(); }}
              style={[styles.phraseGroup, Shadows.sm]}
            >
              <View style={styles.phraseGroupHeader}>
                <Text style={styles.phraseGroupKey}>{set.key}</Text>
                <Feather
                  name={expandedSet === set.key ? 'chevron-up' : 'chevron-down'}
                  size={14} color={Colors.soft}
                />
              </View>
              {expandedSet === set.key && set.phrases.map((p, pi) => (
                <Animated.View key={pi} entering={FadeInDown.delay(pi * 50)} style={styles.phraseItem}>
                  <View style={styles.phraseDot} />
                  <Text style={styles.phraseText}>{p}</Text>
                </Animated.View>
              ))}
            </Pressable>
          ))}
        </Animated.View>

        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.mist },
  content: { padding: 20 },
  header: { marginBottom: 28 },
  title: { fontFamily: 'Georgia', fontSize: 26, fontWeight: '600', color: Colors.deeper },
  subtitle: { fontSize: 13, color: Colors.soft, marginTop: 3, letterSpacing: 0.3 },
  orbSection: { alignItems: 'center', marginBottom: 36, position: 'relative', paddingVertical: 20 },
  wave: {
    position: 'absolute', borderRadius: 999,
    borderWidth: 1, borderColor: Colors.seafoam,
  },
  wave1: { width: 120, height: 120 },
  wave2: { width: 160, height: 160 },
  wave3: { width: 200, height: 200 },
  orb: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: Colors.sea, borderWidth: 0.5, borderColor: Colors.sea3,
    alignItems: 'center', justifyContent: 'center',
    ...Shadows.md,
  },
  orbActive: { backgroundColor: Colors.seafoam, borderColor: Colors.seafoam },
  orbLabel: { marginTop: 16, fontSize: 13, color: Colors.mid, letterSpacing: 0.4 },
  sectionLabel: {
    fontSize: 10, letterSpacing: 0.8, textTransform: 'uppercase',
    color: Colors.soft, marginBottom: 12,
  },
  voiceRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Colors.white, borderRadius: Radii.lg,
    padding: 14, marginBottom: 8,
    borderWidth: 0.5, borderColor: Colors.border,
    ...Shadows.sm,
  },
  voiceRowSel: { borderColor: Colors.seafoam, backgroundColor: Colors.sea },
  voiceIco: {
    width: 36, height: 36, borderRadius: Radii.sm,
    backgroundColor: Colors.sea, alignItems: 'center', justifyContent: 'center',
  },
  voiceInfo: { flex: 1 },
  voiceLabel: { fontSize: 14, fontWeight: '400', color: Colors.ink, marginBottom: 2 },
  voiceDesc: { fontSize: 12, color: Colors.soft },
  checkWrap: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: Colors.seafoam + '20', alignItems: 'center', justifyContent: 'center',
  },
  phraseNote: { fontSize: 13, color: Colors.mid, lineHeight: 20, marginBottom: 12 },
  phraseGroup: {
    backgroundColor: Colors.white, borderRadius: Radii.lg,
    padding: 14, marginBottom: 8, borderWidth: 0.5, borderColor: Colors.border,
  },
  phraseGroupHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  phraseGroupKey: {
    fontSize: 13, fontWeight: '500', color: Colors.ink,
    textTransform: 'capitalize', letterSpacing: 0.3,
  },
  phraseItem: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingTop: 10, paddingLeft: 4,
  },
  phraseDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: Colors.seafoam },
  phraseText: { fontSize: 14, color: Colors.mid, fontStyle: 'italic' },
});
