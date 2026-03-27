/**
 * Module: app/components/AppCard.js
 *
 * Purpose:
 * - Reusable UI component module: AppCard.
 *
 * Module notes:
 * - Imports count: 3.
 * - This header is written for beginners: read purpose first, then function map below.
 *
 * Function map:
 * - AppCard: Main React component or UI container exported by this file.
 */

import React from "react";
import { StyleSheet, View } from "react-native";

import { useThemeMode } from "../hooks/ThemeContext";

export default function AppCard({ children, style }) {
  const { theme } = useThemeMode();

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.border,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
  },
});
