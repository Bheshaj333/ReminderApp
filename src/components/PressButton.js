import React from 'react';
import { StyleSheet, Text, Pressable, View } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { Colors, Radii } from '../utils/theme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const VARIANTS = {
  primary: { bg: Colors.deep, text: Colors.white, border: Colors.deep },
  secondary: { bg: Colors.sea, text: Colors.deeper, border: Colors.sea2 },
  ghost: { bg: 'transparent', text: Colors.mid, border: Colors.border },
  danger: { bg: '#FDEDE8', text: Colors.coralDeep, border: '#F8D3C7' },
};

const SIZES = {
  sm: { height: 38, px: 14, fontSize: 13 },
  md: { height: 48, px: 18, fontSize: 15 },
  lg: { height: 56, px: 24, fontSize: 16 },
};

/**
 * Pill button with a spring press. Background, border and radius live on the same
 * element that scales, so there is never a square box behind a rounded button.
 */
export default function PressButton({
  label, onPress, variant = 'primary', size = 'md', icon, style, disabled,
}) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const v = VARIANTS[variant] || VARIANTS.primary;
  const s = SIZES[size] || SIZES.md;

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={() => { scale.value = withSpring(0.96, { damping: 15, stiffness: 320 }); }}
      onPressOut={() => { scale.value = withSpring(1, { damping: 12, stiffness: 260 }); }}
      disabled={disabled}
      style={[
        styles.btn,
        {
          height: s.height,
          paddingHorizontal: s.px,
          backgroundColor: v.bg,
          borderColor: v.border,
          opacity: disabled ? 0.45 : 1,
        },
        style,
        animStyle,
      ]}
    >
      <View style={styles.row}>
        {icon}
        <Text style={[styles.label, { fontSize: s.fontSize, color: v.text }]} numberOfLines={1}>
          {label}
        </Text>
      </View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    borderRadius: Radii.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  label: { fontWeight: '600', letterSpacing: 0.2 },
});
