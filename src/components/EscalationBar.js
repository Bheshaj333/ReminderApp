import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
} from 'react-native-reanimated';
import { Colors, Typography } from '../utils/theme';

const STEPS = ['0s', '30s', '60s', '90s', 'Full'];

export default function EscalationBar({ currentStep = 2 }) {
  return (
    <View>
      <View style={styles.track}>
        {STEPS.map((_, i) => (
          <EscStep key={i} index={i} currentStep={currentStep} total={STEPS.length} />
        ))}
      </View>
      <View style={styles.labels}>
        {STEPS.map((label, i) => (
          <Text
            key={i}
            style={[
              styles.label,
              i <= currentStep && { color: Colors.seafoam },
              i === currentStep && { color: Colors.seafoamDeep, fontWeight: '600' },
            ]}
          >
            {label}
          </Text>
        ))}
      </View>
    </View>
  );
}

function EscStep({ index, currentStep, total }) {
  const opacity = useSharedValue(1);

  const isActive = index === currentStep;
  const isDone = index < currentStep;

  useEffect(() => {
    if (isActive) {
      opacity.value = withRepeat(
        withSequence(
          withTiming(0.4, { duration: 700 }),
          withTiming(1, { duration: 700 })
        ),
        -1,
        false
      );
    } else {
      opacity.value = withTiming(1, { duration: 300 });
    }
  }, [isActive]);

  const animStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  const bg = isDone
    ? Colors.sea3
    : isActive
    ? Colors.seafoam
    : Colors.border;

  return (
    <Animated.View
      style={[
        styles.seg,
        { backgroundColor: bg, flex: 1 },
        animStyle,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    gap: 4,
    marginBottom: 5,
  },
  seg: {
    height: 3,
    borderRadius: 2,
  },
  labels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  label: {
    fontSize: 9,
    color: Colors.soft,
    letterSpacing: 0.5,
    flex: 1,
    textAlign: 'center',
  },
});
