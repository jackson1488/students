/**
 * Module: app/screens/ChangePasswordScreen.js
 *
 * Purpose:
 * - Screen module for ChangePasswordScreen. Handles state, data loading, and UI for this route.
 *
 * Module notes:
 * - Imports count: 9.
 * - This header is written for beginners: read purpose first, then function map below.
 *
 * Function map:
 * - ChangePasswordScreen: Main React component or UI container exported by this file.
 * - onChangePassword: Callback function invoked by UI or navigation events.
 */

import React, { useState } from "react";
import { Alert, Platform, StyleSheet, Text } from "react-native";

import AppButton from "../components/AppButton";
import AppCard from "../components/AppCard";
import AppInput from "../components/AppInput";
import ScreenLayout from "../components/ScreenLayout";
import { useI18n } from "../hooks/I18nContext";
import { useThemeMode } from "../hooks/ThemeContext";
import { changePasswordRequest } from "../services/authService";

export default function ChangePasswordScreen({ navigation }) {
  const { t } = useI18n();
  const { theme } = useThemeMode();

  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const onChangePassword = async () => {
    if (!oldPassword.trim() || !newPassword.trim() || !confirmPassword.trim()) return;
    if (newPassword !== confirmPassword) {
      Alert.alert(t("changePassword"), t("passwordMismatch"));
      return;
    }

    setLoading(true);
    try {
      await changePasswordRequest({ oldPassword, newPassword });
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
      Alert.alert(t("changePassword"), t("passwordChanged"));
      navigation.goBack();
    } catch (error) {
      Alert.alert(t("changePassword"), error?.response?.data?.error || t("unknownError"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenLayout>
      {Platform.OS === "web" ? (
        <Text style={[styles.title, { color: theme.colors.text, fontFamily: theme.fonts.bold }]}>
          {t("changePassword")}
        </Text>
      ) : null}

      <AppCard>
        <AppInput
          label={t("oldPassword")}
          value={oldPassword}
          onChangeText={setOldPassword}
          secureTextEntry
        />
        <AppInput
          label={t("newPassword")}
          value={newPassword}
          onChangeText={setNewPassword}
          secureTextEntry
        />
        <AppInput
          label={t("confirmPassword")}
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
        />

        <AppButton title={t("save")} onPress={onChangePassword} loading={loading} />
      </AppCard>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 22,
    marginBottom: 12,
  },
});
