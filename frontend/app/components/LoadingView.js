/**
 * Module: app/components/LoadingView.js
 *
 * Purpose:
 * - Reusable UI component module: LoadingView.
 *
 * Module notes:
 * - Imports count: 4.
 * - This header is written for beginners: read purpose first, then function map below.
 *
 * Function map:
 * - LoadingView: Main React component or UI container exported by this file.
 */

import React from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { useI18n } from "../hooks/I18nContext";
import { useThemeMode } from "../hooks/ThemeContext";

export default function LoadingView() {
  const { theme } = useThemeMode();
  const { t } = useI18n();

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ActivityIndicator color={theme.colors.text} size="small" />
      <Text style={[styles.label, { color: theme.colors.textMuted }]}>{t("loading")}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    marginTop: 10,
    fontSize: 13,
    fontFamily: "serif",
  },
});
