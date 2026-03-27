/**
 * Module: app/components/AppInput.js
 *
 * Purpose:
 * - Reusable UI component module: AppInput.
 *
 * Module notes:
 * - Imports count: 3.
 * - This header is written for beginners: read purpose first, then function map below.
 *
 * Function map:
 * - AppInput: Main React component or UI container exported by this file.
 */

import React from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";

import { useThemeMode } from "../hooks/ThemeContext";

export default function AppInput({
  label,
  style,
  inputStyle,
  rightElement,
  hasError = false,
  ...props
}) {
  const { theme } = useThemeMode();

  return (
    <View style={[styles.container, style]}>
      {label ? (
        <Text style={[styles.label, { color: theme.colors.text, fontFamily: theme.fonts.medium }]}>
          {label}
        </Text>
      ) : null}
      <View style={styles.inputWrap}>
        <TextInput
          placeholderTextColor={theme.colors.textMuted}
          {...props}
          style={[
            styles.input,
            {
              color: theme.colors.text,
              backgroundColor: theme.colors.surface,
              borderColor: hasError ? "#D32F2F" : theme.colors.border,
              fontFamily: theme.fonts.regular,
            },
            rightElement ? styles.inputWithRightElement : null,
            inputStyle,
          ]}
        />
        {rightElement ? <View style={styles.rightElement}>{rightElement}</View> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 10,
  },
  label: {
    fontSize: 13,
    marginBottom: 6,
  },
  inputWrap: {
    position: "relative",
  },
  input: {
    minHeight: 42,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  inputWithRightElement: {
    paddingRight: 50,
  },
  rightElement: {
    position: "absolute",
    right: 10,
    top: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
  },
});
