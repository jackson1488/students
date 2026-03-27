/**
 * Module: app/screens/NewsDetailScreen.js
 *
 * Purpose:
 * - Screen module for NewsDetailScreen. Handles state, data loading, and UI for this route.
 *
 * Module notes:
 * - Imports count: 7.
 * - This header is written for beginners: read purpose first, then function map below.
 *
 * Function map:
 * - NewsDetailScreen: Main React component or UI container exported by this file.
 * - readableDate: Helper function used by this module business logic.
 * - normalizeDayValue: Transforms input/output values to stable display or API format.
 * - resolveImageUrl: Builds derived values and resolves runtime decisions.
 * - match: Helper function used by this module business logic.
 */

import React, { useState } from "react";
import { Image, StyleSheet, Text, View } from "react-native";

import AppCard from "../components/AppCard";
import ScreenLayout from "../components/ScreenLayout";
import { useI18n } from "../hooks/I18nContext";
import { useThemeMode } from "../hooks/ThemeContext";
import { API_BASE_URL } from "../services/api";

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

function readableDate(value) {
  if (!value || typeof value !== "string") return "-";
  return value.split("T")[0];
}

function normalizeDayValue(day) {
  const value = String(day || "").trim().toLowerCase();
  const entries = Object.keys(DAY_LABEL_KEYS);
  const match = entries.find((item) => item.toLowerCase() === value);
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

export default function NewsDetailScreen({ route }) {
  const { t } = useI18n();
  const { theme } = useThemeMode();
  const item = route?.params?.item;
  const imageUrl = resolveImageUrl(item?.image_url);
  const [imageBroken, setImageBroken] = useState(false);
  const isReplacement = item?.kind === "schedule_replacement";
  const normalizedDay = normalizeDayValue(item?.target_day);
  const dayLabel = normalizedDay ? t(DAY_LABEL_KEYS[normalizedDay]) : "-";

  return (
    <ScreenLayout>
      {item ? (
        <AppCard style={[styles.paperCard, { backgroundColor: NEWSPAPER.card, borderColor: NEWSPAPER.border }]}>
          {imageUrl && !imageBroken ? (
            <Image source={{ uri: imageUrl }} style={styles.coverImage} resizeMode="cover" onError={() => setImageBroken(true)} />
          ) : (
            <View style={[styles.coverFallback, { borderColor: NEWSPAPER.border, backgroundColor: NEWSPAPER.cardAlt }]}>
              <Text style={[styles.coverFallbackText, { color: NEWSPAPER.meta, fontFamily: theme.fonts.medium }]}>
                {t("imageUnavailable")}
              </Text>
            </View>
          )}

          <Text style={[styles.title, { color: NEWSPAPER.title, fontFamily: theme.fonts.bold }]}>
            {item.title}
          </Text>

          <Text style={[styles.meta, { color: NEWSPAPER.meta, fontFamily: theme.fonts.regular }]}>
            {readableDate(item.created_at)} • {t("authorLabel")}: {item.author_name || item.created_by_name || item.created_by || "-"}
            {item.is_active ? "" : ` • ${t("archivedNews")}`}
          </Text>

          {Array.isArray(item.target_groups) && item.target_groups.length ? (
            <Text style={[styles.meta, { color: NEWSPAPER.meta, fontFamily: theme.fonts.medium }]}>
              {t("targetGroups")}: {item.target_groups.join(", ")}
            </Text>
          ) : null}

          {isReplacement ? (
            <View style={[styles.replacementInfo, { borderColor: NEWSPAPER.border, backgroundColor: NEWSPAPER.cardAlt }]}>
              <Text style={[styles.replacementMeta, { color: NEWSPAPER.meta, fontFamily: theme.fonts.medium }]}>
                {t("group")}: {item.target_group || "-"}
              </Text>
              <Text style={[styles.replacementMeta, { color: NEWSPAPER.meta, fontFamily: theme.fonts.medium }]}>
                {t("dayOfWeek")}: {dayLabel}
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

          <Text style={[styles.content, { color: NEWSPAPER.body, fontFamily: theme.fonts.regular }]}>
            {item.content}
          </Text>
        </AppCard>
      ) : (
        <AppCard>
          <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fonts.regular }}>
            {t("noData")}
          </Text>
        </AppCard>
      )}
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  paperCard: {
    paddingHorizontal: 18,
    paddingVertical: 20,
  },
  coverImage: {
    width: "100%",
    height: 210,
    borderRadius: 10,
    marginBottom: 14,
  },
  coverFallback: {
    width: "100%",
    height: 210,
    borderRadius: 10,
    marginBottom: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  coverFallbackText: {
    fontSize: 14,
    textAlign: "center",
  },
  title: {
    fontSize: 32,
    lineHeight: 40,
    letterSpacing: 0.3,
  },
  meta: {
    marginTop: 10,
    fontSize: 12,
  },
  replacementInfo: {
    marginTop: 12,
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
  },
  replacementMeta: {
    fontSize: 12,
    marginBottom: 2,
  },
  divider: {
    height: 1,
    marginTop: 12,
    marginBottom: 16,
  },
  content: {
    fontSize: 17,
    lineHeight: 28,
  },
});
