/**
 * Module: app/components/BirthDateField.js
 *
 * Purpose:
 * - Reusable UI component module: BirthDateField.
 *
 * Module notes:
 * - Imports count: 3.
 * - This header is written for beginners: read purpose first, then function map below.
 *
 * Function map:
 * - BirthDateField: Main React component or UI container exported by this file.
 * - clampDateByRange: Helper function used by this module business logic.
 * - clampMonthByRange: Helper function used by this module business logic.
 * - formatDateToIso: Transforms input/output values to stable display or API format.
 * - parseIsoDate: Transforms input/output values to stable display or API format.
 * - getMonthMatrix: Returns computed or fetched data for caller usage.
 * - openPicker: Controls modal/sheet/screen visibility or navigation transition.
 * - goPrevMonth: Helper function used by this module business logic.
 * - goNextMonth: Helper function used by this module business logic.
 * - selectDay: Helper function used by this module business logic.
 * - selectYear: Helper function used by this module business logic.
 * - parsedValue: Transforms input/output values to stable display or API format.
 * - initialDate: Helper function used by this module business logic.
 * - monthMatrix: Helper function used by this module business logic.
 * - yearOptions: Helper function used by this module business logic.
 * - viewMonthStart: Helper function used by this module business logic.
 */

import React, { useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { useThemeMode } from "../hooks/ThemeContext";

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const WEEKDAY_LABELS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
const FALLBACK_MIN_YEAR = 1900;
const FALLBACK_MAX_YEAR_ADD = 50;

function clampDateByRange(inputDate, minDate = null, maxDate = null) {
  if (!(inputDate instanceof Date) || Number.isNaN(inputDate.getTime())) return null;

  let safeDate = inputDate;
  if (minDate instanceof Date && !Number.isNaN(minDate.getTime()) && safeDate < minDate) {
    safeDate = minDate;
  }
  if (maxDate instanceof Date && !Number.isNaN(maxDate.getTime()) && safeDate > maxDate) {
    safeDate = maxDate;
  }
  return safeDate;
}

function clampMonthByRange(year, month, minDate = null, maxDate = null) {
  let nextYear = Number(year);
  let nextMonth = Number(month);
  if (!Number.isInteger(nextYear) || !Number.isInteger(nextMonth)) {
    return { year: nextYear, month: nextMonth };
  }

  if (minDate instanceof Date && !Number.isNaN(minDate.getTime())) {
    const minYear = minDate.getFullYear();
    const minMonth = minDate.getMonth();
    if (nextYear < minYear || (nextYear === minYear && nextMonth < minMonth)) {
      nextYear = minYear;
      nextMonth = minMonth;
    }
  }

  if (maxDate instanceof Date && !Number.isNaN(maxDate.getTime())) {
    const maxYear = maxDate.getFullYear();
    const maxMonth = maxDate.getMonth();
    if (nextYear > maxYear || (nextYear === maxYear && nextMonth > maxMonth)) {
      nextYear = maxYear;
      nextMonth = maxMonth;
    }
  }

  return { year: nextYear, month: nextMonth };
}

function formatDateToIso(value) {
  if (!(value instanceof Date)) return "";

  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseIsoDate(value) {
  const raw = String(value || "").trim();
  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;

  const [year, month, day] = raw.split("-").map((item) => Number(item));
  if (!year || !month || !day) return null;

  const parsed = new Date(year, month - 1, day);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function getMonthMatrix(year, monthIndex) {
  const firstWeekday = new Date(year, monthIndex, 1).getDay();
  const mondayOffset = firstWeekday === 0 ? 6 : firstWeekday - 1;
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();

  const cells = [];
  for (let idx = 0; idx < 42; idx += 1) {
    const dayValue = idx - mondayOffset + 1;
    if (dayValue < 1 || dayValue > daysInMonth) {
      cells.push(null);
      continue;
    }
    cells.push(dayValue);
  }

  return cells;
}

export default function BirthDateField({
  label,
  value,
  onChangeText,
  placeholder = "YYYY-MM-DD",
  style,
  maximumDate = null,
  minimumDate = null,
}) {
  const { theme } = useThemeMode();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [yearPickerOpen, setYearPickerOpen] = useState(false);

  const maxDate = useMemo(
    () => (maximumDate instanceof Date && !Number.isNaN(maximumDate.getTime()) ? maximumDate : null),
    [maximumDate]
  );
  const minDate = useMemo(
    () => (minimumDate instanceof Date && !Number.isNaN(minimumDate.getTime()) ? minimumDate : null),
    [minimumDate]
  );

  const parsedValue = useMemo(() => parseIsoDate(value), [value]);
  const initialDate = useMemo(() => {
    const base = parsedValue || new Date(2005, 0, 1);
    return clampDateByRange(base, minDate, maxDate) || new Date(2005, 0, 1);
  }, [maxDate, minDate, parsedValue]);

  const [viewYear, setViewYear] = useState(initialDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(initialDate.getMonth());

  const monthMatrix = useMemo(() => getMonthMatrix(viewYear, viewMonth), [viewMonth, viewYear]);
  const currentYear = new Date().getFullYear();
  const rawMinYear = minDate ? minDate.getFullYear() : FALLBACK_MIN_YEAR;
  const rawMaxYear = maxDate ? maxDate.getFullYear() : currentYear + FALLBACK_MAX_YEAR_ADD;
  const minYear = Math.min(rawMinYear, rawMaxYear);
  const maxYear = Math.max(rawMinYear, rawMaxYear);
  const yearOptions = useMemo(() => {
    const years = [];
    for (let year = maxYear; year >= minYear; year -= 1) {
      years.push(year);
    }
    return years;
  }, [maxYear, minYear]);
  const viewMonthStart = useMemo(() => new Date(viewYear, viewMonth, 1).getTime(), [viewMonth, viewYear]);
  const minMonthStart = minDate ? new Date(minDate.getFullYear(), minDate.getMonth(), 1).getTime() : null;
  const maxMonthStart = maxDate ? new Date(maxDate.getFullYear(), maxDate.getMonth(), 1).getTime() : null;
  const canGoNext = maxMonthStart == null || viewMonthStart < maxMonthStart;
  const canGoPrev = minMonthStart == null || viewMonthStart > minMonthStart;

  const openPicker = () => {
    const baseDate = clampDateByRange(parseIsoDate(value) || initialDate, minDate, maxDate) || initialDate;
    setViewYear(baseDate.getFullYear());
    setViewMonth(baseDate.getMonth());
    setYearPickerOpen(false);
    setPickerOpen(true);
  };

  const goPrevMonth = () => {
    if (!canGoPrev) return;
    setYearPickerOpen(false);
    const target = viewMonth === 0 ? { year: viewYear - 1, month: 11 } : { year: viewYear, month: viewMonth - 1 };
    const safe = clampMonthByRange(target.year, target.month, minDate, maxDate);
    setViewYear(safe.year);
    setViewMonth(safe.month);
  };

  const goNextMonth = () => {
    if (!canGoNext) return;
    setYearPickerOpen(false);
    const target = viewMonth === 11 ? { year: viewYear + 1, month: 0 } : { year: viewYear, month: viewMonth + 1 };
    const safe = clampMonthByRange(target.year, target.month, minDate, maxDate);
    setViewYear(safe.year);
    setViewMonth(safe.month);
  };

  const selectDay = (dayValue) => {
    if (!dayValue) return;

    const nextDate = new Date(viewYear, viewMonth, dayValue);
    if (maxDate && nextDate > maxDate) return;
    if (minDate && nextDate < minDate) return;

    onChangeText(formatDateToIso(nextDate));
    setYearPickerOpen(false);
    setPickerOpen(false);
  };

  const selectYear = (yearValue) => {
    const normalizedYear = Number(yearValue);
    if (!Number.isInteger(normalizedYear)) return;
    if (normalizedYear < minYear || normalizedYear > maxYear) return;

    const safe = clampMonthByRange(normalizedYear, viewMonth, minDate, maxDate);
    setViewYear(safe.year);
    setViewMonth(safe.month);
    setYearPickerOpen(false);
  };

  return (
    <View style={[styles.container, style]}>
      {label ? (
        <Text style={[styles.label, { color: theme.colors.text, fontFamily: theme.fonts.medium }]}>
          {label}
        </Text>
      ) : null}

      <Pressable
        onPress={openPicker}
        style={[
          styles.inputLike,
          {
            borderColor: theme.colors.border,
            backgroundColor: theme.colors.surface,
          },
        ]}
      >
        <Text
          style={[
            styles.valueText,
            {
              color: value ? theme.colors.text : theme.colors.textMuted,
              fontFamily: theme.fonts.regular,
            },
          ]}
        >
          {value || placeholder}
        </Text>
      </Pressable>

      <Modal
        visible={pickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setYearPickerOpen(false);
          setPickerOpen(false);
        }}
      >
        <View style={styles.modalWrap}>
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => {
              setYearPickerOpen(false);
              setPickerOpen(false);
            }}
          />
          <View
            style={[
              styles.modalCard,
              {
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.border,
              },
            ]}
          >
            <View style={styles.headerRow}>
              <Pressable onPress={goPrevMonth} style={[styles.navBtn, !canGoPrev && styles.navBtnDisabled]} disabled={!canGoPrev}>
                <Text
                  style={[
                    styles.navText,
                    {
                      color: canGoPrev ? theme.colors.text : theme.colors.textMuted,
                      fontFamily: theme.fonts.bold,
                    },
                  ]}
                >
                  {"<"}
                </Text>
              </Pressable>
              <View style={styles.headerCenter}>
                <Text style={[styles.headerTitle, { color: theme.colors.text, fontFamily: theme.fonts.bold }]}>
                  {MONTH_NAMES[viewMonth]}
                </Text>
                <Pressable
                  onPress={() => setYearPickerOpen((prev) => !prev)}
                  style={[
                    styles.yearChip,
                    {
                      borderColor: theme.colors.border,
                      backgroundColor: yearPickerOpen ? theme.colors.rowAlt : "transparent",
                    },
                  ]}
                >
                  <Text style={[styles.yearChipText, { color: theme.colors.text, fontFamily: theme.fonts.medium }]}>
                    {viewYear}
                  </Text>
                </Pressable>
              </View>
              <Pressable onPress={goNextMonth} style={[styles.navBtn, !canGoNext && styles.navBtnDisabled]} disabled={!canGoNext}>
                <Text style={[styles.navText, { color: canGoNext ? theme.colors.text : theme.colors.textMuted, fontFamily: theme.fonts.bold }]}>{">"}</Text>
              </Pressable>
            </View>

            {yearPickerOpen ? (
              <View style={styles.yearPickerWrap}>
                <ScrollView style={styles.yearScroll} showsVerticalScrollIndicator={false}>
                  <View style={styles.yearGrid}>
                    {yearOptions.map((yearValue) => {
                      const active = yearValue === viewYear;
                      return (
                        <Pressable
                          key={`year-${yearValue}`}
                          onPress={() => selectYear(yearValue)}
                          style={[
                            styles.yearCell,
                            active
                              ? {
                                  backgroundColor: theme.colors.primary,
                                  borderColor: theme.colors.primary,
                                }
                              : {
                                  borderColor: theme.colors.border,
                                },
                          ]}
                        >
                          <Text
                            style={[
                              styles.yearCellText,
                              {
                                color: active ? theme.colors.onPrimary : theme.colors.text,
                                fontFamily: theme.fonts.medium,
                              },
                            ]}
                          >
                            {yearValue}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </ScrollView>
              </View>
            ) : (
              <>
                <View style={styles.weekdaysRow}>
                  {WEEKDAY_LABELS.map((labelItem) => (
                    <Text
                      key={`weekday-${labelItem}`}
                      style={[styles.weekdayCell, { color: theme.colors.textMuted, fontFamily: theme.fonts.medium }]}
                    >
                      {labelItem}
                    </Text>
                  ))}
                </View>

                <View style={styles.daysGrid}>
                  {monthMatrix.map((dayValue, idx) => {
                    const dayDate = dayValue ? new Date(viewYear, viewMonth, dayValue) : null;
                    const isSelected =
                      parsedValue &&
                      parsedValue.getFullYear() === viewYear &&
                      parsedValue.getMonth() === viewMonth &&
                      parsedValue.getDate() === dayValue;
                    const overMax = Boolean(maxDate && dayDate && dayDate > maxDate);
                    const belowMin = Boolean(minDate && dayDate && dayDate < minDate);
                    const isDisabled = !dayValue || overMax || belowMin;

                    return (
                      <Pressable
                        key={`day-cell-${idx}`}
                        onPress={() => selectDay(dayValue)}
                        disabled={isDisabled}
                        style={[
                          styles.dayCell,
                          isSelected
                            ? {
                                backgroundColor: theme.colors.primary,
                                borderColor: theme.colors.primary,
                              }
                            : {
                                borderColor: theme.colors.border,
                              },
                        ]}
                      >
                        <Text
                          style={[
                            styles.dayText,
                            {
                              color: isSelected
                                ? theme.colors.onPrimary
                                : isDisabled
                                ? theme.colors.textMuted
                                : theme.colors.text,
                              fontFamily: theme.fonts.regular,
                            },
                          ]}
                        >
                          {dayValue || ""}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 10,
  },
  label: {
    fontSize: 13,
    marginBottom: 6,
  },
  inputLike: {
    minHeight: 42,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    justifyContent: "center",
  },
  valueText: {
    fontSize: 14,
  },
  modalWrap: {
    flex: 1,
    justifyContent: "center",
    padding: 18,
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.25)",
  },
  modalCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  headerCenter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerTitle: {
    fontSize: 16,
  },
  yearChip: {
    minHeight: 28,
    minWidth: 72,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  yearChipText: {
    fontSize: 13,
  },
  navBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  navBtnDisabled: {
    opacity: 0.4,
  },
  navText: {
    fontSize: 18,
    lineHeight: 20,
  },
  weekdaysRow: {
    flexDirection: "row",
    marginBottom: 8,
  },
  weekdayCell: {
    flex: 1,
    textAlign: "center",
    fontSize: 12,
  },
  daysGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  yearPickerWrap: {
    maxHeight: 300,
  },
  yearScroll: {
    maxHeight: 300,
  },
  yearGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  yearCell: {
    width: "30.8%",
    minHeight: 36,
    borderWidth: 1,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  yearCellText: {
    fontSize: 13,
  },
  dayCell: {
    width: "13.2%",
    minHeight: 34,
    borderWidth: 1,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  dayText: {
    fontSize: 13,
  },
});
