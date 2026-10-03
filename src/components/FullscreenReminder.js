import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Modal, Pressable } from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, withRepeat, withDelay, withSpring, Easing,
  FadeInDown,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

import { getCategory } from '../utils/categories';
import { speak, stopSpeech } from '../utils/speech';
import { isNativeAlarmSupported } from '../utils/nativeAlarm';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

function Ring({ delay }) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withDelay(delay, withRepeat(withTiming(1, { duration: 2700, easing: Easing.out(Easing.quad) }), -1));
  }, []);
  const style = useAnimatedStyle(() => ({
    opacity: 0.9 * (1 - p.value),
    transform: [{ scale: 1 + 0.8 * p.value }],
  }));
  return <Animated.View style={[styles.ring, style]} />;
}

function ActionButton({ label, onPress, kind }) {
  const scale = useSharedValue(1);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={() => { scale.value = withSpring(0.95); }}
      onPressOut={() => { scale.value = withSpring(1); }}
      style={[styles.btn, styles[kind], style]}
    >
      <Text style={[styles.btnText, kind === 'primary' && styles.btnTextPrimary]}>{label}</Text>
    </AnimatedPressable>
  );
}

/** In-app alarm screen (the native AlarmActivity covers the lock screen / closed app). */
export default function FullscreenReminder({ visible, reminder, settings, onDone, onSnooze, onIgnore }) {
  const closing = useRef(false);
  const burstIndex = reminder?.burstIndex ?? 0;
  const burstCount = reminder?.repeatCount ?? 0;
  const snooze = settings?.snoozeMinutes || 5;
  const cat = getCategory(reminder?.category);

  useEffect(() => {
    if (!visible) return;
    closing.current = false;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    // Android: the native service speaks. Elsewhere speak here, then close after 5s.
    if (!isNativeAlarmSupported) {
      let timer;
      speak(reminder?.text || 'Reminder', settings, {
        onDone: () => { timer = setTimeout(() => !closing.current && onIgnore?.(), 5000); },
      });
      return () => { clearTimeout(timer); stopSpeech(); };
    }
  }, [visible, reminder?.id, burstIndex]);

  const act = (fn) => () => {
    if (closing.current) return;
    closing.current = true;
    stopSpeech();
    fn?.();
  };

  const ring = burstIndex + 1;
  const total = burstCount + 1;

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={act(onIgnore)}>
      <LinearGradient colors={['#0B2421', '#12352E', '#2D6B5F']} style={styles.fill}>
        <View style={styles.content}>
          <View style={{ flex: 1 }} />
          <Animated.View entering={FadeInDown.duration(500)} style={styles.iconWrap}>
            <Ring delay={0} />
            <Ring delay={900} />
            <Ring delay={1800} />
            <View style={styles.iconCircle}>
              <Text style={styles.emoji}>{cat.emoji}</Text>
            </View>
          </Animated.View>

          <Animated.Text entering={FadeInDown.delay(80).duration(500)} style={styles.label}>REMINDER</Animated.Text>
          <Animated.Text entering={FadeInDown.delay(140).duration(500)} style={styles.text} numberOfLines={5}>
            {reminder?.text || 'Reminder'}
          </Animated.Text>
          {burstCount > 0 && (
            <Animated.View entering={FadeInDown.delay(200).duration(500)} style={styles.pill}>
              <Text style={styles.pillText}>
                {ring < total ? `Ring ${ring} of ${total}` : `Final ring · ${total} of ${total}`}
              </Text>
            </Animated.View>
          )}
          <View style={{ flex: 1 }} />

          <Animated.View entering={FadeInDown.delay(260).duration(500)} style={styles.actions}>
            <ActionButton label="✓   Done" kind="primary" onPress={act(onDone)} />
            <View style={styles.row}>
              <ActionButton label={`Snooze · ${snooze} min`} kind="glass" onPress={act(onSnooze)} />
              <ActionButton label="Dismiss" kind="outline" onPress={act(onIgnore)} />
            </View>
            <Text style={styles.hint}>
              {burstCount > 0 && ring < total ? 'Done stops the remaining rings · Dismiss keeps them' : ' '}
            </Text>
          </Animated.View>
        </View>
      </LinearGradient>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { flex: 1, alignItems: 'center', paddingHorizontal: 28, paddingTop: 60, paddingBottom: 36 },
  iconWrap: { width: 220, height: 220, alignItems: 'center', justifyContent: 'center' },
  ring: {
    position: 'absolute', width: 124, height: 124, borderRadius: 62,
    borderWidth: 1.5, borderColor: 'rgba(168,213,200,0.7)',
  },
  iconCircle: {
    width: 124, height: 124, borderRadius: 62,
    backgroundColor: 'rgba(255,255,255,0.14)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center', justifyContent: 'center',
  },
  emoji: { fontSize: 52 },
  label: { marginTop: 16, fontSize: 12, letterSpacing: 4, color: 'rgba(168,213,200,0.85)', fontWeight: '600' },
  text: {
    marginTop: 12, fontFamily: 'Georgia', fontSize: 30, lineHeight: 38,
    color: '#fff', textAlign: 'center',
  },
  pill: {
    marginTop: 18, paddingHorizontal: 16, paddingVertical: 7, borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.13)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
  },
  pillText: { color: 'rgba(255,255,255,0.9)', fontSize: 13, fontWeight: '500' },
  actions: { width: '100%' },
  row: { flexDirection: 'row', gap: 12, marginTop: 12 },
  btn: { height: 56, borderRadius: 999, alignItems: 'center', justifyContent: 'center', flex: 1 },
  primary: { flex: 0, height: 62, backgroundColor: '#F7F2E8' },
  glass: { backgroundColor: 'rgba(120,189,175,0.16)', borderWidth: 1, borderColor: 'rgba(120,189,175,0.4)' },
  outline: { backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)' },
  btnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  btnTextPrimary: { color: '#1A4A40', fontSize: 18 },
  hint: { marginTop: 14, textAlign: 'center', color: 'rgba(255,255,255,0.5)', fontSize: 12 },
});
