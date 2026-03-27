/**
 * Module: app/screens/ModuleDetailsScreen.js
 *
 * Purpose:
 * - Screen module for ModuleDetailsScreen. Handles state, data loading, and UI for this route.
 *
 * Module notes:
 * - Imports count: 6.
 * - This header is written for beginners: read purpose first, then function map below.
 *
 * Function map:
 * - ModuleDetailsScreen: Main React component or UI container exported by this file.
 * - readableDate: Helper function used by this module business logic.
 * - moduleRatingLabel: Helper function used by this module business logic.
 * - tableCells: Helper function used by this module business logic.
 */

import React, { useMemo } from "react";
import { Platform, ScrollView, StyleSheet, Text, View } from "react-native";

import AppCard from "../components/AppCard";
import ScreenLayout from "../components/ScreenLayout";
import { useI18n } from "../hooks/I18nContext";
import { useThemeMode } from "../hooks/ThemeContext";

function readableDate(value) {
  if (!value || typeof value !== "string") return "-";
  return value.split("T")[0];
}

function moduleRatingLabel(value, t) {
  const raw = String(value || "").toLowerCase();
  if (raw === "excellent") return t("moduleRatingExcellent");
  if (raw === "good") return t("moduleRatingGood");
  if (raw === "satisfactory") return t("moduleRatingSatisfactory");
  return t("moduleRatingUnsatisfactory");
}

export default function ModuleDetailsScreen({ route }) {
  const { t } = useI18n();
  const { theme } = useThemeMode();
  const subjectItem = route?.params?.subjectItem || null;

  const tableCells = useMemo(() => {
    if (!subjectItem) return null;

    const module1 = subjectItem.module1 || {};
    const module2 = subjectItem.module2 || {};
    const exam = subjectItem.exam || {};
    const bonus = subjectItem.bonus || {};

    return {
      module1_test: Number(module1.test_points_capped || 0),
      module1_teacher: Number(module1.teacher_points || 0),
      module1_total: Number(module1.module_points || 0),
      module2_test: Number(module2.test_points_capped || 0),
      module2_teacher: Number(module2.teacher_points || 0),
      module2_total: Number(module2.module_points || 0),
      exam: Number(exam.points || 0),
      bonus: Number(bonus.points || 0),
      total: Number(subjectItem.total_points || 0),
    };
  }, [subjectItem]);

  const columns = useMemo(
    () => [
      { key: "module1_test", title: t("moduleColTest1") },
      { key: "module1_teacher", title: t("moduleColTeacher1") },
      { key: "module1_total", title: t("moduleColTotal1") },
      { key: "module2_test", title: t("moduleColTest2") },
      { key: "module2_teacher", title: t("moduleColTeacher2") },
      { key: "module2_total", title: t("moduleColTotal2") },
      { key: "exam", title: t("moduleColExam") },
      { key: "bonus", title: t("moduleColBonus") },
      { key: "total", title: t("moduleColFinal") },
    ],
    [t]
  );

  if (!subjectItem) {
    return (
      <ScreenLayout>
        <AppCard>
          <Text style={[styles.emptyText, { color: theme.colors.textMuted }]}>{t("noData")}</Text>
        </AppCard>
      </ScreenLayout>
    );
  }

  return (
    <ScreenLayout>
      <AppCard>
        <Text style={[styles.subjectTitle, { color: theme.colors.text, fontFamily: theme.fonts.bold }]}>
          {subjectItem.subject || "-"}
        </Text>
        <View style={styles.metaBlock}>
          <Text style={[styles.metaText, { color: theme.colors.text, fontFamily: theme.fonts.medium }]}>
            {t("lastDate")}: {readableDate(subjectItem.last_date)}
          </Text>
          <Text style={[styles.metaText, { color: theme.colors.text, fontFamily: theme.fonts.medium }]}>
            {t("moduleRating")}: {moduleRatingLabel(subjectItem.rating, t)}
          </Text>
        </View>
      </AppCard>

      <AppCard>
        <Text style={[styles.tableTitle, { color: theme.colors.text, fontFamily: theme.fonts.bold }]}>
          {t("moduleDetailsTitle")}
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={styles.gridScroll}>
          <View style={[styles.gridTable, { borderColor: theme.colors.border }]}>
            <View style={styles.gridRow}>
              {columns.map((column, index) => (
                <View
                  key={`head-${column.key}`}
                  style={[
                    styles.gridCell,
                    styles.gridHeaderCell,
                    index !== columns.length - 1 ? styles.gridCellRight : null,
                    { borderColor: theme.colors.border, backgroundColor: theme.colors.rowAlt },
                  ]}
                >
                  <Text style={[styles.gridHeaderText, { color: theme.colors.text, fontFamily: theme.fonts.bold }]}>
                    {column.title}
                  </Text>
                </View>
              ))}
            </View>
            <View style={[styles.gridRow, styles.gridBodyRow]}>
              {columns.map((column, index) => (
                <View
                  key={`value-${column.key}`}
                  style={[
                    styles.gridCell,
                    index !== columns.length - 1 ? styles.gridCellRight : null,
                    { borderColor: theme.colors.border, backgroundColor: theme.colors.surface },
                  ]}
                >
                  <Text style={[styles.gridValueText, { color: theme.colors.text }]}>
                    {String(tableCells?.[column.key] ?? 0)}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        </ScrollView>
      </AppCard>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  subjectTitle: {
    fontSize: 21,
    marginBottom: 8,
  },
  metaBlock: {
    gap: 4,
  },
  metaText: {
    fontSize: 13,
  },
  tableTitle: {
    fontSize: 17,
    marginBottom: 10,
  },
  gridScroll: {
    paddingBottom: 4,
  },
  gridTable: {
    borderWidth: 1,
    borderRadius: 12,
    overflow: "hidden",
    minWidth: 1320,
  },
  gridRow: {
    flexDirection: "row",
  },
  gridBodyRow: {
    borderTopWidth: 1,
  },
  gridCell: {
    width: 146,
    minHeight: 92,
    alignItems: "stretch",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  gridHeaderCell: {
    minHeight: 98,
  },
  gridCellRight: {
    borderRightWidth: 1,
  },
  gridHeaderText: {
    fontSize: 16,
    textAlign: "center",
  },
  gridValueText: {
    fontSize: 28,
    lineHeight: 32,
    width: "100%",
    textAlign: "center",
    fontVariant: ["tabular-nums"],
    includeFontPadding: false,
    fontFamily: Platform.select({
      ios: "Menlo",
      android: "monospace",
      default: "monospace",
    }),
  },
  emptyText: {
    fontSize: 14,
    fontFamily: "serif",
  },
});
