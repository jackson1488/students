/**
 * Module: app/screens/GradesScreen.js
 *
 * Purpose:
 * - Screen module for GradesScreen. Handles state, data loading, and UI for this route.
 *
 * Module notes:
 * - Imports count: 16.
 * - This header is written for beginners: read purpose first, then function map below.
 *
 * Function map:
 * - GradesScreen: Main React component or UI container exported by this file.
 * - readableDate: Helper function used by this module business logic.
 * - shortDateLabel: Helper function used by this module business logic.
 * - normalizeJournalGradeValue: Transforms input/output values to stable display or API format.
 * - weekdayFromLabel: Helper function used by this module business logic.
 * - buildDatesByWeekdays: Builds derived values and resolves runtime decisions.
 * - onSaveModule: Callback function invoked by UI or navigation events.
 * - onExport: Callback function invoked by UI or navigation events.
 * - ownEntries: Helper function used by this module business logic.
 * - ownSubjects: Helper function used by this module business logic.
 * - formSource: Helper function used by this module business logic.
 * - loadStudentScheduleMeta: Loads remote/local data and updates screen/component state.
 * - onRefresh: Callback function invoked by UI or navigation events.
 * - closeJournalCell: Controls modal/sheet/screen visibility or navigation transition.
 * - gradeColumns: Helper function used by this module business logic.
 * - journalDates: Helper function used by this module business logic.
 * - journalRows: Helper function used by this module business logic.
 * - dateColumns: Helper function used by this module business logic.
 * - studentJournalData: Helper function used by this module business logic.
 * - resultRows: Helper function used by this module business logic.
 * - studentGradeColumns: Helper function used by this module business logic.
 * - moduleRows: Helper function used by this module business logic.
 */

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import { Alert, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import AppButton from "../components/AppButton";
import AppCard from "../components/AppCard";
import AppInput from "../components/AppInput";
import BrandLogo from "../components/BrandLogo";
import DataTable from "../components/DataTable";
import OverflowMenu from "../components/OverflowMenu";
import ScreenLayout from "../components/ScreenLayout";
import { useAuth } from "../hooks/AuthContext";
import { useI18n } from "../hooks/I18nContext";
import { useThemeMode } from "../hooks/ThemeContext";
import { openExportDocument } from "../services/exportService";
import { fetchGradeJournal, fetchGradesByStudent, saveGradeJournalValue } from "../services/gradesService";
import { fetchScheduleByGroup } from "../services/scheduleService";
import { fetchModuleSummary, saveModuleSummary } from "../services/testsService";

function readableDate(value) {
  if (!value || typeof value !== "string") return "-";
  return value.split("T")[0];
}

function shortDateLabel(value) {
  if (!value || typeof value !== "string") return value || "";
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return value;
  return `${day}.${month}`;
}

function normalizeJournalGradeValue(rawValue) {
  const normalized = String(rawValue || "").trim().toLowerCase();
  if (["1", "2", "3", "4", "5"].includes(normalized)) {
    return normalized;
  }
  if (normalized === "нб" || normalized === "nb") {
    return "НБ";
  }
  return "";
}

const DAY_TO_WEEKDAY = {
  monday: 0,
  mon: 0,
  tuesday: 1,
  tue: 1,
  tues: 1,
  wednesday: 2,
  wed: 2,
  thursday: 3,
  thu: 3,
  thur: 3,
  thurs: 3,
  friday: 4,
  fri: 4,
  saturday: 5,
  sat: 5,
  "понедельник": 0,
  "пн": 0,
  "вторник": 1,
  "вт": 1,
  "среда": 2,
  "ср": 2,
  "четверг": 3,
  "чт": 3,
  "пятница": 4,
  "пт": 4,
  "суббота": 5,
  "сб": 5,
  "дүйшөмбү": 0,
  "шейшемби": 1,
  "шаршемби": 2,
  "бейшемби": 3,
  "жума": 4,
  "ишемби": 5,
};

function weekdayFromLabel(value) {
  return DAY_TO_WEEKDAY[String(value || "").trim().toLowerCase()];
}

function buildDatesByWeekdays(weekdaySet) {
  const normalizedSet = weekdaySet instanceof Set ? weekdaySet : new Set();
  if (!normalizedSet.size) {
    return [];
  }

  const today = new Date();
  const start = new Date(today.getFullYear(), 1, 1);
  const result = [];
  const cursor = new Date(start);

  while (cursor <= today) {
    if (normalizedSet.has(cursor.getDay() === 0 ? 6 : cursor.getDay() - 1)) {
      const y = cursor.getFullYear();
      const m = String(cursor.getMonth() + 1).padStart(2, "0");
      const d = String(cursor.getDate()).padStart(2, "0");
      result.push(`${y}-${m}-${d}`);
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  return result;
}

export default function GradesScreen({ navigation }) {
  const { role, userId, token, groupId } = useAuth();
  const { t, language } = useI18n();
  const { theme } = useThemeMode();

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState("grades");
  const [targetStudentId, setTargetStudentId] = useState("");
  const [gradeJournal, setGradeJournal] = useState(null);
  const [gradeJournalLoading, setGradeJournalLoading] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [selectedJournalSubject, setSelectedJournalSubject] = useState("");
  const [savingGradeCellKey, setSavingGradeCellKey] = useState("");
  const [activeJournalCellKey, setActiveJournalCellKey] = useState("");
  const [journalDraftByCell, setJournalDraftByCell] = useState({});
  const [studentScheduleSubjects, setStudentScheduleSubjects] = useState([]);
  const [studentScheduleWeekdays, setStudentScheduleWeekdays] = useState(new Set());

  const [moduleSummary, setModuleSummary] = useState(null);
  const [moduleSaving, setModuleSaving] = useState(false);
  const [moduleSubject, setModuleSubject] = useState("");
  const [module1TeacherPoints, setModule1TeacherPoints] = useState("");
  const [module2TeacherPoints, setModule2TeacherPoints] = useState("");
  const [moduleExamPoints, setModuleExamPoints] = useState("");
  const [moduleBonusPoints, setModuleBonusPoints] = useState("");
  const [moduleComment, setModuleComment] = useState("");

  const populateTeacherModuleForm = useCallback(
    (data, preferredSubject = "") => {
      if (role !== "teacher") {
        setModuleSubject("");
        setModule1TeacherPoints("");
        setModule2TeacherPoints("");
        setModuleExamPoints("");
        setModuleBonusPoints("");
        setModuleComment("");
        return;
      }

      const allEntries = Array.isArray(data?.teacher_entries) ? data.teacher_entries : [];
      const ownEntries = allEntries.filter((row) => Number(row?.teacher_id) === Number(userId));
      const availableSubjects = (Array.isArray(data?.subjects) ? data.subjects : [])
        .map((item) => String(item?.subject || "").trim())
        .filter(Boolean);

      const ownSubjects = ownEntries.map((row) => String(row?.subject || "").trim()).filter(Boolean);
      const normalizedPreferred = String(preferredSubject || "").trim();

      let selectedSubject = normalizedPreferred;
      const hasPreferred =
        (availableSubjects.length === 0 || availableSubjects.includes(normalizedPreferred)) &&
        (ownSubjects.length === 0 || ownSubjects.includes(normalizedPreferred));

      if (!normalizedPreferred || !hasPreferred) {
        selectedSubject = ownSubjects[0] || availableSubjects[0] || "";
      }

      setModuleSubject(selectedSubject);

      const formSource =
        ownEntries.find((row) => String(row?.subject || "").trim() === selectedSubject) ||
        ownEntries[0] ||
        null;

      setModule1TeacherPoints(
        formSource?.module1_points === null || formSource?.module1_points === undefined
          ? ""
          : String(formSource.module1_points)
      );
      setModule2TeacherPoints(
        formSource?.module2_points === null || formSource?.module2_points === undefined
          ? ""
          : String(formSource.module2_points)
      );
      setModuleExamPoints(
        formSource?.exam_points === null || formSource?.exam_points === undefined
          ? ""
          : String(formSource.exam_points)
      );
      setModuleBonusPoints(
        formSource?.bonus_points === null || formSource?.bonus_points === undefined
          ? ""
          : String(formSource.bonus_points)
      );
      setModuleComment(String(formSource?.comment || ""));
    },
    [role, userId]
  );

  const loadGrades = useCallback(
    async (targetId) => {
      const ref = String(targetId || "").trim();
      if (!ref) return;

      setLoading(true);
      try {
        const data = await fetchGradesByStudent(ref);
        setRows(Array.isArray(data) ? data : []);
      } catch (error) {
        Alert.alert(t("grades"), error?.response?.data?.error || t("unknownError"));
      } finally {
        setLoading(false);
      }
    },
    [t]
  );

  const loadModule = useCallback(
    async (targetId, preferredSubject = "") => {
      const ref = String(targetId || "").trim();
      if (!ref) {
        setModuleSummary(null);
        setModuleSubject("");
        setModule1TeacherPoints("");
        setModule2TeacherPoints("");
        setModuleExamPoints("");
        setModuleBonusPoints("");
        setModuleComment("");
        return;
      }

      try {
        const data = await fetchModuleSummary(ref);
        setModuleSummary(data || null);
        populateTeacherModuleForm(data, preferredSubject);
      } catch (error) {
        setModuleSummary(null);
        const statusCode = Number(error?.response?.status || 0);
        if (statusCode && statusCode !== 404) {
          Alert.alert(t("grades"), error?.response?.data?.error || t("unknownError"));
        }
      }
    },
    [populateTeacherModuleForm, t]
  );

  const loadStudentScheduleMeta = useCallback(async () => {
    if (role !== "student" || !groupId) {
      setStudentScheduleSubjects([]);
      setStudentScheduleWeekdays(new Set());
      return;
    }

    try {
      const scheduleRows = await fetchScheduleByGroup(String(groupId));
      const list = Array.isArray(scheduleRows) ? scheduleRows : [];

      const subjectSet = new Set();
      const weekdaySet = new Set();

      list.forEach((row) => {
        const subjectValue = String(row?.subject || "").trim();
        if (subjectValue) {
          subjectSet.add(subjectValue);
        }
        const weekday = weekdayFromLabel(row?.day_of_week);
        if (weekday !== undefined) {
          weekdaySet.add(weekday);
        }
      });

      setStudentScheduleSubjects(Array.from(subjectSet).sort((a, b) => a.localeCompare(b, "ru")));
      setStudentScheduleWeekdays(weekdaySet);
    } catch {
      setStudentScheduleSubjects([]);
      setStudentScheduleWeekdays(new Set());
    }
  }, [groupId, role]);

  useEffect(() => {
    if (role === "student" && userId) {
      loadGrades(userId);
      loadModule(userId);
      loadStudentScheduleMeta();
    }
  }, [role, userId, loadGrades, loadModule, loadStudentScheduleMeta]);

  const loadGradeJournal = useCallback(
    async (overrides = {}) => {
      if (role !== "teacher" && role !== "admin") return;

      const nextGroupId =
        overrides.group_id !== undefined
          ? String(overrides.group_id || "").trim()
          : String(selectedGroupId || "").trim();
      const nextSubject =
        overrides.subject !== undefined
          ? String(overrides.subject || "").trim()
          : String(selectedJournalSubject || "").trim();

      const params = {};
      if (nextGroupId) params.group_id = nextGroupId;
      if (nextSubject) params.subject = nextSubject;

      setGradeJournalLoading(true);
      try {
        const data = await fetchGradeJournal(params);
        setGradeJournal(data || null);
        setSelectedGroupId(String(data?.group_id || ""));
        setSelectedJournalSubject(String(data?.subject || ""));
        setActiveJournalCellKey("");
        setJournalDraftByCell({});
      } catch (error) {
        Alert.alert(t("grades"), error?.response?.data?.error || t("unknownError"));
      } finally {
        setGradeJournalLoading(false);
      }
    },
    [role, selectedGroupId, selectedJournalSubject, t]
  );

  useEffect(() => {
    if (role === "teacher" || role === "admin") {
      loadGradeJournal({});
    }
  }, [role, loadGradeJournal]);

  const onRefresh = useCallback(async () => {
    if (role === "student" && userId) {
      await loadGrades(userId);
      await loadModule(userId, moduleSubject);
      await loadStudentScheduleMeta();
      return;
    }

    if (role === "teacher" || role === "admin") {
      await loadGradeJournal({ group_id: selectedGroupId, subject: selectedJournalSubject });
    }

    if (targetStudentId.trim()) {
      await loadGrades(targetStudentId.trim());
      await loadModule(targetStudentId.trim(), moduleSubject);
    }
  }, [
    loadGradeJournal,
    loadGrades,
    loadModule,
    loadStudentScheduleMeta,
    moduleSubject,
    role,
    selectedGroupId,
    selectedJournalSubject,
    targetStudentId,
    userId,
  ]);

  const onSaveModule = async () => {
    const studentRef = targetStudentId.trim();
    if (!studentRef) {
      Alert.alert(t("grades"), t("studentId"));
      return;
    }

    const normalizedSubject = String(moduleSubject || "").trim();
    if (!normalizedSubject) {
      Alert.alert(t("modulesTab"), t("subject"));
      return;
    }

    const payload = {
      student_id: studentRef,
      subject: normalizedSubject,
      module1_points: module1TeacherPoints.trim(),
      module2_points: module2TeacherPoints.trim(),
      exam_points: moduleExamPoints.trim(),
      bonus_points: moduleBonusPoints.trim(),
      comment: moduleComment,
    };

    setModuleSaving(true);
    try {
      const data = await saveModuleSummary(payload);
      setModuleSummary(data || null);
      await loadModule(studentRef, normalizedSubject);
    } catch (error) {
      Alert.alert(t("grades"), error?.response?.data?.error || t("unknownError"));
    } finally {
      setModuleSaving(false);
    }
  };

  const onSetJournalGrade = useCallback(
    async (studentRef, dateValue, nextValue) => {
      if (role !== "teacher") return false;

      const studentIdValue = String(studentRef || "").trim();
      const subjectValue = String(selectedJournalSubject || "").trim();
      const dayValue = String(dateValue || "").trim();
      const valueToSave = normalizeJournalGradeValue(nextValue);
      if (!studentIdValue || !subjectValue || !dayValue || !valueToSave) {
        return false;
      }

      const cellKey = `${studentIdValue}:${dayValue}`;
      setSavingGradeCellKey(cellKey);
      try {
        await saveGradeJournalValue({
          student_id: studentIdValue,
          subject: subjectValue,
          value: valueToSave,
          date: dayValue,
        });
        await loadGradeJournal({ group_id: selectedGroupId, subject: subjectValue });
        return true;
      } catch (error) {
        Alert.alert(t("grades"), error?.response?.data?.error || t("unknownError"));
        return false;
      } finally {
        setSavingGradeCellKey("");
      }
    },
    [loadGradeJournal, role, selectedGroupId, selectedJournalSubject, t]
  );

  const closeJournalCell = useCallback((cellKey) => {
    const normalizedCellKey = String(cellKey || "").trim();
    if (!normalizedCellKey) return;
    setActiveJournalCellKey((prev) => (prev === normalizedCellKey ? "" : prev));
    setJournalDraftByCell((prev) => {
      if (!Object.prototype.hasOwnProperty.call(prev, normalizedCellKey)) {
        return prev;
      }
      const next = { ...prev };
      delete next[normalizedCellKey];
      return next;
    });
  }, []);

  const onStartJournalEdit = useCallback(
    (row, dayValue) => {
      if (role !== "teacher") return;

      const studentId = String(row?.student_id || "").trim();
      const dateValue = String(dayValue || "").trim();
      if (!studentId || !dateValue) return;

      const cellKey = `${studentId}:${dateValue}`;
      const currentValue = String(row?.grades?.[dateValue] || "").trim();

      setActiveJournalCellKey(cellKey);
      setJournalDraftByCell((prev) => ({ ...prev, [cellKey]: currentValue }));
    },
    [role]
  );

  const onCommitJournalCell = useCallback(
    async (studentId, dayValue, currentValue) => {
      if (role !== "teacher") return;

      const normalizedStudentId = String(studentId || "").trim();
      const normalizedDay = String(dayValue || "").trim();
      if (!normalizedStudentId || !normalizedDay) return;

      const cellKey = `${normalizedStudentId}:${normalizedDay}`;
      if (savingGradeCellKey === cellKey) return;

      const rawDraft = String(
        Object.prototype.hasOwnProperty.call(journalDraftByCell, cellKey)
          ? journalDraftByCell[cellKey]
          : currentValue || ""
      ).trim();

      if (!rawDraft) {
        closeJournalCell(cellKey);
        return;
      }

      const normalizedValue = normalizeJournalGradeValue(rawDraft);
      if (!normalizedValue) {
        Alert.alert(t("grades"), t("gradeJournalAllowedValues"));
        return;
      }

      const normalizedCurrentValue = normalizeJournalGradeValue(currentValue);
      if (normalizedCurrentValue === normalizedValue) {
        closeJournalCell(cellKey);
        return;
      }

      const success = await onSetJournalGrade(normalizedStudentId, normalizedDay, normalizedValue);
      if (success) {
        closeJournalCell(cellKey);
      }
    },
    [closeJournalCell, journalDraftByCell, onSetJournalGrade, role, savingGradeCellKey, t]
  );

  const onOpenModuleDetails = useCallback(
    (subjectItem) => {
      if (!subjectItem) return;
      navigation.navigate("ModuleDetails", { subjectItem });
    },
    [navigation]
  );

  const onExport = async (format) => {
    const targetRef = role === "student" ? String(userId || "") : targetStudentId.trim();
    if (!targetRef) {
      Alert.alert(t("grades"), t("selectStudentForExport"));
      return;
    }

    try {
      await openExportDocument({
        entity: "grades",
        target: targetRef,
        format,
        token,
        language,
      });
    } catch {
      Alert.alert(t("grades"), t("unknownError"));
    }
  };

  const exportMenuOptions = useMemo(
    () => [
      { key: "grades-html", label: t("exportHtml"), onPress: () => onExport("html") },
      { key: "grades-pdf", label: t("exportPdf"), onPress: () => onExport("pdf") },
      { key: "grades-xlsx", label: t("exportExcel"), onPress: () => onExport("xlsx") },
    ],
    [onExport, t]
  );

  useLayoutEffect(() => {
    if (role !== "student" || Platform.OS === "web") {
      return;
    }

    navigation.setOptions({
      headerRight: () => (
        <View style={styles.headerRightWrap}>
          <OverflowMenu buttonHint={t("export")} options={exportMenuOptions} style={styles.headerMenuButton} />
          <BrandLogo size={22} showText={false} />
        </View>
      ),
    });
  }, [exportMenuOptions, navigation, role, t]);

  const showInlineExportMenu = role !== "student" || Platform.OS === "web";

  const gradeColumns = useMemo(() => {
    return [
      { key: "subject", title: t("subject") },
      { key: "value", title: t("value"), align: "center" },
      { key: "created_at", title: t("date"), render: (row) => readableDate(row.created_at), align: "center" },
    ];
  }, [t]);

  const journalDates = useMemo(() => {
    const source = Array.isArray(gradeJournal?.dates) ? gradeJournal.dates : [];
    return source.filter((item) => Boolean(String(item || "").trim()));
  }, [gradeJournal?.dates]);

  const journalRows = useMemo(() => {
    const source = Array.isArray(gradeJournal?.students) ? gradeJournal.students : [];
    return source.map((row, index) => ({
      id: `${row.student_id || "student"}-${index}`,
      student_id: row.student_id,
      student: row.full_name || row.login || `#${row.student_id || "-"}`,
      grades: row.grades || {},
    }));
  }, [gradeJournal?.students]);

  const journalTableMinWidth = useMemo(
    () => 320 + journalDates.length * 112,
    [journalDates.length]
  );

  const journalColumns = useMemo(
    () => {
      const baseColumns = [
        {
          key: "student",
          title: t("student"),
          width: 320,
          render: (row) => (
            <Text style={[styles.studentCellText, { color: theme.colors.text, fontFamily: theme.fonts.medium }]}>
              {row.student}
            </Text>
          ),
        },
      ];

      const dateColumns = journalDates.map((dayValue) => ({
        key: `day-${dayValue}`,
        title: shortDateLabel(dayValue),
        width: 112,
        noPadding: true,
        align: "center",
        render: (row) => {
          const cellKey = `${row.student_id}:${dayValue}`;
          const currentValue = String(row?.grades?.[dayValue] || "").trim();
          const draftValue = String(
            Object.prototype.hasOwnProperty.call(journalDraftByCell, cellKey)
              ? journalDraftByCell[cellKey]
              : currentValue
          );
          const isActive = activeJournalCellKey === cellKey;
          const isSaving = savingGradeCellKey === cellKey;
          const canEdit = role === "teacher";

          if (canEdit && isActive) {
            return (
              <TextInput
                value={draftValue}
                onChangeText={(textValue) => {
                  setJournalDraftByCell((prev) => ({ ...prev, [cellKey]: textValue }));
                }}
                onBlur={() => onCommitJournalCell(row.student_id, dayValue, currentValue)}
                onSubmitEditing={() => onCommitJournalCell(row.student_id, dayValue, currentValue)}
                autoFocus
                editable={!isSaving}
                maxLength={2}
                selectTextOnFocus
                returnKeyType="done"
                blurOnSubmit
                placeholder="-"
                placeholderTextColor={theme.colors.textMuted}
                style={[
                  styles.journalCellInput,
                  {
                    borderColor: theme.colors.border,
                    color: theme.colors.text,
                    backgroundColor: theme.colors.surface,
                    fontFamily: theme.fonts.medium,
                  },
                  isSaving ? styles.journalCellSaving : null,
                ]}
              />
            );
          }

          return (
            <Pressable
              onPress={() => onStartJournalEdit(row, dayValue)}
              disabled={!canEdit || isSaving}
              style={[
                styles.journalCell,
                { borderColor: theme.colors.border, backgroundColor: theme.colors.surface },
                isSaving ? styles.journalCellSaving : null,
              ]}
            >
              <Text style={[styles.journalCellText, { color: theme.colors.text, fontFamily: theme.fonts.medium }]}>
                {currentValue || " "}
              </Text>
            </Pressable>
          );
        },
      }));

      return [...baseColumns, ...dateColumns];
    },
    [
      activeJournalCellKey,
      journalDates,
      journalDraftByCell,
      onCommitJournalCell,
      onStartJournalEdit,
      role,
      savingGradeCellKey,
      t,
      theme.colors,
      theme.fonts,
    ]
  );

  const studentJournalData = useMemo(() => {
    if (role !== "student") {
      return { dates: [], rows: [] };
    }

    const bySubject = new Map();
    const gradedDateSet = new Set();

    rows.forEach((item) => {
      const subject = String(item?.subject || "").trim();
      const dateValue = readableDate(item?.created_at);
      if (!subject || !/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
        return;
      }

      gradedDateSet.add(dateValue);

      if (!bySubject.has(subject)) {
        bySubject.set(subject, new Map());
      }
      const subjectMap = bySubject.get(subject);
      const prev = subjectMap.get(dateValue);
      const timestamp = String(item?.created_at || dateValue);
      if (!prev || String(prev.timestamp) < timestamp) {
        subjectMap.set(dateValue, {
          value: String(item?.value || "").trim(),
          timestamp,
        });
      }
    });

    const orderedSubjects = [];
    const scheduleSubjects = Array.isArray(studentScheduleSubjects) ? studentScheduleSubjects : [];
    const moduleSubjects = Array.isArray(moduleSummary?.subjects)
      ? moduleSummary.subjects.map((item) => String(item?.subject || "").trim()).filter(Boolean)
      : [];
    const baseSubjects = [...scheduleSubjects, ...moduleSubjects];
    baseSubjects.forEach((subjectValue) => {
      const normalized = String(subjectValue || "").trim();
      if (normalized && !orderedSubjects.includes(normalized)) {
        orderedSubjects.push(normalized);
      }
    });
    Array.from(bySubject.keys())
      .sort((a, b) => String(a || "").localeCompare(String(b || ""), "ru"))
      .forEach((subjectValue) => {
        const normalized = String(subjectValue || "").trim();
        if (normalized && !orderedSubjects.includes(normalized)) {
          orderedSubjects.push(normalized);
        }
      });

    const dateSet = new Set(buildDatesByWeekdays(studentScheduleWeekdays));
    gradedDateSet.forEach((dayValue) => dateSet.add(dayValue));

    const dates = Array.from(dateSet).sort();
    const resultRows = orderedSubjects.map((subject, index) => {
      const subjectMap = bySubject.get(subject) || new Map();
      const grades = {};
      dates.forEach((dayValue) => {
        grades[dayValue] = subjectMap.get(dayValue)?.value || "";
      });
      return {
        id: `my-grade-subject-${index}`,
        subject,
        grades,
      };
    });

    return { dates, rows: resultRows };
  }, [moduleSummary?.subjects, role, rows, studentScheduleSubjects, studentScheduleWeekdays]);

  const studentGradeMinWidth = useMemo(
    () => 320 + studentJournalData.dates.length * 112,
    [studentJournalData.dates.length]
  );

  const studentGradeColumns = useMemo(() => {
    const baseColumns = [
      {
        key: "subject",
        title: t("subject"),
        width: 320,
        render: (row) => (
          <Text style={[styles.studentCellText, { color: theme.colors.text, fontFamily: theme.fonts.medium }]}>
            {row.subject}
          </Text>
        ),
      },
    ];

    const dateColumns = studentJournalData.dates.map((dayValue) => ({
      key: `student-day-${dayValue}`,
      title: shortDateLabel(dayValue),
      width: 112,
      noPadding: true,
      align: "center",
      render: (row) => {
        const value = String(row?.grades?.[dayValue] || "").trim();
        return (
          <View style={[styles.studentJournalCell, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}>
            <Text style={[styles.studentJournalValue, { color: theme.colors.text, fontFamily: theme.fonts.medium }]}>
              {value || " "}
            </Text>
          </View>
        );
      },
    }));

    return [...baseColumns, ...dateColumns];
  }, [studentJournalData.dates, t, theme.colors, theme.fonts]);

  const moduleRows = useMemo(() => {
    const source = Array.isArray(moduleSummary?.subjects) ? moduleSummary.subjects : [];
    return source.map((item, index) => ({
      id: `${String(item?.subject || "subject")}-${index}`,
      subject: String(item?.subject || "-"),
      score: Number(item?.total_points || 0),
      last_date: readableDate(item?.last_date),
      raw: item,
    }));
  }, [moduleSummary?.subjects]);

  const moduleColumns = useMemo(
    () => [
      { key: "subject", title: t("subject") },
      {
        key: "score",
        title: t("moduleScore"),
        align: "center",
        render: (row) => (
          <Pressable onPress={() => onOpenModuleDetails(row.raw)} style={styles.scoreCellPressable}>
            <Text style={[styles.scoreLink, { color: theme.colors.text }]}>{String(row.score)}</Text>
          </Pressable>
        ),
      },
      { key: "last_date", title: t("lastDate"), align: "center" },
    ],
    [onOpenModuleDetails, t, theme.colors.text]
  );

  const showTeacherModuleEditor = role === "teacher";
  const showLoadCard = role === "admin" || (role === "teacher" && viewMode === "modules");

  return (
    <ScreenLayout onRefresh={onRefresh} refreshing={loading}>
      {Platform.OS === "web" ? (
        <Text style={[styles.title, { color: theme.colors.text, fontFamily: theme.fonts.bold }]}>
          {role === "student" ? t("myGrades") : t("grades")}
        </Text>
      ) : null}

      <AppCard style={styles.tabsCard}>
        <View style={styles.tabsRow}>
          <AppButton
            title={t("grades")}
            variant={viewMode === "grades" ? "primary" : "ghost"}
            onPress={() => setViewMode("grades")}
            style={styles.tabButton}
          />
          <AppButton
            title={t("modulesTab")}
            variant={viewMode === "modules" ? "primary" : "ghost"}
            onPress={() => setViewMode("modules")}
            style={styles.tabButton}
          />
        </View>
      </AppCard>

      {viewMode === "grades" && (role === "teacher" || role === "admin") ? (
        <AppCard>
          <Text style={[styles.sectionTitle, { color: theme.colors.text, fontFamily: theme.fonts.bold }]}>
            {t("gradeJournal")}
          </Text>

          <Text style={[styles.label, { color: theme.colors.text, fontFamily: theme.fonts.medium }]}>
            {t("chooseGroup")}
          </Text>
          <View style={styles.selectorRow}>
            {(gradeJournal?.groups || []).map((group) => (
              <AppButton
                key={`group-${group.id}`}
                title={group.name}
                variant={String(selectedGroupId) === String(group.id) ? "primary" : "ghost"}
                onPress={() => loadGradeJournal({ group_id: group.id })}
                style={styles.selectorButton}
              />
            ))}
          </View>

          <Text style={[styles.label, { color: theme.colors.text, fontFamily: theme.fonts.medium }]}>
            {t("chooseSubject")}
          </Text>
          <View style={styles.selectorRow}>
            {(gradeJournal?.subjects || []).map((subjectItem) => (
              <AppButton
                key={`subject-${subjectItem}`}
                title={subjectItem}
                variant={String(selectedJournalSubject) === String(subjectItem) ? "primary" : "ghost"}
                onPress={() => loadGradeJournal({ group_id: selectedGroupId, subject: subjectItem })}
                style={styles.selectorButton}
              />
            ))}
          </View>

          <Text style={[styles.meta, { color: theme.colors.textMuted }]}>
            {gradeJournalLoading
              ? t("loading")
              : `${String(gradeJournal?.start_date || "").trim()} - ${String(gradeJournal?.end_date || "").trim()}`}
          </Text>

          <DataTable
            columns={journalColumns}
            rows={journalRows}
            emptyText={t("noData")}
            tableOnMobile
            horizontal
            minWidth={journalTableMinWidth}
          />
        </AppCard>
      ) : null}

      {showLoadCard ? (
        <AppCard>
          <Text style={[styles.sectionTitle, { color: theme.colors.text, fontFamily: theme.fonts.bold }]}>
            {t("loadGrades")}
          </Text>
          <AppInput
            label={t("studentId")}
            value={targetStudentId}
            onChangeText={setTargetStudentId}
            placeholder={t("studentIdHint")}
          />
          <AppButton title={t("loadGrades")} onPress={onRefresh} />
        </AppCard>
      ) : null}

      {viewMode === "modules" && moduleSummary ? (
        <AppCard>
          <Text style={[styles.sectionTitle, { color: theme.colors.text, fontFamily: theme.fonts.bold }]}>
            {t("modulesTab")}
          </Text>
          <DataTable
            columns={moduleColumns}
            rows={moduleRows}
            emptyText={t("noData")}
            tableOnMobile
            horizontal
            minWidth={640}
          />

          {showTeacherModuleEditor ? (
            <>
              <Text style={[styles.sectionTitle, { color: theme.colors.text, fontFamily: theme.fonts.bold }]}>
                {t("moduleJournalEdit")}
              </Text>
              <AppInput
                label={t("subject")}
                value={moduleSubject}
                onChangeText={setModuleSubject}
                placeholder={t("moduleSubjectPlaceholder")}
              />
              <AppInput
                label={t("module1TeacherPointsLabel")}
                value={module1TeacherPoints}
                onChangeText={setModule1TeacherPoints}
                keyboardType="numeric"
              />
              <AppInput
                label={t("module2TeacherPointsLabel")}
                value={module2TeacherPoints}
                onChangeText={setModule2TeacherPoints}
                keyboardType="numeric"
              />
              <AppInput
                label={t("moduleExamPointsLabel")}
                value={moduleExamPoints}
                onChangeText={setModuleExamPoints}
                keyboardType="numeric"
              />
              <AppInput
                label={t("moduleBonusPointsLabel")}
                value={moduleBonusPoints}
                onChangeText={setModuleBonusPoints}
                keyboardType="numeric"
              />
              <AppInput
                label={t("description")}
                value={moduleComment}
                onChangeText={setModuleComment}
                multiline
                inputStyle={styles.commentInput}
              />
              <AppButton title={t("save")} onPress={onSaveModule} loading={moduleSaving} />
            </>
          ) : null}
        </AppCard>
      ) : null}

      {viewMode === "grades" && showInlineExportMenu ? (
        <View style={[styles.toolsRow, role === "student" ? styles.toolsRowRight : null]}>
          {role === "student" && Platform.OS !== "web" ? null : (
            <Text style={[styles.toolsLabel, { color: theme.colors.text, fontFamily: theme.fonts.medium }]}>
              {t("export")}
            </Text>
          )}
          <OverflowMenu buttonHint={t("export")} options={exportMenuOptions} />
        </View>
      ) : null}

      <Text style={[styles.meta, { color: theme.colors.textMuted }]}>{loading ? t("loading") : " "}</Text>
      {viewMode === "grades" ? (
        role === "student" ? (
          <DataTable
            columns={studentGradeColumns}
            rows={studentJournalData.rows}
            emptyText={t("noData")}
            tableOnMobile
            horizontal
            minWidth={studentGradeMinWidth}
          />
        ) : (
          <DataTable
            columns={gradeColumns}
            rows={rows}
            emptyText={t("noData")}
            tableOnMobile
            horizontal
            minWidth={760}
          />
        )
      ) : null}
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 22,
    marginBottom: 12,
  },
  tabsCard: {
    marginBottom: 10,
  },
  tabsRow: {
    flexDirection: "row",
    gap: 8,
  },
  tabButton: {
    minHeight: 36,
    paddingHorizontal: 12,
  },
  sectionTitle: {
    fontSize: 17,
    marginBottom: 12,
  },
  label: {
    fontSize: 13,
    marginBottom: 6,
  },
  selectorRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 10,
  },
  selectorButton: {
    minHeight: 34,
    paddingHorizontal: 10,
  },
  meta: {
    marginBottom: 8,
    fontSize: 12,
    fontFamily: "serif",
  },
  toolsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  toolsRowRight: {
    justifyContent: "flex-end",
  },
  toolsLabel: {
    fontSize: 14,
  },
  scoreLink: {
    fontSize: 14,
    fontFamily: Platform.select({
      ios: "Menlo",
      android: "monospace",
      default: "monospace",
    }),
    textDecorationLine: "underline",
    width: "100%",
    textAlign: "center",
    fontVariant: ["tabular-nums"],
    includeFontPadding: false,
  },
  scoreCellPressable: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  studentCellText: {
    fontSize: 16,
  },
  journalCell: {
    borderWidth: 1,
    borderRadius: 10,
    minHeight: 52,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 6,
    paddingVertical: 8,
  },
  journalCellSaving: {
    opacity: 0.45,
  },
  journalCellInput: {
    minHeight: 52,
    borderWidth: 1,
    borderRadius: 10,
    textAlign: "center",
    fontSize: 18,
    paddingHorizontal: 6,
    paddingVertical: 8,
    fontVariant: ["tabular-nums"],
    includeFontPadding: false,
  },
  journalCellText: {
    fontSize: 18,
    textAlign: "center",
    fontVariant: ["tabular-nums"],
    includeFontPadding: false,
  },
  studentJournalCell: {
    borderWidth: 1,
    borderRadius: 10,
    minHeight: 52,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 6,
    paddingVertical: 8,
  },
  studentJournalValue: {
    fontSize: 18,
    textAlign: "center",
    fontVariant: ["tabular-nums"],
    includeFontPadding: false,
  },
  commentInput: {
    minHeight: 70,
    textAlignVertical: "top",
  },
  headerRightWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingRight: 10,
  },
  headerMenuButton: {
    width: 34,
    height: 32,
    borderRadius: 9,
  },
});
