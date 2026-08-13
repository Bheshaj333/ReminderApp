import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { Colors } from '../utils/theme';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const STROKE = 10;

export default function PomodoroRing({ progress = 0, phase = 'focus', size = 230, color }) {
  const animProgress = useSharedValue(progress);

  useEffect(() => {
    animProgress.value = withTiming(progress, {
      duration: 600,
      easing: Easing.out(Easing.cubic),
    });
  }, [progress]);

  const strokeColor = color || (phase === 'focus' ? Colors.seafoam : phase === 'break' ? Colors.jasmine3 : Colors.petalDeep);

  const radius = (size - STROKE) / 2;
  const circumference = 2 * Math.PI * radius;

  const animProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - animProgress.value),
  }));

  return (
    <View style={[styles.ring, { width: size, height: size }]}>
      <Svg width={size} height={size} style={styles.svg}>
        {/* Background Track */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={Colors.sea2}
          strokeWidth={STROKE}
          strokeOpacity={0.6}
        />
        {/* Progress Track */}
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={strokeColor}
          strokeWidth={STROKE}
          strokeDasharray={circumference}
          animatedProps={animProps}
          strokeLinecap="round"
          rotation="-90"
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  ring: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  svg: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
});
