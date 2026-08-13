import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, StatusBar } from 'react-native';
import Animated, {
  FadeIn, FadeInDown, useSharedValue, useAnimatedStyle,
  withSpring, withTiming, withRepeat, withSequence, Easing,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { Colors, Radii, Shadows } from '../utils/theme';
import PomodoroRing from '../components/PomodoroRing';
import PressButton from '../components/PressButton';

const PHASES = {
  focus: { label: 'Focus session', duration: 25, color: Colors.seafoam },
  break: { label: 'Break time', duration: 5, color: Colors.jasmine3 },
  longBreak: { label: 'Long break', duration: 15, color: Colors.petalDeep },
};

function pad(n) { return n < 10 ? '0' + n : '' + n; }

const VOICE_ANNOUNCEMENTS = {
  focus: ['Focus session started.', 'Time to work.', 'Distractions down.'],
  break: ['Take a 5 minute break.', "You've earned a rest.", 'Step away for a moment.'],
  longBreak: ['Long break time.', 'Great work — take 15 minutes.'],
};

export default function FocusScreen() {
  const [running, setRunning] = useState(false);
  const [phase, setPhase] = useState('focus');
  const [secs, setSecs] = useState(25 * 60);
  const [cycle, setCycle] = useState(1);
  const [log, setLog] = useState([]);
  const [announcement, setAnnouncement] = useState('');

  const intervalRef = useRef(null);
  const pulseScale = useSharedValue(1);
  const announcementOpacity = useSharedValue(0);

  const totalSecs = PHASES[phase].duration * 60;
  const progress = 1 - secs / totalSecs;

  const timeStr = `${pad(Math.floor(secs / 60))}:${pad(secs % 60)}`;

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => {
        setSecs(s => {
          if (s <= 1) {
            clearInterval(intervalRef.current);
            endPhase();
            return 0;
          }
          return s - 1;
        });
      }, 1000);
      // Pulse animation when running
      pulseScale.value = withRepeat(
        withSequence(
          withTiming(1.03, { duration: 1000 }),
          withTiming(1, { duration: 1000 })
        ),
        -1,
        true
      );
    } else {
      clearInterval(intervalRef.current);
      pulseScale.value = withTiming(1, { duration: 300 });
    }
    return () => clearInterval(intervalRef.current);
  }, [running]);

  const endPhase = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const completedPhase = phase;
    setRunning(false);

    addLog(completedPhase);

    if (completedPhase === 'focus') {
      const nextCycle = cycle + 1;
      setCycle(nextCycle);
      const nextPhase = nextCycle % 4 === 0 ? 'longBreak' : 'break';
      setPhase(nextPhase);
      setSecs(PHASES[nextPhase].duration * 60);
      announce(nextPhase);
    } else {
      setPhase('focus');
      setSecs(PHASES.focus.duration * 60);
      announce('focus');
    }
  };

  const announce = (ph) => {
    const msgs = VOICE_ANNOUNCEMENTS[ph];
    const msg = msgs[Math.floor(Math.random() * msgs.length)];
    setAnnouncement(msg);
    announcementOpacity.value = withSequence(
      withTiming(1, { duration: 400 }),
      withTiming(1, { duration: 3000 }),
      withTiming(0, { duration: 600 })
    );
  };

  const addLog = (ph) => {
    const labels = { focus: 'Focus complete', break: 'Break done', longBreak: 'Long break done' };
    setLog(prev => [{ phase: ph, label: labels[ph], time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), id: Date.now() }, ...prev.slice(0, 9)]);
  };

  const toggle = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setRunning(r => !r);
    if (!running && secs === totalSecs) announce(phase);
  };

  const reset = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRunning(false);
    setSecs(PHASES[phase].duration * 60);
  };

  const skip = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSecs(0);
    endPhase();
  };

  const ringStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulseScale.value }] }));
  const annStyle = useAnimatedStyle(() => ({ opacity: announcementOpacity.value }));
  const phaseColor = PHASES[phase].color;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="dark-content" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Animated.View entering={FadeIn.duration(400)} style={styles.header}>
          <Text style={styles.title}>Focus</Text>
          <Text style={styles.cycleText}>Session #{cycle}</Text>
        </Animated.View>

        {/* Ring */}
        <Animated.View entering={FadeIn.delay(100).duration(500)} style={styles.ringWrap}>
          <Animated.View style={[styles.ringContainer, ringStyle]}>
            <PomodoroRing progress={progress} phase={phase} size={230} color={phaseColor} />
            <View style={styles.ringCenter} pointerEvents="none">
              <Text style={[styles.timerText, { color: phaseColor }]}>{timeStr}</Text>
              <Text style={styles.phaseLabel}>{PHASES[phase].label}</Text>
            </View>
          </Animated.View>
        </Animated.View>

        {/* Announcement */}
        <Animated.View style={[styles.announcementWrap, annStyle]}>
          <Text style={styles.announcementText}>"{announcement}"</Text>
        </Animated.View>

        {/* Controls */}
        <Animated.View entering={FadeInDown.delay(200).duration(400)} style={styles.controls}>
          <Pressable onPress={reset} style={styles.controlBtn}>
            <Feather name="rotate-ccw" size={18} color={Colors.mid} />
          </Pressable>

          <Pressable
            onPress={toggle}
            style={[styles.mainBtn, { backgroundColor: phaseColor }]}
          >
            <Feather name={running ? 'pause' : 'play'} size={28} color={Colors.white} />
          </Pressable>

          <Pressable onPress={skip} style={styles.controlBtn}>
            <Feather name="skip-forward" size={18} color={Colors.mid} />
          </Pressable>
        </Animated.View>

        {/* Phase indicator dots */}
        <Animated.View entering={FadeInDown.delay(250)} style={styles.dotRow}>
          {[1, 2, 3, 4].map(n => (
            <View
              key={n}
              style={[
                styles.dot,
                n <= (cycle - 1) % 4 + 1 && phase === 'focus' && running && { backgroundColor: phaseColor },
                n < cycle % 4 + 1 && phase !== 'focus' && { backgroundColor: phaseColor },
              ]}
            />
          ))}
          <Text style={styles.dotLabel}>cycles</Text>
        </Animated.View>

        {/* Duration Presets */}
        <Animated.View entering={FadeInDown.delay(300)} style={[styles.presetsCard, Shadows.sm]}>
          <Text style={styles.sectionLabel}>Duration presets</Text>
          <View style={styles.presetRow}>
            {[15, 25, 45, 60].map(min => (
              <Pressable
                key={min}
                onPress={() => {
                  Haptics.selectionAsync();
                  const newSecs = min * 60;
                  setSecs(newSecs);
                  PHASES.focus.duration = min;
                  setRunning(false);
                }}
                style={styles.presetChip}
              >
                <Text style={styles.presetNum}>{min}</Text>
                <Text style={styles.presetUnit}>min</Text>
              </Pressable>
            ))}
          </View>
        </Animated.View>

        {/* Session Log */}
        {log.length > 0 && (
          <Animated.View entering={FadeInDown.delay(350)} style={[styles.logCard, Shadows.sm]}>
            <Text style={styles.sectionLabel}>Session log</Text>
            {log.map(item => (
              <View key={item.id} style={styles.logItem}>
                <View style={[styles.logDot, { backgroundColor: PHASES[item.phase]?.color || Colors.seafoam }]} />
                <Text style={styles.logText}>{item.label}</Text>
                <Text style={styles.logTime}>{item.time}</Text>
              </View>
            ))}
          </Animated.View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.mist },
  content: { padding: 20 },
  header: {
    flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between',
    marginBottom: 32,
  },
  title: { fontFamily: 'Georgia', fontSize: 26, fontWeight: '600', color: Colors.deeper },
  cycleText: { fontSize: 13, color: Colors.soft, letterSpacing: 0.3 },
  ringWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 12,
  },
  ringContainer: {
    width: 230,
    height: 230,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  ringCenter: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timerText: {
    fontFamily: 'Georgia',
    fontSize: 46,
    fontWeight: '600',
    letterSpacing: -0.5,
    fontVariant: ['tabular-nums'],
    textAlign: 'center',
  },
  phaseLabel: {
    fontSize: 12,
    color: Colors.soft,
    letterSpacing: 0.8,
    marginTop: 4,
    textTransform: 'uppercase',
    fontWeight: '500',
  },
  announcementWrap: { alignItems: 'center', marginBottom: 16, minHeight: 28 },
  announcementText: {
    fontFamily: 'Georgia', fontSize: 15, color: Colors.mid,
    fontStyle: 'italic', textAlign: 'center',
  },
  controls: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 24, marginBottom: 24,
  },
  controlBtn: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: Colors.white, borderWidth: 0.5, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
    ...Shadows.sm,
  },
  mainBtn: {
    width: 72, height: 72, borderRadius: 36,
    alignItems: 'center', justifyContent: 'center',
    ...Shadows.md,
  },
  dotRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 24 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.sea3 },
  dotLabel: { fontSize: 10, color: Colors.soft, letterSpacing: 0.5, marginLeft: 4 },
  presetsCard: {
    backgroundColor: Colors.white, borderRadius: Radii.lg,
    padding: 16, borderWidth: 0.5, borderColor: Colors.border, marginBottom: 12,
  },
  sectionLabel: {
    fontSize: 10, letterSpacing: 0.8, textTransform: 'uppercase',
    color: Colors.soft, marginBottom: 12,
  },
  presetRow: { flexDirection: 'row', gap: 10 },
  presetChip: {
    flex: 1, backgroundColor: Colors.sea, borderRadius: Radii.md,
    borderWidth: 0.5, borderColor: Colors.border,
    paddingVertical: 12, alignItems: 'center',
  },
  presetNum: { fontSize: 18, fontWeight: '500', color: Colors.ink },
  presetUnit: { fontSize: 10, color: Colors.soft, letterSpacing: 0.3 },
  logCard: {
    backgroundColor: Colors.white, borderRadius: Radii.lg,
    padding: 16, borderWidth: 0.5, borderColor: Colors.border,
  },
  logItem: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 8, borderBottomWidth: 0.5, borderBottomColor: Colors.borderLight,
  },
  logDot: { width: 6, height: 6, borderRadius: 3 },
  logText: { flex: 1, fontSize: 13, color: Colors.mid },
  logTime: { fontSize: 11, color: Colors.soft },
});
