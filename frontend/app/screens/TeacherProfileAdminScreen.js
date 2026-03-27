/**
 * Module: app/screens/TeacherProfileAdminScreen.js
 *
 * Purpose:
 * - Screen module for TeacherProfileAdminScreen. Handles state, data loading, and UI for this route.
 *
 * Module notes:
 * - Imports count: 12.
 * - This header is written for beginners: read purpose first, then function map below.
 *
 * Function map:
 * - TeacherProfileAdminScreen: Main React component or UI container exported by this file.
 * - resolveMediaUrl: Builds derived values and resolves runtime decisions.
 * - subjectsToCsv: Helper function used by this module business logic.
 * - csvToSubjects: Helper function used by this module business logic.
 * - onSave: Callback function invoked by UI or navigation events.
 * - onDelete: Callback function invoked by UI or navigation events.
 * - avatarPreview: Helper function used by this module business logic.
 * - hydrate: Helper function used by this module business logic.
 * - load: Loads remote/local data and updates screen/component state.
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Image, StyleSheet, Text, View } from "react-native";

import AppButton from "../components/AppButton";
import AppCard from "../components/AppCard";
import AppInput from "../components/AppInput";
import BirthDateField from "../components/BirthDateField";
import ScreenLayout from "../components/ScreenLayout";
import { useI18n } from "../hooks/I18nContext";
import { useThemeMode } from "../hooks/ThemeContext";
import { API_BASE_URL } from "../services/api";
import { fetchTeacherById, updateTeacher } from "../services/academyService";
import { removeUser } from "../services/usersService";

function resolveMediaUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;
  if (raw.startsWith("/")) return `${API_BASE_URL}${raw}`;
  return raw;
}

function subjectsToCsv(items) {
  if (!Array.isArray(items)) return "";
  return items.map((item) => String(item || "").trim()).filter(Boolean).join(", ");
}

function csvToSubjects(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export default function TeacherProfileAdminScreen({ navigation, route }) {
  const { t } = useI18n();
  const { theme } = useThemeMode();

  const teacherId = Number(route?.params?.teacherId || 0);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [lastName, setLastName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [login, setLogin] = useState("");
  const [subjectsCsv, setSubjectsCsv] = useState("");
  const [password, setPassword] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [biography, setBiography] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");

  const avatarPreview = useMemo(() => resolveMediaUrl(avatarUrl), [avatarUrl]);

  const hydrate = useCallback((data) => {
    setLastName(data?.last_name || "");
    setFirstName(data?.first_name || "");
    setMiddleName(data?.middle_name || "");
    setLogin(data?.login || "");
    setSubjectsCsv(subjectsToCsv(data?.subjects || []));
    setPassword("");
    setBirthDate(data?.birth_date || "");
    setBiography(data?.biography || "");
    setAvatarUrl(data?.avatar_url || "");
  }, []);

  const load = useCallback(async () => {
    if (!teacherId) return;
    setLoading(true);
    try {
      const data = await fetchTeacherById(teacherId);
      hydrate(data);
    } catch (error) {
      Alert.alert(t("users"), error?.response?.data?.error || t("unknownError"));
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  }, [hydrate, navigation, t, teacherId]);

  useEffect(() => {
    load();
  }, [load]);

  const onSave = async () => {
    const subjects = csvToSubjects(subjectsCsv);
    if (!lastName.trim() || !firstName.trim() || !login.trim() || !subjects.length) return;

    setSaving(true);
    try {
      const payload = {
        last_name: lastName.trim(),
        first_name: firstName.trim(),
        middle_name: middleName.trim() || null,
        login: login.trim().toLowerCase(),
        subjects,
        birth_date: String(birthDate || "").trim(),
        biography: String(biography || "").trim(),
        avatar_url: String(avatarUrl || "").trim() || null,
      };

      if (password.trim()) {
        payload.password = password.trim();
      }

      const updated = await updateTeacher(teacherId, payload);
      hydrate(updated);
    } catch (error) {
      Alert.alert(t("users"), error?.response?.data?.error || t("unknownError"));
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async () => {
    setDeleting(true);
    try {
      await removeUser(teacherId);
      navigation.goBack();
    } catch (error) {
      Alert.alert(t("users"), error?.response?.data?.error || t("unknownError"));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <ScreenLayout onRefresh={load} refreshing={loading}>
      <AppCard>
        <View style={styles.avatarHead}>
          <View style={[styles.avatarWrap, { borderColor: theme.colors.border, backgroundColor: theme.colors.rowAlt }]}> 
            {avatarPreview ? (
              <Image source={{ uri: avatarPreview }} style={styles.avatarImage} resizeMode="cover" />
            ) : (
              <Text style={[styles.avatarFallback, { color: theme.colors.text, fontFamily: theme.fonts.bold }]}>
                {String((lastName || login || "T").trim()).slice(0, 1).toUpperCase()}
              </Text>
            )}
          </View>
          <Text style={[styles.cardName, { color: theme.colors.text, fontFamily: theme.fonts.bold }]}>
            {`${lastName} ${firstName}`.trim() || login || "-"}
          </Text>
        </View>
      </AppCard>

      <AppCard>
        <AppInput label={t("lastName")} value={lastName} onChangeText={setLastName} />
        <AppInput label={t("firstName")} value={firstName} onChangeText={setFirstName} />
        <AppInput label={t("middleName")} value={middleName} onChangeText={setMiddleName} />
        <AppInput label={t("customLogin")} value={login} onChangeText={setLogin} autoCapitalize="none" autoCorrect={false} />
        <AppInput label={t("subjects")} value={subjectsCsv} onChangeText={setSubjectsCsv} placeholder={t("subjectsCsvHint")} />
        <AppInput
          label={t("newPassword")}
          value={password}
          onChangeText={setPassword}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder={t("passwordMin4")}
        />
        <BirthDateField
          label={t("birthDate")}
          value={birthDate || ""}
          onChangeText={setBirthDate}
          maximumDate={new Date()}
        />
        <AppInput
          label={t("biography")}
          value={biography}
          onChangeText={setBiography}
          placeholder={t("biographyPlaceholder")}
          multiline
          inputStyle={styles.bioInput}
        />
        <AppInput label={t("avatarUrl")} value={avatarUrl} onChangeText={setAvatarUrl} placeholder="https://..." />

        <View style={styles.actionsRow}>
          <AppButton title={t("save")} onPress={onSave} loading={saving} style={styles.actionButton} />
          <AppButton title={t("delete")} onPress={onDelete} loading={deleting} variant="ghost" style={styles.actionButton} />
        </View>
      </AppCard>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  avatarHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  avatarWrap: {
    width: 74,
    height: 74,
    borderRadius: 37,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarImage: {
    width: "100%",
    height: "100%",
  },
  avatarFallback: {
    fontSize: 30,
  },
  cardName: {
    fontSize: 20,
    flex: 1,
  },
  bioInput: {
    minHeight: 100,
    textAlignVertical: "top",
  },
  actionsRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 6,
  },
  actionButton: {
    flex: 1,
  },
});
