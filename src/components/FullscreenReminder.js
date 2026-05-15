import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Modal, Pressable, Vibration, Animated as RNAnimated
} from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring, withTiming,
  runOnJS, withSequence, withRepeat, Easing,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { Colors, Typography, Radii, Shadows } from '../utils/theme';
import PressButton from './PressButton';

export default function FullscreenReminder({ visible, reminder, onDone, onSnooze, onIgnore }) {
  const scale = useSharedValue(0.85);
  const opacity = useSharedValue(0);
  const emojiY = useSharedValue(0);
  const [holdProgress, setHoldProgress] = useState(0);
  const holdInterval = useRef(null);
  const progressVal = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      opacity.value = withTiming(1, { duration: 300 });
      scale.value = withSpring(1, { damping: 18, stiffness: 200 });
      emojiY.value = withRepeat(
        withSequence(
          withTiming(-10, { duration: 1200 }),
          withTiming(0, { duration: 1200 })
        ),
        -1,
        true
      );
      // Progress bar animation
      progressVal.value = withTiming(1, { duration: 8000 });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    } else {
      opacity.value = withTiming(0, { duration: 200 });
      scale.value = withTiming(0.9, { duration: 200 });
      progressVal.value = 0;
    }
  }, [visible]);

  const overlayStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  const emojiStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: emojiY.value }],
  }));
  const progressBarStyle = useAnimatedStyle(() => ({
    width: `${progressVal.value * 100}%`,
  }));

  const startHold = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    let progress = 0;
    holdInterval.current = setInterval(() => {
      progress += 4;
      setHoldProgress(Math.min(100, progress));
      if (progress >= 100) {
        clearInterval(holdInterval.current);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        onDone?.();
        setHoldProgress(0);
      }
    }, 40);
  };

  const stopHold = () => {
    clearInterval(holdInterval.current);
    setHoldProgress(0);
  };

  const icons = { water: '💧', stretch: '🧘', vitamins: '💊', focus: '🎯', break: '☕', default: '🔔' };
  const emoji = reminder?.icon ? icons[reminder.icon] || icons.default : icons.default;

  const motivational = [
    'Small actions compound, quietly.',
    'You said you wanted consistency.',
    'Your future self will thank you.',
    'Tiny habits, lasting change.',
  ];
  const quote = motivational[Math.floor((reminder?.id?.charCodeAt(0) || 0) % motivational.length)];

  if (!visible && opacity.value === 0) return null;

  return (
    <Modal transparent visible={visible} statusBarTranslucent animationType="none">
      <Animated.View style={[styles.overlay, overlayStyle]}>
        <BlurView intensity={60} tint="light" style={StyleSheet.absoluteFill} />
        <View style={styles.bg} />

        <Animated.View style={[styles.card, cardStyle, Shadows.lg]}>
          <Animated.Text style={[styles.emoji, emojiStyle]}>{emoji}</Animated.Text>

          <Text style={styles.heading}>{reminder?.text || 'Time for a reminder.'}</Text>
          <Text style={styles.quote}>{quote}</Text>

          {/* Hold to dismiss */}
          <View style={styles.holdWrap}>
            <Pressable
              onPressIn={startHold}
              onPressOut={stopHold}
              style={[styles.holdBtn, { overflow: 'hidden' }]}
            >
              <View style={[styles.holdFill, { width: `${holdProgress}%` }]} />
              <Text style={styles.holdLabel}>
                {holdProgress > 0 ? `${Math.round(holdProgress)}%` : 'Hold to dismiss'}
              </Text>
            </Pressable>
          </View>

          <View style={styles.actionRow}>
            <PressButton
              label="Snooze 5m"
              onPress={onSnooze}
              variant="secondary"
              style={{ flex: 1 }}
            />
            <PressButton
              label="Ignore"
              onPress={onIgnore}
              variant="ghost"
              style={{ flex: 1 }}
            />
          </View>

          {/* Progress strip */}
          <View style={styles.progressTrack}>
            <Animated.View style={[styles.progressFill, progressBarStyle]} />
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  bg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(232, 244, 240, 0.88)',
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: Radii.xl,
    padding: 32,
    width: '100%',
    alignItems: 'center',
    borderWidth: 0.5,
    borderColor: Colors.sea3,
    overflow: 'hidden',
  },
  emoji: {
    fontSize: 64,
    marginBottom: 20,
  },
  heading: {
    fontFamily: 'Georgia',
    fontSize: 26,
    fontWeight: '600',
    color: Colors.deeper,
    textAlign: 'center',
    marginBottom: 8,
    lineHeight: 34,
  },
  quote: {
    fontFamily: 'Georgia',
    fontSize: 14,
    color: Colors.mid,
    textAlign: 'center',
    fontStyle: 'italic',
    marginBottom: 32,
  },
  holdWrap: {
    width: '100%',
    marginBottom: 12,
  },
  holdBtn: {
    width: '100%',
    backgroundColor: Colors.sea,
    borderRadius: Radii.md,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 0.5,
    borderColor: Colors.seafoam,
    position: 'relative',
  },
  holdFill: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.seafoam,
    borderRadius: Radii.md,
  },
  holdLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.deeper,
    zIndex: 1,
    letterSpacing: 0.3,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  progressTrack: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: Colors.sea2,
  },
  progressFill: {
    height: 2,
    backgroundColor: Colors.seafoam,
  },
});
