import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, StatusBar, TextInput, Switch, ActivityIndicator } from 'react-native';
import Animated, {
  FadeIn, useSharedValue, useAnimatedStyle, withRepeat, withTiming, withDelay, withSequence, Easing, cancelAnimation,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { Colors, Radii, Shadows } from '../utils/theme';
import { useApp } from '../store/AppContext';
import { speak, stopSpeech, getVoiceGroups, RATE_OPTIONS, PITCH_OPTIONS } from '../utils/speech';

function deviceLocale() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().locale || 'en-US';
  } catch (e) {
    return 'en-US';
  }
}

function WaveBar({ index, active }) {
  const h = useSharedValue(0.3);
  useEffect(() => {
    if (active) {
      h.value = withDelay(index * 90, withRepeat(withSequence(
        withTiming(1, { duration: 260, easing: Easing.inOut(Easing.quad) }),
        withTiming(0.25, { duration: 260, easing: Easing.inOut(Easing.quad) }),
      ), -1));
    } else {
      cancelAnimation(h);
      h.value = withTiming(0.3, { duration: 200 });
    }
  }, [active]);
  const style = useAnimatedStyle(() => ({ transform: [{ scaleY: h.value }] }));
  return <Animated.View style={[styles.bar, style]} />;
}

function Choice({ options, value, onChange }) {
  return (
    <View style={styles.segment}>
      {options.map(o => {
        const sel = Math.abs(o.value - value) < 0.01;
        return (
          <Pressable key={o.label} onPress={() => onChange(o.value)} style={[styles.seg, sel && styles.segSel]}>
            <Text style={[styles.segText, sel && styles.segTextSel]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function VoiceScreen() {
  const { state, updateSettings } = useApp();
  const { settings } = state;
  const [phrase, setPhrase] = useState('Time to take your medicine.');
  const [speaking, setSpeaking] = useState(false);
  const [groups, setGroups] = useState(null);
  const [lang, setLang] = useState(null);

  useEffect(() => {
    getVoiceGroups().then(g => {
      setGroups(g);
      // Start on the language of the chosen voice, else the phone's language
      const chosen = g.find(x => x.voices.some(v => v.id === settings.voiceId));
      const deviceTag = deviceLocale();
      const device = g.find(x => x.lang === deviceTag) || g.find(x => x.lang.startsWith(deviceTag.split('-')[0]));
      setLang((chosen || device || g[0])?.lang ?? null);
    });
    return () => stopSpeech();
  }, []);

  const play = (overrides = {}) => {
    stopSpeech();
    setSpeaking(true);
    speak(phrase.trim() || 'This is how your reminders will sound.', { ...settings, ...overrides }, {
      onDone: () => setSpeaking(false),
    });
  };

  const change = (patch) => {
    Haptics.selectionAsync();
    updateSettings(patch);
    play(patch);
  };

  const group = useMemo(() => groups?.find(g => g.lang === lang), [groups, lang]);
  // Show the most useful languages first: device language family, then English
  const langs = useMemo(() => {
    if (!groups) return [];
    const base = deviceLocale().split('-')[0];
    const score = g => (g.lang.startsWith(base) ? 0 : g.lang.startsWith('en') ? 1 : 2);
    return [...groups].sort((a, b) => score(a) - score(b) || a.label.localeCompare(b.label));
  }, [groups]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.mist} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Animated.View entering={FadeIn.duration(300)}>
          <Text style={styles.title}>Voice</Text>
          <Text style={styles.subtitle}>How your reminders sound when they ring</Text>
        </Animated.View>

        {/* Preview */}
        <LinearGradient colors={['#0B2421', '#1A4A40', '#2D6B5F']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.preview, Shadows.md]}>
          <Text style={styles.previewLabel}>TRY IT</Text>
          <TextInput
            style={styles.previewInput}
            value={phrase}
            onChangeText={setPhrase}
            multiline
            placeholder="Type something to hear"
            placeholderTextColor="rgba(255,255,255,0.4)"
          />
          <View style={styles.previewRow}>
            <View style={styles.wave}>
              {Array.from({ length: 14 }).map((_, i) => <WaveBar key={i} index={i % 7} active={speaking} />)}
            </View>
            <Pressable
              onPress={() => (speaking ? (stopSpeech(), setSpeaking(false)) : play())}
              style={({ pressed }) => [styles.playBtn, pressed && { transform: [{ scale: 0.94 }] }]}
            >
              <Feather name={speaking ? 'square' : 'play'} size={22} color="#0B2421" style={!speaking && { marginLeft: 3 }} />
            </Pressable>
          </View>
        </LinearGradient>

        {/* Tone */}
        <Text style={styles.section}>Speed</Text>
        <Choice options={RATE_OPTIONS} value={settings.rate ?? 0.95} onChange={v => change({ rate: v })} />
        <Text style={styles.section}>Pitch</Text>
        <Choice options={PITCH_OPTIONS} value={settings.pitch ?? 1} onChange={v => change({ pitch: v })} />

        <View style={[styles.card, styles.toggleRow, Shadows.sm]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowTitle}>Say “Reminder” first</Text>
            <Text style={styles.rowDesc}>“Reminder. Take your medicine.”</Text>
          </View>
          <Switch
            value={!!settings.announcePrefix}
            onValueChange={v => change({ announcePrefix: v })}
            trackColor={{ false: Colors.sea2, true: Colors.seafoam }}
            thumbColor={Colors.white}
          />
        </View>

        {/* Voices */}
        <Text style={styles.section}>Voice</Text>
        {!groups ? (
          <ActivityIndicator color={Colors.seafoam} style={{ marginTop: 20 }} />
        ) : groups.length === 0 ? (
          <Text style={styles.note}>No text-to-speech voices found. Install “Speech Services by Google” from the Play Store.</Text>
        ) : (
          <>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.langRow}>
              {langs.map(g => {
                const sel = g.lang === lang;
                return (
                  <Pressable key={g.lang} onPress={() => { Haptics.selectionAsync(); setLang(g.lang); }} style={[styles.lang, sel && styles.langSel]}>
                    <Text style={[styles.langText, sel && styles.langTextSel]}>{g.label}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <View style={[styles.card, Shadows.sm]}>
              <VoiceRow
                label="Phone default"
                desc="Uses your phone's text-to-speech setting"
                selected={!settings.voiceId}
                onPress={() => change({ voiceId: null })}
              />
              {group?.voices.map(v => (
                <VoiceRow
                  key={v.id}
                  label={v.label}
                  desc={v.online ? 'Needs internet · higher quality' : 'Works offline'}
                  badge={v.online ? 'wifi' : null}
                  selected={settings.voiceId === v.id}
                  onPress={() => change({ voiceId: v.id })}
                  border
                />
              ))}
            </View>
            <Text style={styles.note}>Tap a voice to hear it. Your choice is used for every reminder.</Text>
          </>
        )}
        <View style={{ height: 120 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function VoiceRow({ label, desc, selected, onPress, border, badge }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.voiceRow, border && styles.border, pressed && { backgroundColor: Colors.sea }]}>
      <View style={[styles.radio, selected && styles.radioSel]}>
        {selected && <View style={styles.radioDot} />}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.rowTitle, selected && { color: Colors.deep }]}>{label}</Text>
        <Text style={styles.rowDesc}>{desc}</Text>
      </View>
      {badge && <Feather name={badge} size={14} color={Colors.soft} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.mist },
  content: { paddingHorizontal: 20, paddingTop: 12 },
  title: { fontFamily: 'Georgia', fontSize: 28, fontWeight: '600', color: Colors.deeper },
  subtitle: { fontSize: 13, color: Colors.mid, marginTop: 2, marginBottom: 18 },

  preview: { borderRadius: 26, padding: 20 },
  previewLabel: { fontSize: 11, letterSpacing: 3, color: 'rgba(168,240,220,0.8)', fontWeight: '700' },
  previewInput: { color: '#fff', fontFamily: 'Georgia', fontSize: 22, lineHeight: 30, marginTop: 10, padding: 0, minHeight: 60 },
  previewRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 },
  wave: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 36 },
  bar: { width: 4, height: 32, borderRadius: 2, backgroundColor: '#78E8C8' },
  playBtn: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#A8F0DC', alignItems: 'center', justifyContent: 'center' },

  section: { fontSize: 12, letterSpacing: 1.5, textTransform: 'uppercase', color: Colors.mid, fontWeight: '700', marginTop: 24, marginBottom: 10 },
  segment: { flexDirection: 'row', padding: 4, backgroundColor: Colors.sea, borderRadius: Radii.full },
  seg: { flex: 1, height: 40, borderRadius: Radii.full, alignItems: 'center', justifyContent: 'center' },
  segSel: { backgroundColor: Colors.white, ...Shadows.sm },
  segText: { fontSize: 14, color: Colors.mid, fontWeight: '600' },
  segTextSel: { color: Colors.deeper },

  card: { backgroundColor: Colors.white, borderRadius: 20, borderWidth: 1, borderColor: Colors.borderLight, overflow: 'hidden' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', padding: 16, marginTop: 16 },
  rowTitle: { fontSize: 15, fontWeight: '600', color: Colors.ink },
  rowDesc: { fontSize: 12, color: Colors.soft, marginTop: 2 },

  langRow: { gap: 8, paddingBottom: 12, paddingRight: 20 },
  lang: { height: 36, paddingHorizontal: 14, borderRadius: Radii.full, backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.borderLight, justifyContent: 'center' },
  langSel: { backgroundColor: Colors.deep, borderColor: Colors.deep },
  langText: { fontSize: 13, fontWeight: '600', color: Colors.mid },
  langTextSel: { color: Colors.white },

  voiceRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 14 },
  border: { borderTopWidth: 1, borderTopColor: Colors.borderLight },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: Colors.sea3, alignItems: 'center', justifyContent: 'center' },
  radioSel: { borderColor: Colors.deep },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.deep },
  note: { fontSize: 12, color: Colors.soft, marginTop: 10, lineHeight: 17 },
});
