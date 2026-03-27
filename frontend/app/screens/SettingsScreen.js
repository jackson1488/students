/**
 * Module: app/screens/SettingsScreen.js
 *
 * Purpose:
 * - Screen module for SettingsScreen. Handles state, data loading, and UI for this route.
 *
 * Module notes:
 * - Imports count: 8.
 * - This header is written for beginners: read purpose first, then function map below.
 *
 * Function map:
 * - SettingsScreen: Main React component or UI container exported by this file.
 * - openChangePassword: Controls modal/sheet/screen visibility or navigation transition.
 * - openSupport: Controls modal/sheet/screen visibility or navigation transition.
 */

import React from "react";
import { Alert, Platform, StyleSheet, Text, View } from "react-native";

import AppButton from "../components/AppButton";
import AppCard from "../components/AppCard";
import ScreenLayout from "../components/ScreenLayout";
import { useAuth } from "../hooks/AuthContext";
import { useI18n } from "../hooks/I18nContext";
import { useThemeMode } from "../hooks/ThemeContext";

export default function SettingsScreen({ navigation }) {
  const { t, language, availableLanguages, setLanguage } = useI18n();
  const { mode, setThemeMode, theme } = useThemeMode();
  const { isImpersonating, restoreAdminSession, signOut } = useAuth();

  const openChangePassword = () => {
    try {
      navigation.navigate("ChangePassword");
    } catch {
      Alert.alert(t("settings"), t("unknownError"));
    }
  };

  const openSupport = () => {
    try {
      navigation.navigate("Support");
    } catch {
      Alert.alert(t("settings"), t("unknownError"));
    }
  };

  return (
    <ScreenLayout>
      {Platform.OS === "web" ? (
        <Text style={[styles.title, { color: theme.colors.text, fontFamily: theme.fonts.bold }]}>
          {t("settings")}
        </Text>
      ) : null}

      <AppCard>
        <Text style={[styles.sectionTitle, { color: theme.colors.text, fontFamily: theme.fonts.bold }]}> 
          {t("appearance")}
        </Text>
        <Text style={[styles.subLabel, { color: theme.colors.textMuted, fontFamily: theme.fonts.medium }]}>
          {t("theme")}
        </Text>
        <View style={styles.rowWrap}>
          <AppButton
            title={t("lightTheme")}
            onPress={() => setThemeMode("light")}
            variant={mode === "light" ? "primary" : "ghost"}
            style={styles.smallBtn}
          />
          <AppButton
            title={t("darkTheme")}
            onPress={() => setThemeMode("dark")}
            variant={mode === "dark" ? "primary" : "ghost"}
            style={styles.smallBtn}
          />
        </View>

        <Text style={[styles.subLabel, { color: theme.colors.textMuted, fontFamily: theme.fonts.medium }]}>
          {t("language")}
        </Text>
        <View style={styles.rowWrap}>
          {availableLanguages.map((lang) => (
            <AppButton
              key={lang}
              title={lang.toUpperCase()}
              onPress={() => setLanguage(lang)}
              variant={language === lang ? "primary" : "ghost"}
              style={styles.smallBtn}
            />
          ))}
        </View>
      </AppCard>

      <AppCard>
        <Text style={[styles.sectionTitle, { color: theme.colors.text, fontFamily: theme.fonts.bold }]}> 
          {t("account")}
        </Text>
        <AppButton title={t("openChangePassword")} onPress={openChangePassword} />
        {isImpersonating ? (
          <AppButton title={t("returnToAdmin")} onPress={restoreAdminSession} variant="secondary" style={styles.returnBtn} />
        ) : null}
      </AppCard>

      <AppCard>
        <Text style={[styles.sectionTitle, { color: theme.colors.text, fontFamily: theme.fonts.bold }]}> 
          {t("support")}
        </Text>
        <AppButton title={t("openSupport")} onPress={openSupport} variant="secondary" />
      </AppCard>

      <AppButton title={t("logout")} onPress={signOut} variant="secondary" />
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 22,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 17,
    marginBottom: 12,
  },
  subLabel: {
    fontSize: 12,
    marginBottom: 6,
  },
  rowWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 10,
  },
  smallBtn: {
    minHeight: 36,
    paddingHorizontal: 14,
  },
  returnBtn: {
    marginTop: 8,
  },
});
