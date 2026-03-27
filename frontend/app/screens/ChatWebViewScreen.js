/**
 * Module: app/screens/ChatWebViewScreen.js
 *
 * Purpose:
 * - Screen module for ChatWebViewScreen. Handles state, data loading, and UI for this route.
 *
 * Module notes:
 * - Imports count: 6.
 * - This header is written for beginners: read purpose first, then function map below.
 *
 * Function map:
 * - ChatWebViewScreen: Main React component or UI container exported by this file.
 * - normalizeUrl: Transforms input/output values to stable display or API format.
 * - url: Helper function used by this module business logic.
 */

import React, { useLayoutEffect, useMemo } from "react";
import { Platform, StyleSheet, Text } from "react-native";
import { WebView } from "react-native-webview";

import ScreenLayout from "../components/ScreenLayout";
import { useI18n } from "../hooks/I18nContext";
import { useThemeMode } from "../hooks/ThemeContext";

function normalizeUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;
  return `https://${raw}`;
}

export default function ChatWebViewScreen({ navigation, route }) {
  const { t } = useI18n();
  const { theme } = useThemeMode();

  const url = useMemo(() => normalizeUrl(route?.params?.url), [route?.params?.url]);
  const title = String(route?.params?.title || t("chatLink")).trim();

  useLayoutEffect(() => {
    navigation.setOptions({ title });
  }, [navigation, title]);

  if (!url) {
    return (
      <ScreenLayout>
        <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fonts.regular }}>{t("noData")}</Text>
      </ScreenLayout>
    );
  }

  if (Platform.OS === "web") {
    return (
      <ScreenLayout>
        <Text style={{ color: theme.colors.text, fontFamily: theme.fonts.regular, marginBottom: 8 }}>{url}</Text>
        <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fonts.regular }}>{t("openInBrowserFromWeb")}</Text>
      </ScreenLayout>
    );
  }

  return (
    <ScreenLayout scroll={false} contentContainerStyle={styles.full}>
      <WebView source={{ uri: url }} style={styles.full} startInLoadingState />
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  full: {
    flex: 1,
    padding: 0,
  },
});
