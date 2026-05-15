import React from 'react';
import { View, Text, StyleSheet, Switch, Pressable } from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring, withTiming,
} from 'react-native-reanimated';
import { Colors, Radii, Shadows, Typography } from '../utils/theme';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

const MODE_COLORS = {
  Focus: Colors.seafoam,
  Health: Colors.coral,
  Study: Colors.petalDeep,
  Sleep: Colors.deep,
  Gym: Colors.jasmineDark,
  default: Colors.seafoam,
};

const REPEAT_LABELS = {
  once: 'Once',
  daily: 'Daily',
  custom: 'Every',
};

export default function ReminderCard({ reminder, onToggle, onDelete, onEdit, onTap }) {
  const scale = useSharedValue(1);
  const deleteOpacity = useSharedValue(0);

  const pressIn = () => {
    scale.value = withSpring(0.97, { damping: 20, stiffness: 300 });
  };
  const pressOut = () => {
    scale.value = withSpring(1, { damping: 20, stiffness: 300 });
  };

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const accentColor = MODE_COLORS[reminder.mode] || MODE_COLORS.default;
  const isOn = reminder.active;

  const handleToggle = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onToggle?.(reminder.id);
  };

  const repeatText = reminder.repeatType === 'custom'
    ? `Every ${reminder.repeatInterval}m`
    : reminder.repeatType === 'daily'
    ? 'Daily'
    : 'Once';

  const timeStr = reminder.scheduledTime
    ? new Date(reminder.scheduledTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <Animated.View style={[cardStyle]}>
      <Pressable
        onPressIn={pressIn}
        onPressOut={pressOut}
        onPress={() => onTap?.(reminder)}
        onLongPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onEdit?.(reminder); }}
        style={[styles.card, Shadows.sm, !isOn && styles.cardOff]}
      >
        <View style={[styles.accent, { backgroundColor: isOn ? accentColor : Colors.border }]} />

        <View style={styles.body}>
          <View style={styles.topRow}>
            <Text style={[styles.text, !isOn && styles.textOff]} numberOfLines={2}>
              {reminder.text}
            </Text>
            <Switch
              value={isOn}
              onValueChange={handleToggle}
              trackColor={{ false: Colors.sea2, true: Colors.sea3 }}
              thumbColor={isOn ? Colors.seafoam : Colors.soft}
              ios_backgroundColor={Colors.sea2}
              style={{ transform: [{ scaleX: 0.85 }, { scaleY: 0.85 }] }}
            />
          </View>

          <View style={styles.metaRow}>
            {timeStr && (
              <View style={styles.chip}>
                <Feather name="clock" size={10} color={Colors.mid} />
                <Text style={styles.chipText}>{timeStr}</Text>
              </View>
            )}
            <View style={styles.chip}>
              <Feather name="refresh-cw" size={10} color={Colors.mid} />
              <Text style={styles.chipText}>{repeatText}</Text>
            </View>
            {reminder.mode && (
              <View style={[styles.chip, { borderColor: accentColor + '60', backgroundColor: accentColor + '15' }]}>
                <Text style={[styles.chipText, { color: accentColor }]}>{reminder.mode}</Text>
              </View>
            )}
            {reminder.escalation && (
              <View style={[styles.chip, { borderColor: Colors.coral + '60', backgroundColor: Colors.coral + '15' }]}>
                <Feather name="trending-up" size={10} color={Colors.coral} />
                <Text style={[styles.chipText, { color: Colors.coral }]}>Escalate</Text>
              </View>
            )}
          </View>
        </View>

        <Pressable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onDelete?.(reminder.id); }} style={styles.deleteBtn}>
          <Feather name="trash-2" size={14} color={Colors.soft} />
        </Pressable>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.white,
    borderRadius: Radii.lg,
    flexDirection: 'row',
    alignItems: 'stretch',
    marginBottom: 10,
    borderWidth: 0.5,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  cardOff: {
    opacity: 0.65,
  },
  accent: {
    width: 3,
    borderRadius: 0,
  },
  body: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 8,
  },
  text: {
    flex: 1,
    fontSize: 15,
    fontWeight: '400',
    color: Colors.ink,
    lineHeight: 21,
  },
  textOff: {
    color: Colors.mid,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radii.full,
    backgroundColor: Colors.sea,
    borderWidth: 0.5,
    borderColor: Colors.border,
  },
  chipText: {
    fontSize: 10,
    color: Colors.mid,
    letterSpacing: 0.3,
  },
  deleteBtn: {
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderLeftWidth: 0.5,
    borderLeftColor: Colors.borderLight,
  },
});
