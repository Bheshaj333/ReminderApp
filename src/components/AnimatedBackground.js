import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  interpolateColor,
  Easing,
} from 'react-native-reanimated';
import { Colors } from '../utils/theme';

export default function AnimatedBackground({ style, children, variant = 'ocean' }) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(
      withTiming(1, { duration: 6000 }),
      -1,
      true
    );
  }, []);

  const palettes = {
    ocean: [Colors.sea, Colors.mist],
    jasmine: [Colors.jasmine, Colors.mist],
    deep: [Colors.sea2, Colors.sea],
  };

  const [from, to] = palettes[variant] || palettes.ocean;

  const animStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.value, [0, 1], [from, to]),
  }));

  return (
    <Animated.View style={[styles.root, animStyle, style]}>
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
