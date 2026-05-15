import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { Pressable } from 'react-native';
import { Colors, Radii, Typography } from '../utils/theme';

export default function PressButton({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  icon,
  style,
  labelStyle,
  disabled,
}) {
  const scale = useSharedValue(1);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.96, { damping: 15, stiffness: 300 });
  };
  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 300 });
  };

  const variantStyles = {
    primary: { bg: Colors.seafoam, text: Colors.white, border: Colors.seafoam },
    secondary: { bg: Colors.sea, text: Colors.deep, border: Colors.sea3 },
    ghost: { bg: 'transparent', text: Colors.mid, border: Colors.border },
    danger: { bg: Colors.coral, text: Colors.white, border: Colors.coral },
    jasmine: { bg: Colors.jasmine2, text: Colors.ink, border: Colors.jasmine3 },
  };

  const sizeStyles = {
    sm: { py: 8, px: 14, fontSize: 12, radius: Radii.sm },
    md: { py: 12, px: 20, fontSize: 14, radius: Radii.md },
    lg: { py: 16, px: 28, fontSize: 16, radius: Radii.lg },
  };

  const vs = variantStyles[variant] || variantStyles.primary;
  const ss = sizeStyles[size] || sizeStyles.md;

  return (
    <Animated.View style={[animStyle, style]}>
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled}
        style={[
          styles.btn,
          {
            backgroundColor: disabled ? Colors.sea2 : vs.bg,
            borderColor: disabled ? Colors.border : vs.border,
            paddingVertical: ss.py,
            paddingHorizontal: ss.px,
            borderRadius: ss.radius,
          },
        ]}
      >
        <View style={styles.row}>
          {icon && <View style={styles.iconWrap}>{icon}</View>}
          <Text
            style={[
              styles.label,
              {
                fontSize: ss.fontSize,
                color: disabled ? Colors.soft : vs.text,
              },
              labelStyle,
            ]}
          >
            {label}
          </Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  btn: {
    borderWidth: 0.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  label: {
    fontWeight: Typography.weights.medium,
    letterSpacing: 0.3,
  },
  iconWrap: {
    marginRight: 2,
  },
});
