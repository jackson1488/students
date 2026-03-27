/**
 * Module: app/screens/StudentProfileAdminScreen.js
 *
 * Purpose:
 * - Screen module for StudentProfileAdminScreen. Handles state, data loading, and UI for this route.
 *
 * Module notes:
 * - Imports count: 12.
 * - This header is written for beginners: read purpose first, then function map below.
 *
 * Function map:
 * - StudentProfileAdminScreen: Main React component or UI container exported by this file.
 * - resolveMediaUrl: Builds derived values and resolves runtime decisions.
 * - calculateCourse: Helper function used by this module business logic.
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
import { fetchGroups, fetchStudentById, updateStudent } from "../services/academyService";
import { removeUser } from "../services/usersService";

function resolveMediaUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;
  if (raw.startsWith("/")) return `${API_BASE_URL}${raw}`;
  return raw;
}

function calculateCourse(admissionYear) {
  const year = Number(admissionYear);
  if (!Number.isInteger(year) || year <= 0) return "-";

  const now = new Date();
  let course = now.getFullYear() - year;
  if (now.getMonth() >= 8) {
    course += 1;
  }

  return String(Math.max(1, Math.min(6, course)));
}

export default function StudentProfileAdminScreen({ navigation, route }) {
  const { t } = useI18n();
  const { theme } = useThemeMode();

  const studentId = Number(route?.params?.studentId || 0);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [groups, setGroups] = useState([]);

  const [lastName, setLastName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [login, setLogin] = useState("");
  const [studentCode, setStudentCode] = useState("");
  const [password, setPassword] = useState("");
  const [groupRefId, setGroupRefId] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [biography, setBiography] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");

  const avatarPreview = useMemo(() => resolveMediaUrl(avatarUrl), [avatarUrl]);
  const selectedGroup = useMemo(
    () => groups.find((item) => Number(item.id) === Number(groupRefId)),
    [groupRefId, groups]
  );

  const hydrate = useCallback((data) => {
    setLastName(data?.last_name || "");
    setFirstName(data?.first_name || "");
    setMiddleName(data?.middle_name || "");
    setLogin(data?.login || "");
    setStudentCode(data?.student_code || "");
    setPassword("");
    setGroupRefId(data?.group_ref_id ? String(data.group_ref_id) : "");
    setBirthDate(data?.birth_date || "");
    setBiography(data?.biography || "");
    setAvatarUrl(data?.avatar_url || "");
  }, []);

  const load = useCallback(async () => {
    if (!studentId) return;

    setLoading(true);
    try {
      const [studentData, groupsData] = await Promise.all([fetchStudentById(studentId), fetchGroups()]);
      hydrate(studentData);
      setGroups(Array.isArray(groupsData) ? groupsData : []);
    } catch (error) {
      Alert.alert(t("users"), error?.response?.data?.error || t("unknownError"));
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  }, [hydrate, navigation, studentId, t]);

  useEffect(() => {
    load();
  }, [load]);

  const onSave = async () => {
    if (!lastName.trim() || !firstName.trim() || !login.trim() || !groupRefId) return;

    setSaving(true);
    try {
      const payload = {
        last_name: lastName.trim(),
        first_name: firstName.trim(),
        middle_name: middleName.trim() || null,
        login: login.trim().toLowerCase(),
        group_id: Number(groupRefId),
        birth_date: String(birthDate || "").trim(),
        biography: String(biography || "").trim(),
        avatar_url: String(avatarUrl || "").trim() || null,
      };

      if (password.trim()) {
        payload.password = password.trim();
      }

      const updated = await updateStudent(studentId, payload);
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
      await removeUser(studentId);
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
                {String((lastName || login || "S").trim()).slice(0, 1).toUpperCase()}
              </Text>
            )}
          </View>
          <View style={styles.headMeta}>
            <Text style={[styles.cardName, { color: theme.colors.text, fontFamily: theme.fonts.bold }]}>
              {`${lastName} ${firstName}`.trim() || login || "-"}
            </Text>
            <Text style={[styles.cardSub, { color: theme.colors.textMuted, fontFamily: theme.fonts.regular }]}>@{login || "-"}</Text>
            <Text style={[styles.cardSub, { color: theme.colors.textMuted, fontFamily: theme.fonts.regular }]}>
              {t("studentId")}: {studentCode || "-"}
            </Text>
            <Text style={[styles.cardSub, { color: theme.colors.textMuted, fontFamily: theme.fonts.regular }]}>
              {t("course")}: {calculateCourse(selectedGroup?.admission_year)}
            </Text>
          </View>
        </View>
      </AppCard>

      <AppCard>
        <AppInput label={t("lastName")} value={lastName} onChangeText={setLastName} />
        <AppInput label={t("firstName")} value={firstName} onChangeText={setFirstName} />
        <AppInput label={t("middleName")} value={middleName} onChangeText={setMiddleName} />
        <AppInput label={t("customLogin")} value={login} onChangeText={setLogin} autoCapitalize="none" autoCorrect={false} />
        <AppInput
          label={t("newPassword")}
          value={password}
          onChangeText={setPassword}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder={t("passwordMin4")}
        />

        <Text style={[styles.label, { color: theme.colors.text, fontFamily: theme.fonts.medium }]}>{t("groupName")}</Text>
        <View style={styles.groupWrap}>
          {groups.map((group) => (
            <AppButton
              key={String(group.id)}
              title={`${group.name}`}
              variant={Number(groupRefId) === Number(group.id) ? "primary" : "ghost"}
              onPress={() => setGroupRefId(String(group.id))}
              style={styles.groupBtn}
            />
          ))}
        </View>

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
  headMeta: {
    flex: 1,
  },
  cardName: {
    fontSize: 20,
    marginBottom: 2,
  },
  cardSub: {
    fontSize: 12,
  },
  label: {
    fontSize: 13,
    marginBottom: 6,
  },
  groupWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 10,
  },
  groupBtn: {
    minHeight: 34,
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
