/**
 * Module: app/screens/AttendanceScreen.js
 *
 * Purpose:
 * - Screen module for AttendanceScreen. Handles state, data loading, and UI for this route.
 *
 * Module notes:
 * - Imports count: 12.
 * - This header is written for beginners: read purpose first, then function map below.
 *
 * Function map:
 * - AttendanceScreen: Main React component or UI container exported by this file.
 * - loadAttendance: Loads remote/local data and updates screen/component state.
 * - onCreateAttendance: Callback function invoked by UI or navigation events.
 */

import React, { useEffect, useMemo, useState } from "react";
import { Alert, Platform, StyleSheet, Text, View } from "react-native";

import AppButton from "../components/AppButton";
import AppCard from "../components/AppCard";
import AppInput from "../components/AppInput";
import BirthDateField from "../components/BirthDateField";
import DataTable from "../components/DataTable";
import ScreenLayout from "../components/ScreenLayout";
import { useAuth } from "../hooks/AuthContext";
import { useI18n } from "../hooks/I18nContext";
import { useThemeMode } from "../hooks/ThemeContext";
import { createAttendance, fetchAttendanceByStudent } from "../services/attendanceService";

const STATUS_OPTIONS = ["present", "absent", "late"];

export default function AttendanceScreen() {
  const { role, userId } = useAuth();
  const { t } = useI18n();
  const { theme } = useThemeMode();

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  const [studentId, setStudentId] = useState("");
  const [status, setStatus] = useState("present");
  const [date, setDate] = useState("");
  const [queryStudentId, setQueryStudentId] = useState("");

  useEffect(() => {
    if (role === "student" && userId) {
      setQueryStudentId(String(userId));
      (async () => {
        setLoading(true);
        try {
          const data = await fetchAttendanceByStudent(String(userId));
          setRows(data);
        } catch (error) {
          Alert.alert(t("attendance"), error?.response?.data?.error || t("unknownError"));
        } finally {
          setLoading(false);
        }
      })();
    }
  }, [role, t, userId]);

  const loadAttendance = async () => {
    const ref = queryStudentId.trim();
    if (!ref) return;

    setLoading(true);
    try {
      const data = await fetchAttendanceByStudent(ref);
      setRows(data);
    } catch (error) {
      Alert.alert(t("attendance"), error?.response?.data?.error || t("unknownError"));
    } finally {
      setLoading(false);
    }
  };

  const onCreateAttendance = async () => {
    if (!studentId.trim() || !status) return;

    try {
      await createAttendance({
        student_id: studentId.trim(),
        status,
        date: date.trim() || undefined,
      });

      if (queryStudentId.trim()) {
        await loadAttendance();
      }
    } catch (error) {
      Alert.alert(t("attendance"), error?.response?.data?.error || t("unknownError"));
    }
  };

  const columns = useMemo(
    () => [
      { key: "date", title: t("date") },
      { key: "status", title: t("status") },
      { key: "student_id", title: t("studentId") },
      { key: "teacher_id", title: "Teacher ID" },
    ],
    [t]
  );

  return (
    <ScreenLayout onRefresh={loadAttendance} refreshing={loading}>
      {Platform.OS === "web" ? (
        <Text style={[styles.title, { color: theme.colors.text, fontFamily: theme.fonts.bold }]}>
          {t("attendance")}
        </Text>
      ) : null}

      {(role === "teacher" || role === "admin") ? (
        <AppCard>
          <Text style={[styles.sectionTitle, { color: theme.colors.text, fontFamily: theme.fonts.bold }]}> 
            {t("createAttendance")}
          </Text>
          <AppInput label={t("studentId")} value={studentId} onChangeText={setStudentId} placeholder={t("studentIdHint")} />
          <BirthDateField label={t("date")} value={date} onChangeText={setDate} />

          <Text style={[styles.label, { color: theme.colors.text, fontFamily: theme.fonts.medium }]}> 
            {t("status")}
          </Text>
          <View style={styles.rowWrap}>
            {STATUS_OPTIONS.map((item) => (
              <AppButton
                key={item}
                title={t(item)}
                onPress={() => setStatus(item)}
                variant={status === item ? "primary" : "ghost"}
                style={styles.statusButton}
              />
            ))}
          </View>

          <AppButton title={t("create")} onPress={onCreateAttendance} />
        </AppCard>
      ) : null}

      {(role === "teacher" || role === "admin") ? (
        <AppCard>
          <Text style={[styles.sectionTitle, { color: theme.colors.text, fontFamily: theme.fonts.bold }]}> 
            {t("loadAttendance")}
          </Text>
          <AppInput
            label={t("studentId")}
            value={queryStudentId}
            onChangeText={setQueryStudentId}
            placeholder={t("studentIdHint")}
          />
        </AppCard>
      ) : null}

      <Text style={[styles.meta, { color: theme.colors.textMuted }]}>{loading ? t("loading") : " "}</Text>

      <DataTable columns={columns} rows={rows} emptyText={t("noData")} />
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
  label: {
    fontSize: 13,
    marginBottom: 6,
  },
  rowWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 10,
  },
  statusButton: {
    minHeight: 36,
  },
  meta: {
    marginBottom: 8,
    fontSize: 12,
    fontFamily: "serif",
  },
});
