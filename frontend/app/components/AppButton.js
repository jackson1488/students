/**
 * Module: app/components/AppButton.js
 *
 * Purpose:
 * - Reusable UI component module: AppButton.
 *
 * Module notes:
 * - Imports count: 3.
 * - This header is written for beginners: read purpose first, then function map below.
 *
 * Function map:
 * - AppButton: Main React component or UI container exported by this file.
 * - animatePressIn: Runs animation sequence for smoother UX feedback.
 * - animatePressOut: Runs animation sequence for smoother UX feedback.
 * - animateClickPulse: Runs animation sequence for smoother UX feedback.
 * - handlePress: Event handler for user actions and interactive flows.
 */

import React from "react";
import { ActivityIndicator, Animated, Easing, Pressable, StyleSheet, Text, View } from "react-native";

import { useThemeMode } from "../hooks/ThemeContext";

export default function AppButton({
  title,
  onPress,
  variant = "primary",
  disabled = false,
  loading = false,
  style,
  textStyle,
}) {
  const { theme } = useThemeMode();
  const scale = React.useRef(new Animated.Value(1)).current;
  const isDisabled = disabled || loading;

  const variants = {
    primary: {
      backgroundColor: theme.colors.primary,
      borderColor: theme.colors.primary,
      color: theme.colors.onPrimary,
    },
    secondary: {
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.border,
      color: theme.colors.text,
    },
    ghost: {
      backgroundColor: "transparent",
      borderColor: theme.colors.border,
      color: theme.colors.text,
    },
    danger: {
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.text,
      color: theme.colors.text,
    },
  };

  const current = variants[variant] || variants.primary;

  const animatePressIn = () => {
    if (isDisabled) return;
    Animated.timing(scale, {
      toValue: 0.965,
      duration: 80,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  };

  const animatePressOut = () => {
    if (isDisabled) return;
    Animated.spring(scale, {
      toValue: 1,
      speed: 24,
      bounciness: 6,
      useNativeDriver: true,
    }).start();
  };

  const animateClickPulse = () => {
    if (isDisabled) return;
    Animated.sequence([
      Animated.timing(scale, {
        toValue: 0.98,
        duration: 40,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1.03,
        speed: 34,
        bounciness: 7,
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1,
        speed: 28,
        bounciness: 5,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handlePress = (event) => {
    if (isDisabled) return;
    animateClickPulse();
    if (typeof onPress === "function") {
      onPress(event);
    }
  };

  return (
    <Pressable
      onPress={handlePress}
      onPressIn={animatePressIn}
      onPressOut={animatePressOut}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.pressableHitbox,
        { opacity: isDisabled ? 0.5 : pressed ? 0.9 : 1 },
      ]}
    >
      <Animated.View
        style={[
          styles.button,
          {
            backgroundColor: current.backgroundColor,
            borderColor: current.borderColor,
            transform: [{ scale }],
          },
          style,
        ]}
      >
        <View style={styles.content}>
          {loading ? (
            <ActivityIndicator size="small" color={current.color} style={styles.loader} />
          ) : null}
          <Text
            style={[
              styles.label,
              { color: current.color, fontFamily: theme.fonts.medium },
              textStyle,
            ]}
          >
            {title}
          </Text>
        </View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressableHitbox: {
    borderRadius: 10,
  },
  button: {
    borderWidth: 1,
    minHeight: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    paddingHorizontal: 14,
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  loader: {
    marginRight: 8,
  },
  label: {
    fontSize: 14,
    letterSpacing: 0.2,
  },
});
