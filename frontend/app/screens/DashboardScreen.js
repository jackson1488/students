/**
 * Module: app/screens/DashboardScreen.js
 *
 * Purpose:
 * - Screen module for DashboardScreen. Handles state, data loading, and UI for this route.
 *
 * Module notes:
 * - Imports count: 19.
 * - This header is written for beginners: read purpose first, then function map below.
 *
 * Function map:
 * - DashboardScreen: Main React component or UI container exported by this file.
 * - resolveMediaUrl: Builds derived values and resolves runtime decisions.
 * - toNumber: Helper function used by this module business logic.
 * - parseGradeToFive: Transforms input/output values to stable display or API format.
 * - calculateAverageGrade: Helper function used by this module business logic.
 * - calculateAttendanceRate: Helper function used by this module business logic.
 * - calculateTestScoreRate: Helper function used by this module business logic.
 * - calculateAttemptedRate: Helper function used by this module business logic.
 * - getTodayLessonsCount: Returns computed or fetched data for caller usage.
 * - formatPercent: Transforms input/output values to stable display or API format.
 * - formatGrade: Transforms input/output values to stable display or API format.
 * - ProgressRow: Main React component or UI container exported by this file.
 * - DashboardBarChart: Main React component or UI container exported by this file.
 * - buildInsights: Builds derived values and resolves runtime decisions.
 * - safeCall: Helper function used by this module business logic.
 * - onChangeAvatar: Callback function invoked by UI or navigation events.
 * - goToSettings: Helper function used by this module business logic.
 * - goToMyData: Helper function used by this module business logic.
 * - values: Helper function used by this module business logic.
 * - sum: Helper function used by this module business logic.
 * - attempts: Helper function used by this module business logic.
 * - attemptedCount: Helper function used by this module business logic.
 * - selected: Helper function used by this module business logic.
 * - load: Loads remote/local data and updates screen/component state.
 * - students: Helper function used by this module business logic.
 * - teachers: Helper function used by this module business logic.
 * - countStats: Helper function used by this module business logic.
 * - countMax: Helper function used by this module business logic.
 * - countForChart: Helper function used by this module business logic.
 * - initials: Helper function used by this module business logic.
 * - avatarUri: Helper function used by this module business logic.
 * - onRefresh: Callback function invoked by UI or navigation events.
 */

import * as DocumentPicker from "expo-document-picker";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Image, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import AppCard from "../components/AppCard";
import AppButton from "../components/AppButton";
import BrandLogo from "../components/BrandLogo";
import ScreenLayout from "../components/ScreenLayout";
import { fetchGroups } from "../services/academyService";
import { fetchAttendanceByStudent } from "../services/attendanceService";
import { fetchChatContacts, fetchMessages } from "../services/chatService";
import { fetchBooks, fetchNews } from "../services/contentService";
import { fetchGradesByStudent } from "../services/gradesService";
import { fetchScheduleByGroup } from "../services/scheduleService";
import { fetchTests } from "../services/testsService";
import { fetchUsers, uploadMyAvatar } from "../services/usersService";
import { API_BASE_URL } from "../services/api";
import { useAuth } from "../hooks/AuthContext";
import { useI18n } from "../hooks/I18nContext";
import { useThemeMode } from "../hooks/ThemeContext";

const JS_DAY_TO_WEEKDAY = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function resolveMediaUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;
  if (raw.startsWith("/")) return `${API_BASE_URL}${raw}`;
  return raw;
}

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseGradeToFive(value) {
  const normalized = String(value ?? "").trim().toLowerCase().replace(",", ".");
  if (!normalized) return null;

  const numeric = Number(normalized);
  if (Number.isFinite(numeric)) {
    if (numeric <= 5) return Math.max(0, Math.min(5, numeric));
    if (numeric <= 100) return Math.max(0, Math.min(5, numeric / 20));
    return null;
  }

  const map = {
    "a+": 5,
    a: 5,
    "a-": 4.7,
    "b+": 4.5,
    b: 4.2,
    "b-": 4,
    "c+": 3.8,
    c: 3.5,
    "c-": 3.2,
    "d+": 2.8,
    d: 2.5,
    f: 2,
    отлично: 5,
    отл: 5,
    хорошо: 4,
    хор: 4,
    удовлетворительно: 3,
    удов: 3,
    неудовлетворительно: 2,
    неуд: 2,
  };

  return map[normalized] ?? null;
}

function calculateAverageGrade(rows) {
  const values = (Array.isArray(rows) ? rows : []).map((item) => parseGradeToFive(item?.value)).filter((n) => n !== null);
  if (!values.length) return null;
  const sum = values.reduce((acc, value) => acc + value, 0);
  return sum / values.length;
}

function calculateAttendanceRate(rows) {
  const values = Array.isArray(rows) ? rows : [];
  if (!values.length) return null;

  let points = 0;
  values.forEach((item) => {
    const status = String(item?.status || "").toLowerCase();
    if (status === "present") points += 1;
    else if (status === "late") points += 0.7;
  });

  return (points / values.length) * 100;
}

function calculateTestScoreRate(tests) {
  const rows = Array.isArray(tests) ? tests : [];
  const attempts = rows.map((item) => item?.attempt).filter(Boolean);
  if (!attempts.length) return null;

  let earned = 0;
  let total = 0;
  attempts.forEach((attempt) => {
    const score = toNumber(attempt?.score) ?? 0;
    const maxScore = toNumber(attempt?.total_questions) ?? 0;
    earned += score;
    total += maxScore;
  });

  if (total <= 0) return null;
  return (earned / total) * 100;
}

function calculateAttemptedRate(tests) {
  const rows = Array.isArray(tests) ? tests : [];
  if (!rows.length) return null;
  const attemptedCount = rows.filter((item) => Boolean(item?.attempted)).length;
  return (attemptedCount / rows.length) * 100;
}

function getTodayLessonsCount(scheduleRows) {
  const rows = Array.isArray(scheduleRows) ? scheduleRows : [];
  const today = JS_DAY_TO_WEEKDAY[new Date().getDay()];
  return rows.filter((item) => String(item?.day_of_week || "").trim().toLowerCase() === String(today).toLowerCase()).length;
}

function formatPercent(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return `${Math.round(value)}%`;
}

function formatGrade(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return `${value.toFixed(2)} / 5`;
}

function ProgressRow({ item, theme }) {
  const percent = item.percent === null || item.percent === undefined ? null : Math.max(0, Math.min(100, item.percent));

  return (
    <View style={styles.progressItem}>
      <View style={styles.progressHead}>
        <Text style={[styles.progressLabel, { color: theme.colors.text, fontFamily: theme.fonts.medium }]}>{item.label}</Text>
        <Text style={[styles.progressValue, { color: theme.colors.textMuted, fontFamily: theme.fonts.regular }]}>{item.display}</Text>
      </View>

      <View style={[styles.progressTrack, { backgroundColor: theme.colors.rowAlt, borderColor: theme.colors.border }]}>
        <View
          style={[
            styles.progressFill,
            {
              width: percent === null ? "0%" : `${percent}%`,
              backgroundColor: theme.colors.text,
              opacity: percent === null ? 0.25 : 0.9,
            },
          ]}
        />
      </View>
    </View>
  );
}

function DashboardBarChart({ series, activeKey, onSelect, theme, t }) {
  const selected = series.find((item) => item.key === activeKey) || series[0] || null;

  return (
    <AppCard>
      <Text style={[styles.sectionTitle, { color: theme.colors.text, fontFamily: theme.fonts.bold }]}>{t("dashboardChartTitle")}</Text>
      <Text style={[styles.sectionHint, { color: theme.colors.textMuted, fontFamily: theme.fonts.regular }]}>{t("dashboardChartHint")}</Text>

      {!series.length ? (
        <Text style={[styles.emptyInfo, { color: theme.colors.textMuted, fontFamily: theme.fonts.regular }]}>{t("dashboardNoDataChart")}</Text>
      ) : (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chartContent}>
            {series.map((item) => {
              const ratio = item.max > 0 ? Math.max(0, Math.min(1, item.value / item.max)) : 0;
              const active = item.key === selected?.key;
              return (
                <Pressable
                  key={item.key}
                  onPress={() => onSelect(item.key)}
                  style={({ pressed }) => [
                    styles.barColumn,
                    {
                      opacity: pressed ? 0.8 : 1,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.barTrack,
                      {
                        borderColor: active ? theme.colors.text : theme.colors.border,
                        backgroundColor: theme.colors.rowAlt,
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.barFill,
                        {
                          height: `${Math.max(6, ratio * 100)}%`,
                          backgroundColor: theme.colors.text,
                          opacity: active ? 1 : 0.65,
                        },
                      ]}
                    />
                  </View>
                  <Text
                    numberOfLines={1}
                    style={[
                      styles.barLabel,
                      {
                        color: active ? theme.colors.text : theme.colors.textMuted,
                        fontFamily: active ? theme.fonts.medium : theme.fonts.regular,
                      },
                    ]}
                  >
                    {item.short}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {selected ? (
            <View style={[styles.selectedMetricCard, { borderColor: theme.colors.border, backgroundColor: theme.colors.rowAlt }]}>
              <Text style={[styles.selectedMetricTitle, { color: theme.colors.textMuted, fontFamily: theme.fonts.regular }]}>
                {t("dashboardSelectedMetric")}
              </Text>
              <Text style={[styles.selectedMetricLabel, { color: theme.colors.text, fontFamily: theme.fonts.medium }]}>
                {selected.label}
              </Text>
              <Text style={[styles.selectedMetricValue, { color: theme.colors.text, fontFamily: theme.fonts.bold }]}>
                {selected.display}
              </Text>
            </View>
          ) : null}
        </>
      )}
    </AppCard>
  );
}

function buildInsights({ role, avgGrade, attendanceRate, testRate, t }) {
  const result = [];

  if (role === "scheduler") {
    result.push(t("insightSchedulerFocus"));
    return result;
  }

  if (avgGrade === null) {
    result.push(t("insightNoGradesYet"));
  } else if (avgGrade < 3.5) {
    result.push(t("insightImproveGrades"));
  }

  if (attendanceRate !== null && attendanceRate < 80) {
    result.push(t("insightImproveAttendance"));
  }

  if (testRate !== null && testRate < 60) {
    result.push(t("insightImproveTests"));
  }

  if (!result.length) {
    result.push(t("insightKeepUp"));
  }

  return result;
}

export default function DashboardScreen({ navigation }) {
  const { t } = useI18n();
  const { theme } = useThemeMode();
  const { role, userId, login, fullName, groupId, avatarUrl, updateProfile } = useAuth();

  const isTeacherOrStudent = role === "teacher" || role === "student";

  const [overviewStats, setOverviewStats] = useState([]);
  const [qualityStats, setQualityStats] = useState([]);
  const [insights, setInsights] = useState([]);
  const [chartSeries, setChartSeries] = useState([]);
  const [activeChartKey, setActiveChartKey] = useState("");

  const [loading, setLoading] = useState(false);
  const [avatarPreviewUri, setAvatarPreviewUri] = useState("");
  const [avatarUploading, setAvatarUploading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);

    const safeCall = async (runner, fallback) => {
      try {
        return await runner();
      } catch {
        return fallback;
      }
    };

    try {
      let stats = [];
      let quality = [];
      let chart = [];
      let advice = [];

      if (role === "admin") {
        const [users, tests, books, news, messages] = await Promise.all([
          safeCall(() => fetchUsers(), []),
          safeCall(() => fetchTests(), []),
          safeCall(() => fetchBooks(), []),
          safeCall(() => fetchNews(), []),
          safeCall(() => fetchMessages(), []),
        ]);

        const students = users.filter((item) => item.role === "student");
        const teachers = users.filter((item) => item.role === "teacher");

        stats = [
          { key: "users", label: t("usersCount"), value: users.length },
          { key: "students", label: t("dashStudentsCount"), value: students.length },
          { key: "teachers", label: t("dashTeachersCount"), value: teachers.length },
          { key: "tests", label: t("testsCount"), value: tests.length },
          { key: "books", label: t("booksCount"), value: books.length },
          { key: "news", label: t("newsCount"), value: news.length },
          { key: "messages", label: t("dashMessagesCount"), value: messages.length },
        ];

        quality = [
          { key: "grade", label: t("dashAverageGrade"), percent: null, display: "—" },
          { key: "attendance", label: t("dashAttendanceRate"), percent: null, display: "—" },
        ];

        advice = [t("insightKeepUp")];
      } else if (role === "teacher") {
        const [tests, books, news, messages, contacts] = await Promise.all([
          safeCall(() => fetchTests(), []),
          safeCall(() => fetchBooks(), []),
          safeCall(() => fetchNews(), []),
          safeCall(() => fetchMessages(), []),
          safeCall(() => fetchChatContacts(), []),
        ]);

        const studentIdsFromMessages = Array.from(
          new Set(
            messages
              .flatMap((item) => [item?.sender_id, item?.receiver_id])
              .map((id) => Number(id))
              .filter((id) => Number.isInteger(id) && id > 0 && id !== Number(userId))
          )
        );
        const studentIdsFromContacts = contacts
          .filter((item) => item?.role === "student")
          .map((item) => Number(item.id))
          .filter((id) => Number.isInteger(id) && id > 0);
        const studentIds = Array.from(new Set([...studentIdsFromContacts, ...studentIdsFromMessages])).slice(0, 40);

        stats = [
          { key: "tests", label: t("testsCount"), value: tests.length },
          { key: "messages", label: t("dashMessagesCount"), value: messages.length },
          { key: "books", label: t("booksCount"), value: books.length },
          { key: "news", label: t("newsCount"), value: news.length },
          { key: "students", label: t("dashStudentsCount"), value: studentIds.length },
        ];

        quality = [
          { key: "grade", label: t("dashAverageGrade"), percent: null, display: "—" },
          { key: "attendance", label: t("dashAttendanceRate"), percent: null, display: "—" },
        ];

        advice = [t("insightKeepUp")];
      } else if (role === "student") {
        const [tests, books, news, messages, gradesRows, attendanceRows, scheduleRows] = await Promise.all([
          safeCall(() => fetchTests(), []),
          safeCall(() => fetchBooks(), []),
          safeCall(() => fetchNews(), []),
          safeCall(() => fetchMessages(), []),
          safeCall(() => (userId ? fetchGradesByStudent(Number(userId)) : Promise.resolve([])), []),
          safeCall(() => (userId ? fetchAttendanceByStudent(Number(userId)) : Promise.resolve([])), []),
          safeCall(() => (groupId ? fetchScheduleByGroup(String(groupId)) : Promise.resolve([])), []),
        ]);

        const avgGrade = calculateAverageGrade(gradesRows);
        const attendanceRate = calculateAttendanceRate(attendanceRows);
        const testsRate = calculateTestScoreRate(tests);
        const attemptedRate = calculateAttemptedRate(tests);
        const attemptedCount = tests.filter((item) => item.attempted).length;
        const lessonsToday = getTodayLessonsCount(scheduleRows);

        stats = [
          { key: "tests", label: t("testsCount"), value: tests.length },
          { key: "attempted", label: t("dashTestsAttempted"), value: attemptedCount },
          { key: "todayLessons", label: t("dashTodayLessons"), value: lessonsToday },
          { key: "books", label: t("booksCount"), value: books.length },
          { key: "news", label: t("newsCount"), value: news.length },
          { key: "messages", label: t("dashMessagesCount"), value: messages.length },
        ];

        quality = [
          { key: "grade", label: t("dashAverageGrade"), percent: avgGrade === null ? null : (avgGrade / 5) * 100, display: formatGrade(avgGrade) },
          { key: "attendance", label: t("dashAttendanceRate"), percent: attendanceRate, display: formatPercent(attendanceRate) },
          { key: "testsRate", label: t("dashTestResultRate"), percent: testsRate, display: formatPercent(testsRate) },
          { key: "attemptedRate", label: t("attempted"), percent: attemptedRate, display: formatPercent(attemptedRate) },
        ];

        advice = buildInsights({ role, avgGrade, attendanceRate, testRate: testsRate, t });
      } else {
        const [books, news, groups] = await Promise.all([
          safeCall(() => fetchBooks(), []),
          safeCall(() => fetchNews(), []),
          safeCall(() => fetchGroups(), []),
        ]);

        stats = [
          { key: "groups", label: t("dashGroupsCount"), value: groups.length },
          { key: "books", label: t("booksCount"), value: books.length },
          { key: "news", label: t("newsCount"), value: news.length },
        ];

        quality = [
          { key: "grade", label: t("dashAverageGrade"), percent: null, display: "—" },
          { key: "attendance", label: t("dashAttendanceRate"), percent: null, display: "—" },
        ];

        advice = buildInsights({ role, avgGrade: null, attendanceRate: null, testRate: null, t });
      }

      const countStats = stats.filter((item) => Number.isFinite(Number(item.value)));
      const countMax = countStats.length ? Math.max(...countStats.map((item) => Number(item.value)), 1) : 1;
      const qualityForChart = quality
        .filter((item) => item.percent !== null && item.percent !== undefined)
        .map((item) => ({
          key: `quality-${item.key}`,
          label: item.label,
          short: item.label,
          value: Number(item.percent),
          max: 100,
          display: item.display,
        }));
      const countForChart = countStats.slice(0, 6).map((item) => ({
        key: `count-${item.key}`,
        label: item.label,
        short: item.label,
        value: Number(item.value),
        max: countMax,
        display: String(item.value),
      }));

      chart = [...qualityForChart, ...countForChart];

      setOverviewStats(stats);
      setQualityStats(quality);
      setInsights(advice);
      setChartSeries(chart);
      setActiveChartKey((prev) => {
        if (prev && chart.some((item) => item.key === prev)) return prev;
        return chart[0]?.key || "";
      });
    } catch (error) {
      Alert.alert(t("profile"), error?.response?.data?.error || t("unknownError"));
    } finally {
      setLoading(false);
    }
  }, [groupId, role, t, userId]);

  useEffect(() => {
    load();
  }, [load]);

  const initials = useMemo(() => {
    const source = String(fullName || login || role || "U").trim();
    return source.slice(0, 1).toUpperCase();
  }, [fullName, login, role]);

  const avatarUri = useMemo(() => resolveMediaUrl(avatarPreviewUri || avatarUrl), [avatarPreviewUri, avatarUrl]);

  const onRefresh = useCallback(async () => {
    await load();
  }, [load]);

  const goToSettings = () => {
    navigation.navigate("Settings");
  };

  const goToMyData = () => {
    navigation.navigate("ProfileDetails");
  };

  const onChangeAvatar = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ["image/*"],
      copyToCacheDirectory: true,
      multiple: false,
    });

    if (result.canceled || !result.assets?.length) return;

    const imageAsset = result.assets[0];
    setAvatarPreviewUri(imageAsset.uri || "");
    setAvatarUploading(true);

    try {
      const response = await uploadMyAvatar(imageAsset);
      const nextAvatar = response?.avatar_url || response?.user?.avatar_url || "";
      await updateProfile({ avatarUrl: nextAvatar || null });
      setAvatarPreviewUri("");
    } catch (error) {
      Alert.alert(t("profile"), error?.response?.data?.error || t("unknownError"));
    } finally {
      setAvatarUploading(false);
    }
  };

  const columns = overviewStats.length >= 4 ? 2 : 1;

  return (
    <ScreenLayout onRefresh={onRefresh} refreshing={loading}>
      <AppCard>
        <View style={styles.brandRow}>
          <BrandLogo size={32} showSubtitle={false} />
        </View>

        <View style={styles.profileTopRow}>
          <Pressable
            onPress={onChangeAvatar}
            disabled={avatarUploading}
            style={({ pressed }) => [
              styles.avatarWrap,
              {
                borderColor: theme.colors.border,
                backgroundColor: theme.colors.rowAlt,
                opacity: avatarUploading ? 0.6 : pressed ? 0.85 : 1,
              },
            ]}
          >
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={styles.avatarImage} resizeMode="cover" />
            ) : (
              <Text style={[styles.avatarText, { color: theme.colors.text, fontFamily: theme.fonts.bold }]}>{initials}</Text>
            )}
          </Pressable>

          <View style={styles.profileMetaWrap}>
            <Text style={[styles.profileName, { color: theme.colors.text, fontFamily: theme.fonts.bold }]}>
              {(isTeacherOrStudent ? fullName : login) || login || "-"}
            </Text>
            {isTeacherOrStudent ? null : (
              <Text style={[styles.profileMeta, { color: theme.colors.textMuted, fontFamily: theme.fonts.medium }]}>{t(role || "student")}</Text>
            )}
            {groupId ? (
              <Text style={[styles.profileMeta, { color: theme.colors.textMuted, fontFamily: theme.fonts.regular }]}>
                {t("groupName")}: {groupId}
              </Text>
            ) : null}
            <Text style={[styles.profileMeta, { color: theme.colors.textMuted, fontFamily: theme.fonts.regular }]}>
              {avatarUploading ? t("loading") : t("tapToChangeAvatar")}
            </Text>

            <View style={styles.myDataButtonWrap}>
              <AppButton
                title={`${t("myData")}  >`}
                onPress={goToMyData}
                variant="ghost"
                style={styles.myDataButton}
                textStyle={styles.myDataButtonText}
              />
            </View>
          </View>

          <Pressable
            onPress={goToSettings}
            style={({ pressed }) => [
              styles.settingsIconButton,
              {
                borderColor: theme.colors.border,
                backgroundColor: theme.colors.surface,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            <Text style={[styles.settingsIconText, { color: theme.colors.text }]}>⚙</Text>
          </Pressable>
        </View>
      </AppCard>

      {Platform.OS === "web" ? (
        <View style={styles.headerRow}>
          <Text style={[styles.title, { color: theme.colors.text, fontFamily: theme.fonts.bold }]}>{t("profile")}</Text>
        </View>
      ) : null}

      <AppCard>
        <Text style={[styles.sectionTitle, { color: theme.colors.text, fontFamily: theme.fonts.bold }]}>{t("dashboardOverviewTitle")}</Text>
        <View style={styles.grid}>
          {overviewStats.map((item) => (
            <View key={item.key} style={{ width: columns === 2 ? "50%" : "100%", paddingHorizontal: 4 }}>
              <View style={[styles.statBox, { borderColor: theme.colors.border, backgroundColor: theme.colors.rowAlt }]}>
                <Text style={[styles.statLabel, { color: theme.colors.textMuted, fontFamily: theme.fonts.regular }]}>{item.label}</Text>
                <Text style={[styles.statValue, { color: theme.colors.text, fontFamily: theme.fonts.bold }]}>{item.value}</Text>
              </View>
            </View>
          ))}
        </View>
      </AppCard>

      <DashboardBarChart series={chartSeries} activeKey={activeChartKey} onSelect={setActiveChartKey} theme={theme} t={t} />

      <AppCard>
        <Text style={[styles.sectionTitle, { color: theme.colors.text, fontFamily: theme.fonts.bold }]}>{t("dashboardQualityTitle")}</Text>
        {qualityStats.length ? (
          qualityStats.map((item) => <ProgressRow key={item.key} item={item} theme={theme} />)
        ) : (
          <Text style={[styles.emptyInfo, { color: theme.colors.textMuted, fontFamily: theme.fonts.regular }]}>
            {t("dashboardInsufficientAcademicData")}
          </Text>
        )}
      </AppCard>

      <AppCard>
        <Text style={[styles.sectionTitle, { color: theme.colors.text, fontFamily: theme.fonts.bold }]}>{t("dashboardInsightsTitle")}</Text>
        {insights.map((line, index) => (
          <View key={`insight-${index}`} style={styles.insightRow}>
            <View style={[styles.insightDot, { backgroundColor: theme.colors.text }]} />
            <Text style={[styles.insightText, { color: theme.colors.text, fontFamily: theme.fonts.regular }]}>{line}</Text>
          </View>
        ))}
      </AppCard>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
    gap: 10,
  },
  title: {
    fontSize: 22,
  },
  sectionTitle: {
    fontSize: 17,
    marginBottom: 8,
  },
  sectionHint: {
    fontSize: 12,
    marginBottom: 10,
  },
  brandRow: {
    marginBottom: 12,
  },
  profileTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  avatarWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarImage: {
    width: "100%",
    height: "100%",
  },
  avatarText: {
    fontSize: 30,
  },
  profileMetaWrap: {
    flex: 1,
  },
  myDataButtonWrap: {
    marginTop: 6,
    alignSelf: "flex-start",
  },
  myDataButton: {
    minHeight: 34,
    paddingHorizontal: 10,
  },
  myDataButtonText: {
    fontSize: 12,
    letterSpacing: 0,
  },
  profileName: {
    fontSize: 22,
    marginBottom: 3,
  },
  profileMeta: {
    fontSize: 12,
    marginBottom: 2,
  },
  settingsIconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  settingsIconText: {
    fontSize: 20,
    lineHeight: 22,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -4,
  },
  statBox: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 10,
    marginBottom: 8,
    minHeight: 84,
    justifyContent: "space-between",
  },
  statLabel: {
    fontSize: 12,
  },
  statValue: {
    fontSize: 28,
  },
  chartContent: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingBottom: 4,
    gap: 8,
  },
  barColumn: {
    width: 62,
    alignItems: "center",
  },
  barTrack: {
    width: 38,
    height: 132,
    borderRadius: 10,
    borderWidth: 1,
    overflow: "hidden",
    justifyContent: "flex-end",
  },
  barFill: {
    width: "100%",
    borderRadius: 8,
  },
  barLabel: {
    marginTop: 6,
    fontSize: 11,
    textAlign: "center",
    width: "100%",
  },
  selectedMetricCard: {
    borderWidth: 1,
    borderRadius: 12,
    marginTop: 10,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  selectedMetricTitle: {
    fontSize: 11,
    marginBottom: 2,
  },
  selectedMetricLabel: {
    fontSize: 13,
    marginBottom: 2,
  },
  selectedMetricValue: {
    fontSize: 19,
  },
  progressItem: {
    marginBottom: 10,
  },
  progressHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 5,
    gap: 10,
  },
  progressLabel: {
    fontSize: 13,
    flex: 1,
  },
  progressValue: {
    fontSize: 12,
  },
  progressTrack: {
    height: 10,
    borderRadius: 999,
    borderWidth: 1,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
  },
  insightRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  insightDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 7,
    marginRight: 8,
  },
  insightText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 20,
  },
  emptyInfo: {
    fontSize: 12,
  },
});
