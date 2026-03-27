/**
 * Module: app/screens/ProfileDetailsScreen.js
 *
 * Purpose:
 * - Screen module for ProfileDetailsScreen. Handles state, data loading, and UI for this route.
 *
 * Module notes:
 * - Imports count: 12.
 * - This header is written for beginners: read purpose first, then function map below.
 *
 * Function map:
 * - ProfileDetailsScreen: Main React component or UI container exported by this file.
 * - resolveMediaUrl: Builds derived values and resolves runtime decisions.
 * - calculateCourse: Helper function used by this module business logic.
 * - extractStudentCode: Helper function used by this module business logic.
 * - DataRow: Main React component or UI container exported by this file.
 * - onSave: Callback function invoked by UI or navigation events.
 * - load: Loads remote/local data and updates screen/component state.
 * - avatarUri: Helper function used by this module business logic.
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Image, StyleSheet, Text, View } from "react-native";

import AppButton from "../components/AppButton";
import AppCard from "../components/AppCard";
import AppInput from "../components/AppInput";
import BirthDateField from "../components/BirthDateField";
import ScreenLayout from "../components/ScreenLayout";
import { useAuth } from "../hooks/AuthContext";
import { useI18n } from "../hooks/I18nContext";
import { useThemeMode } from "../hooks/ThemeContext";
import { API_BASE_URL } from "../services/api";
import { fetchMyDetails, updateMyDetails } from "../services/usersService";

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

function extractStudentCode(loginValue) {
  const raw = String(loginValue || "").trim();
  if (!raw) return "";
  const parts = raw.split("-");
  const tail = parts[parts.length - 1] || "";
  return /^\d+$/.test(tail) ? tail : "";
}

function DataRow({ label, value, theme }) {
  return (
    <View style={styles.dataRow}>
      <Text style={[styles.dataLabel, { color: theme.colors.textMuted, fontFamily: theme.fonts.regular }]}>{label}</Text>
      <Text style={[styles.dataValue, { color: theme.colors.text, fontFamily: theme.fonts.medium }]}>{value || "-"}</Text>
    </View>
  );
}

export default function ProfileDetailsScreen() {
  const { t } = useI18n();
  const { theme } = useThemeMode();
  const { role, login, fullName, avatarUrl, groupId } = useAuth();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [details, setDetails] = useState({});
  const [studentCode, setStudentCode] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [biography, setBiography] = useState("");

  const isTeacherOrStudent = role === "teacher" || role === "student";

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const payload = await fetchMyDetails();
      const nextDetails = payload?.details || {};
      setDetails(nextDetails);
      setStudentCode(payload?.student_code || extractStudentCode(payload?.login));
      setBirthDate(nextDetails?.birth_date || "");
      setBiography(nextDetails?.biography || "");
    } catch (error) {
      Alert.alert(t("profile"), error?.response?.data?.error || t("unknownError"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  const avatarUri = useMemo(() => resolveMediaUrl(avatarUrl), [avatarUrl]);

  const onSave = async () => {
    if (!isTeacherOrStudent) return;

    setSaving(true);
    try {
      const payload = {
        birth_date: String(birthDate || "").trim(),
        biography: String(biography || "").trim(),
      };
      const updated = await updateMyDetails(payload);
      const nextDetails = updated?.details || {};
      setDetails(nextDetails);
      setStudentCode(updated?.student_code || extractStudentCode(updated?.login));
      setBirthDate(nextDetails?.birth_date || "");
      setBiography(nextDetails?.biography || "");
    } catch (error) {
      Alert.alert(t("profile"), error?.response?.data?.error || t("unknownError"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScreenLayout onRefresh={load} refreshing={loading}>
      <AppCard>
        <View style={styles.heroRow}>
          <View style={[styles.avatarWrap, { borderColor: theme.colors.border, backgroundColor: theme.colors.rowAlt }]}> 
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={styles.avatarImage} resizeMode="cover" />
            ) : (
              <Text style={[styles.avatarFallback, { color: theme.colors.text, fontFamily: theme.fonts.bold }]}>
                {String((fullName || login || "U").trim()).slice(0, 1).toUpperCase()}
              </Text>
            )}
          </View>

          <View style={styles.heroMeta}>
            <Text style={[styles.heroName, { color: theme.colors.text, fontFamily: theme.fonts.bold }]}>
              {fullName || login || "-"}
            </Text>
            <Text style={[styles.heroSub, { color: theme.colors.textMuted, fontFamily: theme.fonts.regular }]}>@{login || "-"}</Text>
            {groupId ? (
              <Text style={[styles.heroSub, { color: theme.colors.textMuted, fontFamily: theme.fonts.regular }]}>
                {t("groupName")}: {groupId}
              </Text>
            ) : null}
          </View>
        </View>
      </AppCard>

      <AppCard>
        <Text style={[styles.sectionTitle, { color: theme.colors.text, fontFamily: theme.fonts.bold }]}>{t("myData")}</Text>
        <DataRow label={t("loginLabel")} value={login} theme={theme} />
        <DataRow label={t("birthDate")} value={details?.birth_date || "-"} theme={theme} />
        <DataRow label={t("biography")} value={details?.biography || "-"} theme={theme} />

        {role === "student" ? (
          <>
            <DataRow label={t("studentId")} value={studentCode || "-"} theme={theme} />
            <DataRow label={t("groupName")} value={details?.group_name || groupId || "-"} theme={theme} />
            <DataRow label={t("admissionYear")} value={details?.admission_year ? String(details.admission_year) : "-"} theme={theme} />
            <DataRow label={t("course")} value={calculateCourse(details?.admission_year)} theme={theme} />
            <DataRow label={t("specialty")} value={details?.specialty || "-"} theme={theme} />
          </>
        ) : null}

        {role === "teacher" ? <DataRow label={t("subjects")} value={(details?.subjects || []).join(", ") || "-"} theme={theme} /> : null}
      </AppCard>

      {isTeacherOrStudent ? (
        <AppCard>
          <Text style={[styles.sectionTitle, { color: theme.colors.text, fontFamily: theme.fonts.bold }]}>{t("edit")}</Text>
          <BirthDateField label={t("birthDate")} value={birthDate} onChangeText={setBirthDate} maximumDate={new Date()} />
          <AppInput
            label={t("biography")}
            value={biography}
            onChangeText={setBiography}
            placeholder={t("biographyPlaceholder")}
            multiline
            inputStyle={styles.bioInput}
          />
          <AppButton title={t("save")} onPress={onSave} loading={saving} />
        </AppCard>
      ) : null}
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  heroRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  avatarWrap: {
    width: 84,
    height: 84,
    borderRadius: 42,
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
    fontSize: 32,
  },
  heroMeta: {
    flex: 1,
  },
  heroName: {
    fontSize: 22,
    marginBottom: 2,
  },
  heroSub: {
    fontSize: 12,
    marginBottom: 2,
  },
  sectionTitle: {
    fontSize: 17,
    marginBottom: 8,
  },
  dataRow: {
    marginBottom: 8,
  },
  dataLabel: {
    fontSize: 12,
    marginBottom: 2,
  },
  dataValue: {
    fontSize: 14,
    lineHeight: 20,
  },
  bioInput: {
    minHeight: 110,
    textAlignVertical: "top",
  },
});
