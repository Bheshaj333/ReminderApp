import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Modal, Pressable
} from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring, withTiming,
  withSequence, withRepeat,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { Colors, Typography, Radii, Shadows } from '../utils/theme';
import PressButton from './PressButton';
import { speak, stopSpeech } from '../utils/speech';
import { isNativeAlarmSupported, isNativeAlarmRunning } from '../utils/nativeAlarm';

export default function FullscreenReminder({ visible, reminder, onDone, onSnooze, onIgnore }) {
  const scale = useSharedValue(0.85);
  const opacity = useSharedValue(0);
  const emojiY = useSharedValue(0);
  const [isRead, setIsRead] = useState(false);
  const isClosing = useRef(false);
  const lastBurstIndex = useRef(-1);
  const timeoutRef = useRef(null);

  useEffect(() => {
    if (visible) {
      isClosing.current = false;
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
      
      const burstIndex = reminder?.burstIndex ?? 0;
      
      if (burstIndex !== lastBurstIndex.current) {
        lastBurstIndex.current = burstIndex;
        setIsRead(false);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);

        if (timeoutRef.current) clearTimeout(timeoutRef.current);

        // Check if native alarm is actively handling speech on Android
        isNativeAlarmRunning().then(running => {
          if (running) {
            // Native AlarmService is speaking.
            // Estimate speech time based on word count + 5s action window
            const words = (reminder?.text || '').split(/\s+/).length;
            const estimatedSpeechMs = Math.max(2000, words * 400);
            setTimeout(() => {
              setIsRead(true);
            }, estimatedSpeechMs);

            timeoutRef.current = setTimeout(() => {
              if (!isClosing.current && visible) {
                onIgnore?.();
              }
            }, estimatedSpeechMs + 5000);
          } else {
            // Use JS TTS (expo-speech) and wait 5 seconds after speech completes
            speak(reminder?.text || 'Reminder', 'default', () => {
              setIsRead(true);
              if (timeoutRef.current) clearTimeout(timeoutRef.current);
              timeoutRef.current = setTimeout(() => {
                if (!isClosing.current && visible) {
                  onIgnore?.();
                }
              }, 5000); // 5 seconds after message finished being read
            });
          }
        });
      }
    } else {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      opacity.value = withTiming(0, { duration: 200 });
      scale.value = withTiming(0.9, { duration: 200 });
      lastBurstIndex.current = -1;
      setIsRead(false);
      stopSpeech();
    }

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [visible, reminder?.id, reminder?.burstIndex, reminder?.occurrenceTime]);

  const handleSnooze = () => {
     if (isClosing.current) return;
     stopSpeech();
     isClosing.current = true;
     if (timeoutRef.current) clearTimeout(timeoutRef.current);
     onSnooze?.();
  };

  const handleIgnore = () => {
     if (isClosing.current) return;
     stopSpeech();
     isClosing.current = true;
     if (timeoutRef.current) clearTimeout(timeoutRef.current);
     onIgnore?.();
  };

  const handleDoneAction = () => {
     if (isClosing.current) return;
     stopSpeech();
     isClosing.current = true;
     if (timeoutRef.current) clearTimeout(timeoutRef.current);
     onDone?.();
  };

  const overlayStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  const emojiStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: emojiY.value }],
  }));

  const icons = { water: '💧', stretch: '🧘', vitamins: '💊', focus: '🎯', break: '☕', default: '🔔' };
  const emoji = reminder?.icon ? icons[reminder.icon] || icons.default : icons.default;

  const motivational = [
    'Small actions compound, quietly.',
    'You said you wanted consistency.',
    'Your future self will thank you.',
    'Tiny habits, lasting change.',
  ];
  const quote = motivational[Math.floor((reminder?.id?.charCodeAt(0) || 0) % motivational.length)];

  const totalSteps = (reminder?.repeatCount || 0) + 1;
  const currentStep = Math.min((reminder?.burstIndex ?? 0) + 1, totalSteps);

  return (
    <Modal
      transparent
      visible={visible}
      statusBarTranslucent
      animationType="none"
      onRequestClose={handleIgnore}
    >
      <Animated.View style={[styles.overlay, overlayStyle]}>
        <BlurView intensity={60} tint="light" style={StyleSheet.absoluteFill} />
        <View style={styles.bg} />

        <Animated.View style={[styles.card, cardStyle, Shadows.lg]}>
          <View style={styles.repeatBadge}>
             <Text style={styles.repeatBadgeText}>
               {totalSteps > 1 ? `Step ${currentStep} of ${totalSteps}` : 'Reminder'}
             </Text>
          </View>
          <Animated.Text style={[styles.emoji, emojiStyle]}>{emoji}</Animated.Text>

          <Text style={styles.heading}>{reminder?.text || 'Time for a reminder.'}</Text>
          <Text style={styles.quote}>{quote}</Text>

          {/* Action Button: Tap Done */}
          <View style={styles.actionBlock}>
            <PressButton
              label="Done"
              onPress={handleDoneAction}
              variant="primary"
              size="lg"
              style={{ width: '100%', marginBottom: 12, backgroundColor: Colors.deep }}
            />

            <View style={styles.actionRow}>
              <PressButton
                label="Snooze 5m"
                onPress={handleSnooze}
                variant="secondary"
                style={{ flex: 1 }}
              />
              <PressButton
                label="Ignore"
                onPress={handleIgnore}
                variant="ghost"
                style={{ flex: 1 }}
              />
            </View>
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
    position: 'relative',
  },
  repeatBadge: {
    position: 'absolute',
    top: 16,
    right: 16,
    backgroundColor: Colors.sea,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radii.full,
    borderWidth: 0.5,
    borderColor: Colors.seafoam,
  },
  repeatBadgeText: {
    fontSize: 10,
    color: Colors.deep,
    fontWeight: '600',
    letterSpacing: 0.3,
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
  actionBlock: {
    width: '100%',
    marginTop: 8,
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
