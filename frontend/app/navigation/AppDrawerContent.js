/**
 * Module: app/navigation/AppDrawerContent.js
 *
 * Purpose:
 * - Renders custom drawer/sidebar content and shortcuts.
 *
 * Module notes:
 * - Imports count: 8.
 * - This header is written for beginners: read purpose first, then function map below.
 *
 * Function map:
 * - AppDrawerContent: Main React component or UI container exported by this file.
 */

import React from "react";
import { DrawerContentScrollView, DrawerItemList } from "@react-navigation/drawer";
import { StyleSheet, Text, View } from "react-native";

import { useAuth } from "../hooks/AuthContext";
import { useI18n } from "../hooks/I18nContext";
import { useThemeMode } from "../hooks/ThemeContext";
import AppButton from "../components/AppButton";
import BrandLogo from "../components/BrandLogo";

export default function AppDrawerContent(props) {
  const { t } = useI18n();
  const { theme } = useThemeMode();
  const { role, login, fullName, groupId, isImpersonating, restoreAdminSession, signOut } = useAuth();
  const isTeacherOrStudent = role === "teacher" || role === "student";
  const primaryLine = isTeacherOrStudent ? (fullName || login || "-") : (login || "-");
  const secondaryLine = isTeacherOrStudent
    ? (groupId ? `${t("groupName")}: ${groupId}` : "")
    : t(role || "student");

  return (
    <DrawerContentScrollView
      {...props}
      contentContainerStyle={[styles.container, { backgroundColor: theme.colors.sidebar }]}
    >
      <View style={[styles.header, { borderColor: theme.colors.border }]}>
        <BrandLogo size={36} />
        <Text style={[styles.meta, { color: theme.colors.textMuted }]}>{primaryLine}</Text>
        {secondaryLine ? (
          <Text style={[styles.meta, { color: theme.colors.textMuted }]}>{secondaryLine}</Text>
        ) : null}
      </View>

      <DrawerItemList {...props} />

      <View style={styles.footer}>
        {isImpersonating ? (
          <>
            <Text style={[styles.meta, { color: theme.colors.textMuted }]}>{t("impersonationActive")}</Text>
            <AppButton title={t("returnToAdmin")} onPress={restoreAdminSession} variant="secondary" />
          </>
        ) : null}
        <AppButton title={t("logout")} onPress={signOut} variant="secondary" />
      </View>
    </DrawerContentScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "space-between",
  },
  header: {
    borderBottomWidth: 1,
    marginBottom: 10,
    paddingHorizontal: 12,
    paddingBottom: 12,
    paddingTop: 8,
  },
  meta: {
    marginTop: 4,
    fontSize: 12,
    fontFamily: "serif",
  },
  footer: {
    marginTop: 14,
    paddingHorizontal: 12,
    paddingBottom: 20,
    gap: 8,
  },
});
