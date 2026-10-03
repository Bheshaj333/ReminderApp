import React, { memo } from 'react';
import { View, Text, StyleSheet, Switch, Pressable } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { Colors, Radii, Shadows } from '../utils/theme';
import { getCategory } from '../utils/categories';
import { nextOccurrence, describeRepeat, describeBurst, formatWhen } from '../utils/schedule';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

function ReminderCard({ reminder, onToggle, onPress }) {
  const scale = useSharedValue(1);
  const pressStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const cat = getCategory(reminder.category);
  const isOn = reminder.active;
  const next = isOn ? nextOccurrence(reminder) : null;
  const burst = describeBurst(reminder);

  return (
    <AnimatedPressable
      onPress={() => onPress?.(reminder)}
      onPressIn={() => { scale.value = withSpring(0.98, { damping: 18, stiffness: 300 }); }}
      onPressOut={() => { scale.value = withSpring(1, { damping: 14, stiffness: 260 }); }}
      style={[styles.card, Shadows.sm, pressStyle]}
    >
      <View style={[styles.bubble, { backgroundColor: cat.color + (isOn ? '1F' : '10') }]}>
        <Text style={[styles.emoji, !isOn && styles.dim]}>{cat.emoji}</Text>
      </View>

      <View style={styles.body}>
        <Text style={[styles.text, !isOn && styles.textOff]} numberOfLines={2}>{reminder.text}</Text>
        <View style={styles.metaRow}>
          <Feather name={isOn ? 'clock' : 'pause-circle'} size={12} color={isOn ? Colors.deep : Colors.soft} />
          <Text style={[styles.when, !isOn && styles.metaOff]} numberOfLines={1}>
            {isOn ? (next ? formatWhen(next) : 'No upcoming time') : 'Paused'}
          </Text>
        </View>
        <Text style={styles.repeat} numberOfLines={1}>
          {describeRepeat(reminder)}{burst ? `  ·  ${burst}` : ''}
        </Text>
      </View>

      <Switch
        value={isOn}
        onValueChange={(v) => { Haptics.selectionAsync(); onToggle?.(reminder, v); }}
        trackColor={{ false: Colors.sea2, true: Colors.seafoam }}
        thumbColor={Colors.white}
        ios_backgroundColor={Colors.sea2}
      />
    </AnimatedPressable>
  );
}

export default memo(ReminderCard);

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: Colors.white,
    borderRadius: Radii.xl,
    paddingVertical: 14,
    paddingLeft: 14,
    paddingRight: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  bubble: {
    width: 46,
    height: 46,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: { fontSize: 22 },
  dim: { opacity: 0.5 },
  body: { flex: 1, gap: 4 },
  text: { fontSize: 16, fontWeight: '600', color: Colors.ink, lineHeight: 21 },
  textOff: { color: Colors.soft },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  when: { fontSize: 13, color: Colors.deep, fontWeight: '500' },
  metaOff: { color: Colors.soft },
  repeat: { fontSize: 12, color: Colors.mid },
});
