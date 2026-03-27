/**
 * Module: app/components/ScreenLayout.js
 *
 * Purpose:
 * - Reusable UI component module: ScreenLayout.
 *
 * Module notes:
 * - Imports count: 4.
 * - This header is written for beginners: read purpose first, then function map below.
 *
 * Function map:
 * - ScreenLayout: Main React component or UI container exported by this file.
 */

import React from "react";
import { KeyboardAvoidingView, Platform, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useThemeMode } from "../hooks/ThemeContext";

export default function ScreenLayout({
  children,
  scroll = true,
  contentContainerStyle,
  onRefresh,
  refreshing = false,
  avoidKeyboard = true,
  keyboardVerticalOffset = 0,
}) {
  const { theme } = useThemeMode();
  const canUsePullToRefresh = Platform.OS !== "web" && typeof onRefresh === "function";

  const content = scroll ? (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={[styles.content, contentContainerStyle]}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
      automaticallyAdjustKeyboardInsets={Platform.OS === "ios"}
      showsVerticalScrollIndicator={false}
      refreshControl={
        canUsePullToRefresh ? (
          <RefreshControl
            refreshing={Boolean(refreshing)}
            onRefresh={onRefresh}
            tintColor={theme.colors.text}
            colors={[theme.colors.text]}
          />
        ) : undefined
      }
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.content, contentContainerStyle]}>{children}</View>
  );

  return (
    <SafeAreaView
      style={[
        styles.flex,
        {
          backgroundColor: theme.colors.background,
          paddingTop: Platform.OS === "web" ? 0 : 2,
        },
      ]}
    >
      {avoidKeyboard && Platform.OS !== "web" ? (
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={keyboardVerticalOffset}
        >
          {content}
        </KeyboardAvoidingView>
      ) : (
        content
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  content: {
    padding: 14,
  },
});
