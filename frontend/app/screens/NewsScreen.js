/**
 * Module: app/screens/NewsScreen.js
 *
 * Purpose:
 * - Screen module for NewsScreen. Handles state, data loading, and UI for this route.
 *
 * Module notes:
 * - Imports count: 16.
 * - This header is written for beginners: read purpose first, then function map below.
 *
 * Function map:
 * - NewsScreen: Main React component or UI container exported by this file.
 * - formatNewsDate: Transforms input/output values to stable display or API format.
 * - normalizeDayValue: Transforms input/output values to stable display or API format.
 * - resolveImageUrl: Builds derived values and resolves runtime decisions.
 * - pickImageFile: Helper function used by this module business logic.
 * - onCreateNews: Callback function invoked by UI or navigation events.
 * - onToggleNewsStatus: Callback function invoked by UI or navigation events.
 * - getDayLabel: Returns computed or fetched data for caller usage.
 * - resetCreateForm: Helper function used by this module business logic.
 * - toggleTargetGroup: Toggles boolean state or switches between two modes.
 * - beginEditNews: Helper function used by this module business logic.
 * - buildReplacementPayload: Builds derived values and resolves runtime decisions.
 * - openNews: Controls modal/sheet/screen visibility or navigation transition.
 * - match: Helper function used by this module business logic.
 * - replacementSlots: Helper function used by this module business logic.
 * - replacementTargets: Helper function used by this module business logic.
 * - sorted: Helper function used by this module business logic.
 * - loadNews: Loads remote/local data and updates screen/component state.
 * - loadGroups: Loads remote/local data and updates screen/component state.
 * - loadScheduleForReplacementGroup: Loads remote/local data and updates screen/component state.
 * - loadReplacementBindings: Loads remote/local data and updates screen/component state.
 * - closeViewer: Controls modal/sheet/screen visibility or navigation transition.
 * - markImageBroken: Helper function used by this module business logic.
 * - hasGroup: Helper function used by this module business logic.
 */

import * as DocumentPicker from "expo-document-picker";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Image,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import AppButton from "../components/AppButton";
import BirthDateField from "../components/BirthDateField";
import AppCard from "../components/AppCard";
import AppInput from "../components/AppInput";
import ScreenLayout from "../components/ScreenLayout";
import { useAuth } from "../hooks/AuthContext";
import { useI18n } from "../hooks/I18nContext";
import { useThemeMode } from "../hooks/ThemeContext";
import { fetchBindings, fetchGroups } from "../services/academyService";
import { API_BASE_URL } from "../services/api";
import { createNews, fetchNews, updateNews, updateNewsStatus } from "../services/contentService";
import { fetchScheduleByGroup } from "../services/scheduleService";

const DAY_VALUES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DAY_LABEL_KEYS = {
  Monday: "dayMonday",
  Tuesday: "dayTuesday",
  Wednesday: "dayWednesday",
  Thursday: "dayThursday",
  Friday: "dayFriday",
  Saturday: "daySaturday",
};
const NEWSPAPER = {
  card: "#efe5d2",
  cardAlt: "#e6d6bc",
  border: "#ad9574",
  title: "#2d2418",
  body: "#3b3022",
  meta: "#6a5843",
};

function formatNewsDate(value, language) {
  if (!value || typeof value !== "string") return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.split("T")[0];
  try {
    const locale = language === "kg" ? "ky-KG" : language === "en" ? "en-US" : "ru-RU";
    return new Intl.DateTimeFormat(locale, {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(date);
  } catch {
    return value.split("T")[0];
  }
}

function normalizeDayValue(day) {
  const value = String(day || "").trim().toLowerCase();
  const match = DAY_VALUES.find((item) => item.toLowerCase() === value);
  return match || "";
}

function resolveImageUrl(value) {
  const raw = String(value || "").trim().replace(/\\/g, "/");
  if (!raw) return "";

  if (raw.startsWith("/")) {
    return encodeURI(`${API_BASE_URL}${raw}`);
  }

  if (raw.startsWith("http://") || raw.startsWith("https://")) {
    try {
      const parsed = new URL(raw);
      if (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1") {
        const apiUrl = new URL(API_BASE_URL);
        parsed.protocol = apiUrl.protocol;
        parsed.host = apiUrl.host;
        return parsed.toString();
      }
      return encodeURI(raw);
    } catch {
      return encodeURI(raw);
    }
  }

  if (raw.startsWith("file://") || raw.startsWith("content://") || raw.startsWith("data:")) {
    return raw;
  }

  const normalizedPath = raw.replace(/^\.?\//, "");
  return encodeURI(`${API_BASE_URL}/${normalizedPath}`);
}

export default function NewsScreen({ navigation }) {
  const { t, language } = useI18n();
  const { theme } = useThemeMode();
  const { role, fullName, login } = useAuth();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [groups, setGroups] = useState([]);
  const [scheduleRows, setScheduleRows] = useState([]);
  const [viewerImageUrl, setViewerImageUrl] = useState("");
  const [brokenImages, setBrokenImages] = useState({});
  const viewerTranslateY = useRef(new Animated.Value(0)).current;

  const [newsKind, setNewsKind] = useState("news");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [authorName, setAuthorName] = useState("");

  const [imageSourceMode, setImageSourceMode] = useState("url");
  const [imageUrl, setImageUrl] = useState("");
  const [imageAsset, setImageAsset] = useState(null);

  const [replacementGroup, setReplacementGroup] = useState("");
  const [replacementDay, setReplacementDay] = useState("Monday");
  const [replacementDate, setReplacementDate] = useState("");
  const [replacementTo, setReplacementTo] = useState("");
  const [replacementSlotId, setReplacementSlotId] = useState("");
  const [replacementBindings, setReplacementBindings] = useState([]);
  const [replacementToBindingId, setReplacementToBindingId] = useState("");
  const [selectedTargetGroups, setSelectedTargetGroups] = useState([]);
  const [editingNewsId, setEditingNewsId] = useState(null);
  const [editingNewsRow, setEditingNewsRow] = useState(null);
  const [savingNews, setSavingNews] = useState(false);

  const canCreate = role === "scheduler" || role === "admin" || role === "rector";
  const isEditing = Boolean(editingNewsId);
  const isReplacementMode = newsKind === "schedule_replacement";
  const thumbnailWidth = Platform.OS === "web" ? 130 : windowWidth >= 430 ? 108 : 90;
  const thumbnailHeight = Platform.OS === "web" ? 170 : Math.round(thumbnailWidth * 1.35);
  const preferredAuthor = String(fullName || login || "").trim();

  const getDayLabel = (dayValue) => {
    const normalized = normalizeDayValue(dayValue);
    if (!normalized) return "-";
    return t(DAY_LABEL_KEYS[normalized]);
  };

  const replacementSlots = useMemo(() => {
    const dayValue = normalizeDayValue(replacementDay);
    const rowsForDay = (Array.isArray(scheduleRows) ? scheduleRows : [])
      .filter((row) => normalizeDayValue(row.day_of_week) === dayValue)
      .sort((a, b) => String(a.start_time || "").localeCompare(String(b.start_time || "")));

    return rowsForDay.map((row, index) => ({
      ...row,
      lessonNumber: index + 1,
      slotId: String(row.id),
    }));
  }, [replacementDay, scheduleRows]);

  const selectedReplacementSlot = useMemo(
    () => replacementSlots.find((item) => String(item.slotId) === String(replacementSlotId)) || null,
    [replacementSlotId, replacementSlots]
  );
  const selectedReplacementGroup = useMemo(
    () => groups.find((item) => String(item.name) === String(replacementGroup)) || null,
    [groups, replacementGroup]
  );
  const replacementTargets = useMemo(() => {
    const seen = new Set();
    const sorted = [...replacementBindings].sort((a, b) => {
      const aa = `${a.subject || ""}-${a.teacher_name || a.teacher_login || ""}`;
      const bb = `${b.subject || ""}-${b.teacher_name || b.teacher_login || ""}`;
      return aa.localeCompare(bb);
    });

    return sorted.filter((row) => {
      const key = `${row.teacher_id}::${row.subject}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [replacementBindings]);
  const selectedReplacementTarget = useMemo(
    () => replacementTargets.find((row) => String(`${row.teacher_id}::${row.subject}`) === String(replacementToBindingId)) || null,
    [replacementTargets, replacementToBindingId]
  );
  const selectedTargetGroupSet = useMemo(
    () => new Set(selectedTargetGroups.map((item) => String(item).trim().toLowerCase()).filter(Boolean)),
    [selectedTargetGroups]
  );

  useEffect(() => {
    if (!replacementSlots.length) {
      setReplacementSlotId("");
      return;
    }
    if (!replacementSlots.some((item) => String(item.slotId) === String(replacementSlotId))) {
      setReplacementSlotId(String(replacementSlots[0].slotId));
    }
  }, [replacementSlotId, replacementSlots]);

  useEffect(() => {
    if (!isEditing || !isReplacementMode || !editingNewsRow || !replacementSlots.length || replacementSlotId) {
      return;
    }

    const match = replacementSlots.find(
      (row) =>
        String(row.start_time || "") === String(editingNewsRow.target_start_time || "") &&
        String(row.end_time || "") === String(editingNewsRow.target_end_time || "")
    );
    if (match) {
      setReplacementSlotId(String(match.slotId));
    }
  }, [editingNewsRow, isEditing, isReplacementMode, replacementSlotId, replacementSlots]);

  useEffect(() => {
    if (!authorName && preferredAuthor) {
      setAuthorName(preferredAuthor);
    }
  }, [authorName, preferredAuthor]);

  useEffect(() => {
    if (!replacementTargets.length) {
      setReplacementToBindingId("");
      return;
    }
    if (!replacementTargets.some((row) => String(`${row.teacher_id}::${row.subject}`) === String(replacementToBindingId))) {
      const first = replacementTargets[0];
      setReplacementToBindingId(`${first.teacher_id}::${first.subject}`);
    }
  }, [replacementTargets, replacementToBindingId]);

  const loadNews = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchNews(canCreate ? { include_inactive: 1 } : undefined);
      setRows(Array.isArray(data) ? data : []);
    } catch (error) {
      Alert.alert(t("news"), error?.response?.data?.error || t("unknownError"));
    } finally {
      setLoading(false);
    }
  }, [canCreate, t]);

  const loadGroups = useCallback(async () => {
    if (!canCreate) return;
    try {
      const data = await fetchGroups();
      const list = Array.isArray(data) ? data : [];
      setGroups(list);

      if (list.length && !replacementGroup) {
        setReplacementGroup(String(list[0].name || ""));
      }
    } catch {
      setGroups([]);
    }
  }, [canCreate, replacementGroup]);

  const loadScheduleForReplacementGroup = useCallback(async () => {
    if (!canCreate || !isReplacementMode) {
      setScheduleRows([]);
      return;
    }
    const groupName = String(replacementGroup || "").trim();
    if (!groupName) {
      setScheduleRows([]);
      return;
    }
    try {
      const data = await fetchScheduleByGroup(groupName);
      setScheduleRows(Array.isArray(data) ? data : []);
    } catch {
      setScheduleRows([]);
    }
  }, [canCreate, isReplacementMode, replacementGroup]);

  const loadReplacementBindings = useCallback(async () => {
    if (!canCreate || !isReplacementMode || !selectedReplacementGroup?.id) {
      setReplacementBindings([]);
      return;
    }

    try {
      const data = await fetchBindings({ group_id: selectedReplacementGroup.id });
      setReplacementBindings(Array.isArray(data) ? data : []);
    } catch {
      setReplacementBindings([]);
    }
  }, [canCreate, isReplacementMode, selectedReplacementGroup?.id]);

  useEffect(() => {
    loadNews();
    loadGroups();
  }, [loadGroups, loadNews]);

  useEffect(() => {
    loadScheduleForReplacementGroup();
  }, [loadScheduleForReplacementGroup]);

  useEffect(() => {
    loadReplacementBindings();
  }, [loadReplacementBindings]);

  const closeViewer = useCallback(() => {
    viewerTranslateY.stopAnimation();
    viewerTranslateY.setValue(0);
    setViewerImageUrl("");
  }, [viewerTranslateY]);

  const openViewer = useCallback(
    (url) => {
      if (!url) return;
      viewerTranslateY.stopAnimation();
      viewerTranslateY.setValue(0);
      setViewerImageUrl(url);
    },
    [viewerTranslateY]
  );

  const viewerPanResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dy) > Math.abs(gesture.dx) && Math.abs(gesture.dy) > 8,
        onPanResponderMove: (_, gesture) => {
          const nextY = gesture.dy < 0 ? gesture.dy * 0.25 : gesture.dy;
          viewerTranslateY.setValue(nextY);
        },
        onPanResponderRelease: (_, gesture) => {
          if (gesture.dy > 120 || gesture.vy > 1.15) {
            closeViewer();
            return;
          }
          Animated.spring(viewerTranslateY, {
            toValue: 0,
            useNativeDriver: true,
            bounciness: 0,
          }).start();
        },
        onPanResponderTerminate: () => {
          Animated.spring(viewerTranslateY, {
            toValue: 0,
            useNativeDriver: true,
            bounciness: 0,
          }).start();
        },
      }),
    [closeViewer, viewerTranslateY]
  );

  const markImageBroken = useCallback((url) => {
    const safe = String(url || "").trim();
    if (!safe) return;
    setBrokenImages((prev) => {
      if (prev[safe]) return prev;
      return { ...prev, [safe]: true };
    });
  }, []);

  const pickImageFile = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ["image/*"],
      copyToCacheDirectory: true,
      multiple: false,
    });

    if (result.canceled || !result.assets?.length) return;
    setImageAsset(result.assets[0]);
    setImageSourceMode("file");
  };

  const resetCreateForm = () => {
    setEditingNewsId(null);
    setEditingNewsRow(null);
    setTitle("");
    setContent("");
    setAuthorName(preferredAuthor);
    setImageUrl("");
    setImageAsset(null);
    setImageSourceMode("url");
    setReplacementDate("");
    setReplacementTo("");
    setReplacementDay("Monday");
    setReplacementSlotId("");
    setReplacementToBindingId("");
    setSelectedTargetGroups([]);
  };

  const toggleTargetGroup = (groupName) => {
    const safe = String(groupName || "").trim();
    if (!safe) return;

    setSelectedTargetGroups((prev) => {
      const hasGroup = prev.some((item) => String(item).trim().toLowerCase() === safe.toLowerCase());
      if (hasGroup) {
        return prev.filter((item) => String(item).trim().toLowerCase() !== safe.toLowerCase());
      }
      return [...prev, safe];
    });
  };

  const beginEditNews = (item) => {
    setEditingNewsId(item.id);
    setEditingNewsRow(item);
    setNewsKind(item.kind === "schedule_replacement" ? "schedule_replacement" : "news");
    setTitle(String(item.title || ""));
    setContent(String(item.content || ""));
    setAuthorName(String(item.author_name || item.created_by_name || preferredAuthor || "").trim());

    const itemImage = String(item.image_url || "").trim();
    setImageSourceMode("url");
    setImageUrl(itemImage.includes("placehold.co/1200x675") ? "" : itemImage);
    setImageAsset(null);

    const targetGroups = Array.isArray(item.target_groups) ? item.target_groups : [];
    if (targetGroups.length) {
      setSelectedTargetGroups(targetGroups);
    } else if (item.target_group) {
      setSelectedTargetGroups([item.target_group]);
    } else {
      setSelectedTargetGroups([]);
    }

    setReplacementGroup(String(item.target_group || targetGroups[0] || replacementGroup || "").trim());
    setReplacementDay(normalizeDayValue(item.target_day) || "Monday");
    setReplacementDate(String(item.replacement_date || ""));
    setReplacementTo("");
    setReplacementSlotId("");
    setReplacementToBindingId("");
  };

  const buildReplacementPayload = () => {
    const groupName = String(replacementGroup || "").trim();
    const dayValue = normalizeDayValue(replacementDay);
    const dateValue = String(replacementDate || "").trim();
    const replacementToExtra = String(replacementTo || "").trim();
    const nextSubject = selectedReplacementTarget?.subject ? String(selectedReplacementTarget.subject).trim() : "";
    const nextTeacher = selectedReplacementTarget?.teacher_name || selectedReplacementTarget?.teacher_login || "";
    const replacementToValue = [nextSubject, nextTeacher].filter(Boolean).join(" • ");

    if (!groupName || !dayValue || !selectedReplacementSlot || !replacementToValue || !authorName.trim()) {
      return null;
    }

    const fromParts = [
      `${selectedReplacementSlot.start_time || "--"}-${selectedReplacementSlot.end_time || "--"}`,
      selectedReplacementSlot.subject || "-",
      selectedReplacementSlot.teacher_name || "-",
    ];
    const fromValue = fromParts.join(" • ");
    const lessonNumber = String(selectedReplacementSlot.lessonNumber || "");

    const contentLines = [
      `${t("groupName")}: ${groupName}`,
      `${t("dayOfWeek")}: ${t(DAY_LABEL_KEYS[dayValue])}`,
      `${t("lessonNumber")}: ${lessonNumber}`,
      `${t("time")}: ${selectedReplacementSlot.start_time || "--"} - ${selectedReplacementSlot.end_time || "--"}`,
      `${t("replacementFrom")}: ${fromValue}`,
      `${t("replacementTo")}: ${replacementToValue}`,
    ];

    if (dateValue) {
      contentLines.push(`${t("date")}: ${dateValue}`);
    }
    if (replacementToExtra) {
      contentLines.push(`${t("description")}: ${replacementToExtra}`);
    }

    return {
      title: `${t("scheduleReplacement")} • ${groupName} • ${t("lessonNumber")} ${lessonNumber}`,
      content: contentLines.join("\n"),
      author_name: authorName.trim(),
      kind: "schedule_replacement",
      target_group: groupName,
      target_groups: [groupName],
      target_day: dayValue,
      target_lesson: lessonNumber,
      target_start_time: selectedReplacementSlot.start_time || undefined,
      target_end_time: selectedReplacementSlot.end_time || undefined,
      replacement_date: dateValue || undefined,
      image_url: imageSourceMode === "url" ? imageUrl.trim() || undefined : undefined,
      imageAsset: imageSourceMode === "file" ? imageAsset : undefined,
      clear_image: imageSourceMode === "url" && !imageUrl.trim() && isEditing,
    };
  };

  const onCreateNews = async () => {
    try {
      setSavingNews(true);
      let payload = null;

      if (isReplacementMode) {
        payload = buildReplacementPayload();
      } else if (title.trim() && content.trim() && authorName.trim()) {
        const imageValue = imageSourceMode === "url" ? imageUrl.trim() : undefined;
        payload = {
          title: title.trim(),
          content: content.trim(),
          author_name: authorName.trim(),
          image_url: imageValue || undefined,
          imageAsset: imageSourceMode === "file" ? imageAsset : undefined,
          kind: "news",
          target_groups: selectedTargetGroups,
          clear_image: imageSourceMode === "url" && !imageValue && isEditing,
        };
      }

      if (!payload) {
        Alert.alert(t("news"), t("fillRequiredFields"));
        setSavingNews(false);
        return;
      }

      if (isEditing) {
        await updateNews(editingNewsId, payload);
      } else {
        await createNews(payload);
      }
      resetCreateForm();
      await loadNews();
    } catch (error) {
      Alert.alert(t("news"), error?.response?.data?.error || t("unknownError"));
    } finally {
      setSavingNews(false);
    }
  };

  const onToggleNewsStatus = async (item) => {
    try {
      await updateNewsStatus(item.id, !Boolean(item.is_active));
      await loadNews();
    } catch (error) {
      Alert.alert(t("news"), error?.response?.data?.error || t("unknownError"));
    }
  };

  const openNews = (item) => {
    navigation.navigate("NewsDetail", { item });
  };

  return (
    <ScreenLayout onRefresh={loadNews} refreshing={loading}>
      {Platform.OS === "web" ? (
        <Text style={[styles.title, { color: theme.colors.text, fontFamily: theme.fonts.bold }]}>{t("news")}</Text>
      ) : null}

      {canCreate ? (
        <AppCard>
          <Text style={[styles.sectionTitle, { color: theme.colors.text, fontFamily: theme.fonts.bold }]}>{t("createNews")}</Text>

          <View style={styles.modeRow}>
            <AppButton
              title={t("regularNews")}
              variant={newsKind === "news" ? "primary" : "ghost"}
              onPress={() => setNewsKind("news")}
              style={styles.modeButton}
            />
            <AppButton
              title={t("scheduleReplacement")}
              variant={newsKind === "schedule_replacement" ? "primary" : "ghost"}
              onPress={() => setNewsKind("schedule_replacement")}
              style={styles.modeButton}
            />
          </View>

          <AppInput
            label={t("authorLabel")}
            value={authorName}
            onChangeText={setAuthorName}
            placeholder={t("authorLabel")}
          />

          {isReplacementMode ? (
            <>
              <Text style={[styles.inputLabel, { color: theme.colors.text, fontFamily: theme.fonts.medium }]}>{t("groupName")}</Text>
              {groups.length ? (
                <View style={styles.selectorWrap}>
                  {groups.map((group) => (
                    <AppButton
                      key={`replacement-group-${group.id}`}
                      title={group.name}
                      variant={replacementGroup === group.name ? "primary" : "ghost"}
                      onPress={() => setReplacementGroup(group.name)}
                      style={styles.selectorBtn}
                    />
                  ))}
                </View>
              ) : (
                <AppInput label={t("groupName")} value={replacementGroup} onChangeText={setReplacementGroup} />
              )}

              <Text style={[styles.inputLabel, { color: theme.colors.text, fontFamily: theme.fonts.medium }]}>{t("dayOfWeek")}</Text>
              <View style={styles.selectorWrap}>
                {DAY_VALUES.map((value) => (
                  <AppButton
                    key={`replacement-day-${value}`}
                    title={t(DAY_LABEL_KEYS[value])}
                    variant={replacementDay === value ? "primary" : "ghost"}
                    onPress={() => setReplacementDay(value)}
                    style={styles.selectorBtn}
                  />
                ))}
              </View>

              <Text style={[styles.inputLabel, { color: theme.colors.text, fontFamily: theme.fonts.medium }]}>{t("replacementSlot")}</Text>
              <View style={styles.selectorWrap}>
                {replacementSlots.length ? (
                  replacementSlots.map((slot) => (
                    <AppButton
                      key={`replacement-slot-${slot.slotId}`}
                      title={`${slot.lessonNumber}. ${slot.start_time}-${slot.end_time} • ${slot.subject}`}
                      variant={String(replacementSlotId) === String(slot.slotId) ? "primary" : "ghost"}
                      onPress={() => setReplacementSlotId(String(slot.slotId))}
                      style={styles.selectorBtn}
                    />
                  ))
                ) : (
                  <Text style={[styles.metaText, { color: theme.colors.textMuted, fontFamily: theme.fonts.regular }]}>
                    {t("selectLesson")}
                  </Text>
                )}
              </View>

              <Text style={[styles.inputLabel, { color: theme.colors.text, fontFamily: theme.fonts.medium }]}>{t("replacementTo")}</Text>
              <View style={styles.selectorWrap}>
                {replacementTargets.length ? (
                  replacementTargets.map((target) => {
                    const key = `${target.teacher_id}::${target.subject}`;
                    const label = `${target.subject} • ${target.teacher_name || target.teacher_login || target.teacher_id}`;
                    return (
                      <AppButton
                        key={`replacement-target-${key}`}
                        title={label}
                        variant={replacementToBindingId === key ? "primary" : "ghost"}
                        onPress={() => setReplacementToBindingId(key)}
                        style={styles.selectorBtn}
                      />
                    );
                  })
                ) : (
                  <Text style={[styles.metaText, { color: theme.colors.textMuted, fontFamily: theme.fonts.regular }]}>
                    {t("selectLesson")}
                  </Text>
                )}
              </View>

              <BirthDateField
                label={t("replacementDate")}
                value={replacementDate}
                onChangeText={setReplacementDate}
              />
              <AppInput
                label={t("description")}
                value={replacementTo}
                onChangeText={setReplacementTo}
                placeholder={t("description")}
                multiline
                inputStyle={{ minHeight: 72, textAlignVertical: "top" }}
              />
            </>
          ) : (
            <>
              <AppInput label={t("title")} value={title} onChangeText={setTitle} />
              <AppInput
                label={t("content")}
                value={content}
                onChangeText={setContent}
                multiline
                inputStyle={{ minHeight: 90, textAlignVertical: "top" }}
              />
              <Text style={[styles.inputLabel, { color: theme.colors.text, fontFamily: theme.fonts.medium }]}>{t("targetGroups")}</Text>
              <View style={styles.selectorWrap}>
                <AppButton
                  title={t("allGroups")}
                  variant={!selectedTargetGroups.length ? "primary" : "ghost"}
                  onPress={() => setSelectedTargetGroups([])}
                  style={styles.selectorBtn}
                />
                {groups.map((group) => {
                  const selected = selectedTargetGroupSet.has(String(group.name).trim().toLowerCase());
                  return (
                    <AppButton
                      key={`target-group-${group.id}`}
                      title={group.name}
                      variant={selected ? "primary" : "ghost"}
                      onPress={() => toggleTargetGroup(group.name)}
                      style={styles.selectorBtn}
                    />
                  );
                })}
              </View>
            </>
          )}

          <Text style={[styles.inputLabel, { color: theme.colors.text, fontFamily: theme.fonts.medium }]}>{t("newsImageSource")}</Text>
          <View style={styles.modeRow}>
            <AppButton
              title={t("imageFromUrl")}
              variant={imageSourceMode === "url" ? "primary" : "ghost"}
              onPress={() => setImageSourceMode("url")}
              style={styles.modeButton}
            />
            <AppButton
              title={t("imageFromFile")}
              variant={imageSourceMode === "file" ? "primary" : "ghost"}
              onPress={() => setImageSourceMode("file")}
              style={styles.modeButton}
            />
          </View>

          {imageSourceMode === "url" ? (
            <AppInput
              label={t("newsImageUrl")}
              value={imageUrl}
              onChangeText={setImageUrl}
              placeholder={t("newsImageUrlHint")}
              autoCapitalize="none"
              autoCorrect={false}
            />
          ) : (
            <View style={styles.filePickerBox}>
              <AppButton title={t("chooseImage")} onPress={pickImageFile} variant="ghost" />
              {imageAsset?.uri ? (
                <View style={styles.previewWrap}>
                  <Image source={{ uri: imageAsset.uri }} style={styles.previewImage} resizeMode="cover" />
                  <Text style={[styles.fileName, { color: theme.colors.textMuted, fontFamily: theme.fonts.regular }]} numberOfLines={1}>
                    {imageAsset.name || imageAsset.fileName || "image"}
                  </Text>
                </View>
              ) : null}
            </View>
          )}

          <View style={styles.actionRow}>
            <AppButton title={isEditing ? t("save") : t("create")} onPress={onCreateNews} loading={savingNews} />
            {isEditing ? <AppButton title={t("cancel")} onPress={resetCreateForm} variant="ghost" /> : null}
          </View>
        </AppCard>
      ) : null}

      <Text style={[styles.meta, { color: theme.colors.textMuted }]}>{loading ? t("loading") : " "}</Text>

      {rows.length ? (
        rows.map((item) => {
          const isReplacement = item.kind === "schedule_replacement";
          const tag = isReplacement ? t("replacementTag") : t("newsTag");
          const imageUrl = resolveImageUrl(item.image_url);
          const hasImage = Boolean(imageUrl) && !brokenImages[imageUrl];

          return (
            <AppCard key={String(item.id)} style={[styles.newsCard, { backgroundColor: NEWSPAPER.card, borderColor: NEWSPAPER.border }]}>
              <View style={styles.newsRow}>
                <Pressable
                  onPress={() => {
                    openViewer(imageUrl);
                  }}
                  disabled={!hasImage}
                  style={({ pressed }) => [
                    styles.newsImageWrap,
                    {
                      width: thumbnailWidth,
                      height: thumbnailHeight,
                      borderColor: NEWSPAPER.border,
                      backgroundColor: NEWSPAPER.cardAlt,
                      opacity: pressed ? 0.92 : 1,
                    },
                  ]}
                >
                  {hasImage ? (
                    <Image
                      source={{ uri: imageUrl }}
                      style={styles.newsImage}
                      resizeMode="cover"
                      onError={() => markImageBroken(imageUrl)}
                    />
                  ) : (
                    <View style={styles.newsImageFallback}>
                      <Text style={[styles.newsImageFallbackText, { color: NEWSPAPER.meta, fontFamily: theme.fonts.medium }]}>
                        {t("newsTag")}
                      </Text>
                    </View>
                  )}
                </Pressable>

                <Pressable onPress={() => openNews(item)} style={({ pressed }) => [styles.newsMain, { opacity: pressed ? 0.92 : 1 }]}>
                  <View style={styles.newsHeader}>
                    <Text style={[styles.newsDate, { color: NEWSPAPER.meta, fontFamily: theme.fonts.regular }]}>
                      {formatNewsDate(item.created_at, language)}
                    </Text>
                    <Text style={[styles.newsTag, { color: NEWSPAPER.meta, fontFamily: theme.fonts.medium }]}>
                      #{tag}{item.is_active ? "" : ` • ${t("archivedNews")}`}
                    </Text>
                  </View>

                  <Text numberOfLines={2} style={[styles.newsTitle, { color: NEWSPAPER.title, fontFamily: theme.fonts.bold }]}>
                    {item.title}
                  </Text>

                  <Text
                    numberOfLines={3}
                    ellipsizeMode="tail"
                    style={[styles.newsPreview, { color: NEWSPAPER.body, fontFamily: theme.fonts.regular }]}
                  >
                    {item.content}
                  </Text>

                  {Array.isArray(item.target_groups) && item.target_groups.length ? (
                    <Text style={[styles.targetGroupsText, { color: NEWSPAPER.meta, fontFamily: theme.fonts.medium }]}>
                      {t("targetGroups")}: {item.target_groups.join(", ")}
                    </Text>
                  ) : null}

                  {isReplacement ? (
                    <View style={[styles.replacementInfo, { borderColor: NEWSPAPER.border, backgroundColor: NEWSPAPER.cardAlt }]}>
                      <Text style={[styles.replacementMeta, { color: NEWSPAPER.meta, fontFamily: theme.fonts.medium }]}>
                        {t("group")}: {item.target_group || "-"}
                      </Text>
                      <Text style={[styles.replacementMeta, { color: NEWSPAPER.meta, fontFamily: theme.fonts.medium }]}>
                        {t("dayOfWeek")}: {getDayLabel(item.target_day)}
                      </Text>
                      <Text style={[styles.replacementMeta, { color: NEWSPAPER.meta, fontFamily: theme.fonts.medium }]}>
                        {t("lessonNumber")}: {item.target_lesson || "-"}
                      </Text>
                      <Text style={[styles.replacementMeta, { color: NEWSPAPER.meta, fontFamily: theme.fonts.medium }]}>
                        {t("time")}: {item.target_start_time || "--"} - {item.target_end_time || "--"}
                      </Text>
                      <Text style={[styles.replacementMeta, { color: NEWSPAPER.meta, fontFamily: theme.fonts.medium }]}>
                        {t("date")}: {item.replacement_date || "-"}
                      </Text>
                    </View>
                  ) : null}

                  <View style={[styles.divider, { backgroundColor: NEWSPAPER.border }]} />

                  <View style={styles.newsFooter}>
                    <Text style={[styles.authorText, { color: NEWSPAPER.meta, fontFamily: theme.fonts.regular }]}>
                      {t("authorLabel")}: {item.author_name || item.created_by_name || item.created_by || "-"}
                    </Text>
                    <AppButton title={t("readFull")} onPress={() => openNews(item)} variant="ghost" style={styles.readButton} />
                  </View>

                  {canCreate ? (
                    <View style={styles.manageRow}>
                      <AppButton title={t("edit")} onPress={() => beginEditNews(item)} variant="ghost" style={styles.manageBtn} />
                      <AppButton
                        title={item.is_active ? t("deactivateNews") : t("activateNews")}
                        onPress={() => onToggleNewsStatus(item)}
                        variant="ghost"
                        style={styles.manageBtn}
                      />
                    </View>
                  ) : null}
                </Pressable>
              </View>
            </AppCard>
          );
        })
      ) : (
        <AppCard>
          <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fonts.regular }}>{t("noData")}</Text>
        </AppCard>
      )}

      <Modal
        visible={Boolean(viewerImageUrl)}
        transparent={false}
        animationType="fade"
        statusBarTranslucent
        presentationStyle={Platform.OS === "ios" ? "overFullScreen" : "fullScreen"}
        onRequestClose={closeViewer}
      >
        <View style={styles.viewerOverlay}>
          <Animated.View style={[styles.viewerCard, { transform: [{ translateY: viewerTranslateY }] }]} {...viewerPanResponder.panHandlers}>
            {viewerImageUrl && !brokenImages[viewerImageUrl] ? (
              <Image
                source={{ uri: viewerImageUrl }}
                style={styles.viewerImage}
                resizeMode="contain"
                onError={() => markImageBroken(viewerImageUrl)}
              />
            ) : (
              <View style={styles.viewerFallback}>
                <Text style={styles.viewerFallbackText}>{t("imageUnavailable")}</Text>
              </View>
            )}
          </Animated.View>

          <Pressable
            style={[
              styles.viewerClose,
              {
                top: Math.max(insets.top, 8) + 6,
              },
            ]}
            onPress={closeViewer}
          >
            <Text style={styles.viewerCloseText}>×</Text>
          </Pressable>
        </View>
      </Modal>
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
  inputLabel: {
    fontSize: 13,
    marginBottom: 6,
  },
  modeRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 10,
  },
  modeButton: {
    flex: 1,
  },
  selectorWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 10,
  },
  selectorBtn: {
    minHeight: 34,
  },
  actionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 2,
  },
  filePickerBox: {
    marginBottom: 10,
  },
  previewWrap: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  previewImage: {
    width: 56,
    height: 56,
    borderRadius: 8,
  },
  fileName: {
    flex: 1,
    fontSize: 12,
  },
  metaText: {
    fontSize: 12,
  },
  meta: {
    marginBottom: 8,
    fontSize: 12,
    fontFamily: "serif",
  },
  newsCard: {
    marginBottom: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  newsRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  newsImageWrap: {
    borderRadius: 10,
    overflow: "hidden",
    borderWidth: 1,
  },
  newsImage: {
    width: "100%",
    height: "100%",
  },
  newsImageFallback: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 6,
  },
  newsImageFallbackText: {
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  newsMain: {
    flex: 1,
  },
  newsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  newsDate: {
    fontSize: 12,
  },
  newsTag: {
    fontSize: 12,
  },
  newsTitle: {
    fontSize: 20,
    lineHeight: 24,
    letterSpacing: 0.2,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  newsPreview: {
    fontSize: 14,
    lineHeight: 20,
    minHeight: 58,
  },
  targetGroupsText: {
    marginTop: 7,
    fontSize: 12,
  },
  replacementInfo: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 8,
    marginTop: 8,
  },
  replacementMeta: {
    fontSize: 12,
    marginBottom: 2,
  },
  divider: {
    height: 1,
    marginTop: 10,
    marginBottom: 8,
  },
  newsFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },
  authorText: {
    fontSize: 12,
    flex: 1,
  },
  readButton: {
    minHeight: 32,
    paddingHorizontal: 10,
  },
  manageRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
  },
  manageBtn: {
    minHeight: 32,
    paddingHorizontal: 10,
  },
  viewerOverlay: {
    flex: 1,
    backgroundColor: "#000",
  },
  viewerCard: {
    flex: 1,
    width: "100%",
    height: "100%",
    backgroundColor: "#000",
  },
  viewerImage: {
    width: "100%",
    height: "100%",
  },
  viewerFallback: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#111",
    paddingHorizontal: 16,
  },
  viewerFallbackText: {
    color: "#f0f0f0",
    fontSize: 14,
    fontFamily: "serif",
    textAlign: "center",
  },
  viewerClose: {
    position: "absolute",
    right: 12,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.48)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.35)",
  },
  viewerCloseText: {
    color: "#fff",
    fontSize: 26,
    lineHeight: 26,
    marginTop: -2,
    fontFamily: "serif",
  },
});
