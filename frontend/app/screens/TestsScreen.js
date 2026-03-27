/**
 * Module: app/screens/TestsScreen.js
 *
 * Purpose:
 * - Screen module for TestsScreen. Handles state, data loading, and UI for this route.
 *
 * Module notes:
 * - Imports count: 13.
 * - This header is written for beginners: read purpose first, then function map below.
 *
 * Function map:
 * - TestsScreen: Main React component or UI container exported by this file.
 * - parseServerDateToMs: Transforms input/output values to stable display or API format.
 * - formatTime: Transforms input/output values to stable display or API format.
 * - makeQuestionDraft: Helper function used by this module business logic.
 * - makeQuestionDrafts: Helper function used by this module business logic.
 * - buildTeacherRows: Builds derived values and resolves runtime decisions.
 * - refreshAfterSubmit: Helper function used by this module business logic.
 * - openTestSession: Controls modal/sheet/screen visibility or navigation transition.
 * - onSelectAnswer: Callback function invoked by UI or navigation events.
 * - onCreateTest: Callback function invoked by UI or navigation events.
 * - onActivateTest: Callback function invoked by UI or navigation events.
 * - updateRemaining: Updates existing data or state values.
 * - preventAction: Helper function used by this module business logic.
 * - preventHotkeys: Helper function used by this module business logic.
 * - toggleGroupForActivation: Toggles boolean state or switches between two modes.
 * - setQuestionDraftValue: Applies value updates to state/configuration.
 * - setQuestionOptionValue: Applies value updates to state/configuration.
 * - toggleCorrectOption: Toggles boolean state or switches between two modes.
 * - generateQuestions: Helper function used by this module business logic.
 * - addQuestion: Helper function used by this module business logic.
 * - renderRoleTabs: Builds and returns a UI fragment for rendering.
 * - renderTeacherCreate: Builds and returns a UI fragment for rendering.
 * - renderTeacherList: Builds and returns a UI fragment for rendering.
 * - renderAdminActivation: Builds and returns a UI fragment for rendering.
 * - renderAdminList: Builds and returns a UI fragment for rendering.
 * - renderStudentList: Builds and returns a UI fragment for rendering.
 * - renderStudentActiveSession: Builds and returns a UI fragment for rendering.
 * - loadTests: Loads remote/local data and updates screen/component state.
 * - bootstrap: Helper function used by this module business logic.
 * - subscription: Helper function used by this module business logic.
 * - currentQuestion: Helper function used by this module business logic.
 * - answeredCount: Helper function used by this module business logic.
 * - canSubmitCurrent: Helper function used by this module business logic.
 * - resetTeacherForm: Helper function used by this module business logic.
 * - mapServerQuestionsToDrafts: Helper function used by this module business logic.
 * - options: Helper function used by this module business logic.
 * - teacherAdminColumns: Helper function used by this module business logic.
 * - adminRows: Helper function used by this module business logic.
 * - sortedAdminStudents: Helper function used by this module business logic.
 * - filteredAdminStudents: Helper function used by this module business logic.
 * - studentFiltered: Helper function used by this module business logic.
 * - onAllowRetake: Callback function invoked by UI or navigation events.
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, AppState, Modal, Platform, StyleSheet, Text, View } from "react-native";

import AppButton from "../components/AppButton";
import AppCard from "../components/AppCard";
import AppInput from "../components/AppInput";
import DataTable from "../components/DataTable";
import ScreenLayout from "../components/ScreenLayout";
import { useAuth } from "../hooks/AuthContext";
import { useI18n } from "../hooks/I18nContext";
import { useThemeMode } from "../hooks/ThemeContext";
import { fetchGroups } from "../services/academyService";
import {
  activateTest,
  allowRetake,
  createTest,
  deactivateTest,
  fetchTestDetail,
  fetchTests,
  startTestAttempt,
  submitTest,
  syncTestProgress,
  updateTest,
} from "../services/testsService";
import { fetchMyDetails, fetchUsers } from "../services/usersService";

function parseServerDateToMs(value) {
  const raw = String(value || "").trim();
  if (!raw) return Date.now();

  if (/[zZ]$/.test(raw) || /[+-]\d{2}:\d{2}$/.test(raw)) {
    return new Date(raw).getTime();
  }

  return new Date(`${raw}Z`).getTime();
}

function formatTime(totalSeconds) {
  const safe = Math.max(0, Number(totalSeconds) || 0);
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function makeQuestionDraft(index) {
  return {
    localId: `q-${Date.now()}-${index}`,
    text: "",
    options: ["", "", "", ""],
    correctIndexes: [],
  };
}

function makeQuestionDrafts(count) {
  const safe = Math.max(1, Number(count) || 1);
  return Array.from({ length: safe }, (_, idx) => makeQuestionDraft(idx + 1));
}

function buildTeacherRows(tests) {
  return tests.map((item) => {
    const groups = item?.activation?.groups || [];
    const forAll = item?.activation?.for_all;
    const scopeValue = forAll ? "ALL" : groups.length ? groups.join(", ") : "-";
    const moduleLabel = Number(item?.module_no) === 2 ? "M2" : "M1";

    return {
      id: item.id,
      module: moduleLabel,
      subject: item.subject || "-",
      timer_minutes: item.timer_minutes,
      questions_count: item.questions_count,
      questions_to_use: item.questions_to_use || "-",
      activation_scope: scopeValue,
    };
  });
}

export default function TestsScreen() {
  const { role } = useAuth();
  const { t } = useI18n();
  const { theme } = useThemeMode();

  const [tests, setTests] = useState([]);
  const [loading, setLoading] = useState(false);

  const [teacherSubjects, setTeacherSubjects] = useState([]);
  const [selectedSubject, setSelectedSubject] = useState("");
  const [moduleNo, setModuleNo] = useState("1");
  const [timerMinutes, setTimerMinutes] = useState("40");
  const [questionsToUse, setQuestionsToUse] = useState("30");
  const [questionDrafts, setQuestionDrafts] = useState(() => makeQuestionDrafts(70));
  const [currentDraftQuestionIndex, setCurrentDraftQuestionIndex] = useState(0);

  const [groups, setGroups] = useState([]);
  const [selectedTestId, setSelectedTestId] = useState("");
  const [activationMode, setActivationMode] = useState("all");
  const [targetStudentId, setTargetStudentId] = useState("");
  const [selectedGroupIds, setSelectedGroupIds] = useState([]);
  const [activationDurationValue, setActivationDurationValue] = useState("1");
  const [activationDurationUnit, setActivationDurationUnit] = useState("hours");
  const [groupFilter, setGroupFilter] = useState("all");
  const [studentGroupFilter, setStudentGroupFilter] = useState("all");
  const [adminStudents, setAdminStudents] = useState([]);

  const [activeSession, setActiveSession] = useState(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [remainingSec, setRemainingSec] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [autoSubmitTriggered, setAutoSubmitTriggered] = useState(false);
  const [privacyMasked, setPrivacyMasked] = useState(false);

  const [teacherTab, setTeacherTab] = useState("create");
  const [adminTab, setAdminTab] = useState("activate");
  const [editingTestId, setEditingTestId] = useState(null);
  const [loadingEditTest, setLoadingEditTest] = useState(false);
  const [savingTest, setSavingTest] = useState(false);
  const [deactivatingTestId, setDeactivatingTestId] = useState(null);
  const [allowingRetake, setAllowingRetake] = useState(false);
  const [resultModal, setResultModal] = useState({
    visible: false,
    score: 0,
    total: 0,
  });

  const loadTests = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchTests();
      setTests(Array.isArray(data) ? data : []);
    } catch (error) {
      Alert.alert(t("tests"), error?.response?.data?.error || t("unknownError"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  const bootstrap = useCallback(async () => {
    try {
      if (role === "teacher") {
        const profile = await fetchMyDetails();
        const subjects = Array.isArray(profile?.details?.subjects) ? profile.details.subjects : [];
        setTeacherSubjects(subjects);
        if (subjects.length && !selectedSubject) {
          setSelectedSubject(subjects[0]);
        }
      }

      if (role === "admin") {
        const [list, usersList] = await Promise.all([fetchGroups(), fetchUsers()]);
        setGroups(Array.isArray(list) ? list : []);
        setAdminStudents(
          (Array.isArray(usersList) ? usersList : []).filter((item) => String(item?.role || "").toLowerCase() === "student")
        );
      }

      await loadTests();
    } catch (error) {
      Alert.alert(t("tests"), error?.response?.data?.error || t("unknownError"));
    }
  }, [loadTests, role, selectedSubject, t]);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  useEffect(() => {
    setCurrentDraftQuestionIndex((prev) => {
      if (!questionDrafts.length) return 0;
      return Math.min(Math.max(0, prev), questionDrafts.length - 1);
    });
  }, [questionDrafts.length]);

  useEffect(() => {
    if (!activeSession) return undefined;

    const updateRemaining = () => {
      const expiresAtMs = parseServerDateToMs(activeSession.expires_at);
      const nowMs = Date.now();
      const sec = Math.max(0, Math.floor((expiresAtMs - nowMs) / 1000));
      setRemainingSec(sec);
    };

    updateRemaining();
    const timerId = setInterval(updateRemaining, 1000);
    return () => clearInterval(timerId);
  }, [activeSession]);

  useEffect(() => {
    if (!activeSession || Platform.OS === "web") {
      setPrivacyMasked(false);
      return undefined;
    }

    const subscription = AppState.addEventListener("change", (status) => {
      setPrivacyMasked(status !== "active");
    });

    return () => {
      subscription?.remove?.();
    };
  }, [activeSession]);

  useEffect(() => {
    if (Platform.OS !== "web" || !activeSession) return undefined;

    const preventAction = (event) => {
      event.preventDefault();
    };
    const preventHotkeys = (event) => {
      const key = String(event?.key || "").toLowerCase();
      if ((event.ctrlKey || event.metaKey) && ["a", "c", "x", "p", "s"].includes(key)) {
        event.preventDefault();
      }
    };

    document.addEventListener("contextmenu", preventAction);
    document.addEventListener("copy", preventAction);
    document.addEventListener("cut", preventAction);
    document.addEventListener("keydown", preventHotkeys);

    return () => {
      document.removeEventListener("contextmenu", preventAction);
      document.removeEventListener("copy", preventAction);
      document.removeEventListener("cut", preventAction);
      document.removeEventListener("keydown", preventHotkeys);
    };
  }, [activeSession]);

  const totalQuestions = activeSession?.questions?.length || 0;
  const currentQuestion = useMemo(() => {
    if (!activeSession?.questions?.length) return null;
    return activeSession.questions[currentQuestionIndex] || null;
  }, [activeSession?.questions, currentQuestionIndex]);

  const answeredCount = useMemo(() => {
    if (!activeSession?.questions?.length) return 0;
    return activeSession.questions.filter((q) => {
      const value = answers[String(q.id)];
      return Array.isArray(value) ? value.length > 0 : Boolean(value);
    }).length;
  }, [activeSession?.questions, answers]);

  const canSubmitCurrent = useMemo(() => {
    if (!activeSession) return false;
    if (remainingSec <= 0) return true;
    return totalQuestions > 0 && answeredCount === totalQuestions;
  }, [activeSession, answeredCount, remainingSec, totalQuestions]);

  const refreshAfterSubmit = async () => {
    await loadTests();
    setActiveSession(null);
    setCurrentQuestionIndex(0);
    setAnswers({});
    setAutoSubmitTriggered(false);
  };

  const submitActiveTest = useCallback(
    async (force = false) => {
      if (!activeSession || submitting) return;
      if (!force && !canSubmitCurrent) {
        return;
      }

      setSubmitting(true);
      try {
        const result = await submitTest({
          test_id: Number(activeSession.test_id),
          answers,
        });

        await refreshAfterSubmit();
        setResultModal({
          visible: true,
          score: Number(result?.score || 0),
          total: Number(result?.total_questions || 0),
        });
      } catch (error) {
        Alert.alert(t("tests"), error?.response?.data?.error || t("unknownError"));
      } finally {
        setSubmitting(false);
      }
    },
    [activeSession, answers, canSubmitCurrent, submitting, t]
  );

  useEffect(() => {
    if (!activeSession || remainingSec > 0 || autoSubmitTriggered || submitting) return;
    setAutoSubmitTriggered(true);
    submitActiveTest(true);
  }, [activeSession, autoSubmitTriggered, remainingSec, submitActiveTest, submitting]);

  const toggleGroupForActivation = (groupName) => {
    setSelectedGroupIds((prev) => {
      if (prev.includes(groupName)) {
        return prev.filter((item) => item !== groupName);
      }
      return [...prev, groupName];
    });
  };

  const setQuestionDraftValue = (index, field, value) => {
    setQuestionDrafts((prev) =>
      prev.map((item, idx) => {
        if (idx !== index) return item;
        return { ...item, [field]: value };
      })
    );
  };

  const setQuestionOptionValue = (questionIndex, optionIndex, value) => {
    setQuestionDrafts((prev) =>
      prev.map((item, idx) => {
        if (idx !== questionIndex) return item;
        const nextOptions = [...item.options];
        nextOptions[optionIndex] = value;
        return { ...item, options: nextOptions };
      })
    );
  };

  const toggleCorrectOption = (questionIndex, optionIndex) => {
    setQuestionDrafts((prev) =>
      prev.map((item, idx) => {
        if (idx !== questionIndex) return item;
        const exists = item.correctIndexes.includes(optionIndex);
        const next = exists
          ? item.correctIndexes.filter((value) => value !== optionIndex)
          : [...item.correctIndexes, optionIndex];
        return { ...item, correctIndexes: next };
      })
    );
  };

  const generateQuestions = (count) => {
    setQuestionDrafts(makeQuestionDrafts(count));
    setCurrentDraftQuestionIndex(0);
  };

  const resetTeacherForm = useCallback(() => {
    setEditingTestId(null);
    setModuleNo("1");
    setTimerMinutes("40");
    setQuestionsToUse("30");
    generateQuestions(70);
  }, []);

  const mapServerQuestionsToDrafts = useCallback((questions) => {
    const source = Array.isArray(questions) ? questions : [];
    if (!source.length) {
      return makeQuestionDrafts(70);
    }

    return source.map((item, index) => {
      const optionsRaw = Array.isArray(item?.options) ? item.options : [];
      const options = optionsRaw.map((value) => String(value || "").trim()).slice(0, 4);
      while (options.length < 4) {
        options.push("");
      }

      const correctAnswers = Array.isArray(item?.correct_answers)
        ? item.correct_answers.map((value) => String(value || "").trim())
        : [];

      const correctIndexes = [];
      options.forEach((optionText, optionIndex) => {
        if (optionText && correctAnswers.includes(optionText)) {
          correctIndexes.push(optionIndex);
        }
      });

      return {
        localId: `q-edit-${Date.now()}-${index}`,
        text: String(item?.text || ""),
        options,
        correctIndexes,
      };
    });
  }, []);

  const addQuestion = () => {
    setQuestionDrafts((prev) => [...prev, makeQuestionDraft(prev.length + 1)]);
    setCurrentDraftQuestionIndex((prev) => Math.max(prev, questionDrafts.length));
  };

  const onStartEditTest = useCallback(
    async (testId) => {
      setLoadingEditTest(true);
      setEditingTestId(Number(testId));
      try {
        const detail = await fetchTestDetail(Number(testId));
        setTeacherTab("create");
        setEditingTestId(detail?.id || Number(testId));
        setSelectedSubject(String(detail?.subject || teacherSubjects?.[0] || ""));
        setModuleNo(String(detail?.module_no || 1));
        setTimerMinutes(String(detail?.timer_minutes || 40));
        setQuestionsToUse(String(detail?.questions_to_use || 30));
        setQuestionDrafts(mapServerQuestionsToDrafts(detail?.questions));
        setCurrentDraftQuestionIndex(0);
      } catch (error) {
        setEditingTestId(null);
        Alert.alert(t("tests"), error?.response?.data?.error || t("unknownError"));
      } finally {
        setLoadingEditTest(false);
      }
    },
    [mapServerQuestionsToDrafts, t, teacherSubjects]
  );

  const openTestSession = async (testId) => {
    try {
      const session = await startTestAttempt({ test_id: Number(testId) });
      setActiveSession(session);
      setAnswers(session?.answers || {});
      setCurrentQuestionIndex(0);
      setAutoSubmitTriggered(false);
      const initialRemaining = Number(session?.remaining_seconds || 0);
      setRemainingSec(initialRemaining);
      loadTests().catch(() => {});
    } catch (error) {
      Alert.alert(t("tests"), error?.response?.data?.error || t("unknownError"));
    }
  };

  const onSelectAnswer = async (questionId, optionValue) => {
    if (!activeSession) return;

    const key = String(questionId);
    const current = answers[key];
    const currentList = Array.isArray(current)
      ? [...current]
      : current
      ? [String(current)]
      : [];

    const optionStr = String(optionValue);
    const exists = currentList.includes(optionStr);
    const nextList = exists
      ? currentList.filter((item) => item !== optionStr)
      : [...currentList, optionStr];

    const nextAnswers = {
      ...answers,
      [key]: nextList,
    };

    setAnswers(nextAnswers);

    try {
      await syncTestProgress({
        test_id: Number(activeSession.test_id),
        answers: {
          [key]: nextList,
        },
      });
    } catch {
      // silent: local state remains, next sync/submit will retry
    }
  };

  const onCreateTest = async () => {
    if (savingTest) return;

    if (!selectedSubject.trim()) {
      Alert.alert(t("tests"), t("subject"));
      return;
    }

    const timerValue = Number(timerMinutes);
    if (!Number.isInteger(timerValue) || timerValue <= 0) {
      Alert.alert(t("tests"), "Timer must be a positive integer");
      return;
    }

    if (!Array.isArray(questionDrafts) || questionDrafts.length < 30) {
      Alert.alert(t("tests"), "Need at least 30 questions");
      return;
    }

    let questionsToUseValue = 30;
    if (String(questionsToUse || "").trim()) {
      const parsed = Number(questionsToUse);
      if (!Number.isInteger(parsed) || ![30, 40].includes(parsed)) {
        Alert.alert(t("tests"), "Questions in attempt must be 30 or 40");
        return;
      }
      if (parsed > questionDrafts.length) {
        Alert.alert(t("tests"), "Questions in attempt cannot exceed total questions");
        return;
      }
      questionsToUseValue = parsed;
    }

    const payloadQuestions = [];
    for (let index = 0; index < questionDrafts.length; index += 1) {
      const item = questionDrafts[index];
      const text = String(item.text || "").trim();
      const options = (item.options || []).map((value) => String(value || "").trim());
      const nonEmptyOptions = options.filter(Boolean);

      if (!text) {
        Alert.alert(t("tests"), `Question #${index + 1} has empty text`);
        return;
      }

      if (options.length !== 4 || nonEmptyOptions.length !== 4) {
        Alert.alert(t("tests"), `Question #${index + 1} must have exactly 4 options`);
        return;
      }

      const correctAnswers = (item.correctIndexes || [])
        .filter((optionIndex) => optionIndex >= 0 && optionIndex < options.length)
        .map((optionIndex) => options[optionIndex]);

      if (!correctAnswers.length) {
        Alert.alert(t("tests"), `Question #${index + 1} must have at least one correct option`);
        return;
      }

      payloadQuestions.push({
        text,
        options,
        correct_answers: correctAnswers,
      });
    }

    setSavingTest(true);
    try {
      const payload = {
        subject: selectedSubject,
        module_no: Number(moduleNo || 1),
        timer: timerValue,
        questions_to_use: questionsToUseValue,
        questions: payloadQuestions,
      };

      if (editingTestId) {
        await updateTest(Number(editingTestId), payload);
      } else {
        await createTest(payload);
      }

      resetTeacherForm();
      await loadTests();
      setTeacherTab("list");
    } catch (error) {
      Alert.alert(t("tests"), error?.response?.data?.error || t("unknownError"));
    } finally {
      setSavingTest(false);
    }
  };

  const onActivateTest = async () => {
    if (!selectedTestId) {
      Alert.alert(t("tests"), "Select test first");
      return;
    }

    const payload = {
      test_id: Number(selectedTestId),
      duration_value: Number(activationDurationValue || 1),
      duration_unit: activationDurationUnit,
    };

    if (!Number.isInteger(payload.duration_value) || payload.duration_value <= 0) {
      Alert.alert(t("tests"), t("timerMinutes"));
      return;
    }

    if (activationMode === "all") {
      payload.mode = "all";
      payload.for_all = true;
    } else if (activationMode === "student") {
      if (!targetStudentId.trim()) {
        Alert.alert(t("tests"), t("studentId"));
        return;
      }
      payload.mode = "student";
      payload.student_id = targetStudentId.trim();
    } else {
      if (!selectedGroupIds.length) {
        Alert.alert(t("tests"), t("group"));
        return;
      }
      payload.mode = "group";
      payload.target_groups = selectedGroupIds;
    }

    try {
      await activateTest(payload);
      await loadTests();
      setAdminTab("list");
    } catch (error) {
      Alert.alert(t("tests"), error?.response?.data?.error || t("unknownError"));
    }
  };

  const teacherAdminColumns = useMemo(() => {
    const baseColumns = [
      { key: "id", title: "ID" },
      { key: "module", title: "Module" },
      { key: "subject", title: t("subject") },
      { key: "timer_minutes", title: t("timerMinutes") },
      { key: "questions_count", title: t("questionPool") },
      { key: "questions_to_use", title: t("questionsInAttempt") },
      { key: "activation_scope", title: t("group") },
    ];

    if (role === "teacher") {
      baseColumns.push({
        key: "actions",
        title: t("actions"),
        render: (row) => (
          <AppButton
            title={t("edit")}
            variant="ghost"
            onPress={() => onStartEditTest(row.id)}
            style={styles.inlineEditButton}
            loading={loadingEditTest && Number(editingTestId) === Number(row.id)}
            disabled={loadingEditTest}
          />
        ),
      });
    }

    return baseColumns;
  }, [editingTestId, loadingEditTest, onStartEditTest, role, t]);

  const teacherRows = useMemo(
    () =>
      buildTeacherRows(tests).sort((a, b) => {
        if (a.module !== b.module) return String(a.module).localeCompare(String(b.module));
        if (a.subject !== b.subject) return String(a.subject).localeCompare(String(b.subject), "ru", { sensitivity: "base" });
        return Number(b.id || 0) - Number(a.id || 0);
      }),
    [tests]
  );

  const adminRows = useMemo(() => {
    const allRows = buildTeacherRows(tests);
    if (groupFilter === "all") return allRows;

    return allRows.filter((row) => {
      const scope = String(row.activation_scope || "");
      return scope.includes(groupFilter) || scope === "ALL";
    });
  }, [groupFilter, tests]);

  const adminActivationTests = useMemo(
    () =>
      [...tests].sort((a, b) => {
        const am = Number(a?.module_no || 1);
        const bm = Number(b?.module_no || 1);
        if (am !== bm) return am - bm;
        const as = String(a?.subject || "");
        const bs = String(b?.subject || "");
        if (as !== bs) return as.localeCompare(bs, "ru", { sensitivity: "base" });
        return Number(b?.id || 0) - Number(a?.id || 0);
      }),
    [tests]
  );

  const activeAdminTests = useMemo(
    () => adminActivationTests.filter((item) => Boolean(item?.activation?.active_now)),
    [adminActivationTests]
  );

  const sortedGroups = useMemo(
    () => [...groups].sort((a, b) => String(a?.name || "").localeCompare(String(b?.name || ""), "ru", { sensitivity: "base" })),
    [groups]
  );

  const sortedAdminStudents = useMemo(() => {
    const source = Array.isArray(adminStudents) ? adminStudents : [];
    return [...source].sort((a, b) => {
      const groupCompare = String(a?.group_id || "").localeCompare(String(b?.group_id || ""), undefined, {
        sensitivity: "base",
      });
      if (groupCompare !== 0) return groupCompare;

      const loginCompare = String(a?.login || "").localeCompare(String(b?.login || ""), undefined, {
        sensitivity: "base",
      });
      if (loginCompare !== 0) return loginCompare;

      return Number(a?.id || 0) - Number(b?.id || 0);
    });
  }, [adminStudents]);

  const filteredAdminStudents = useMemo(() => {
    if (studentGroupFilter === "all") return sortedAdminStudents;
    return sortedAdminStudents.filter(
      (item) => String(item?.group_id || "").toLowerCase() === String(studentGroupFilter || "").toLowerCase()
    );
  }, [sortedAdminStudents, studentGroupFilter]);

  useEffect(() => {
    if (activationMode !== "student") return;
    if (!targetStudentId.trim()) return;

    const exists = sortedAdminStudents.some(
      (item) =>
        String(item?.login || "").toLowerCase() === targetStudentId.trim().toLowerCase() ||
        String(item?.id || "") === targetStudentId.trim()
    );
    if (!exists) {
      setTargetStudentId("");
    }
  }, [activationMode, sortedAdminStudents, targetStudentId]);

  const studentFiltered = useMemo(() => {
    return tests.filter((item) => !item.attempted || item.in_progress);
  }, [tests]);

  const onDeactivateTest = useCallback(
    async (testId) => {
      if (!testId || deactivatingTestId) return;
      setDeactivatingTestId(Number(testId));
      try {
        const result = await deactivateTest({ test_id: Number(testId) });
        await loadTests();
        Alert.alert(t("tests"), `${t("deactivatedStatus")}: ${Number(result?.deactivated_count || 0)}`);
      } catch (error) {
        Alert.alert(t("tests"), error?.response?.data?.error || t("unknownError"));
      } finally {
        setDeactivatingTestId(null);
      }
    },
    [deactivatingTestId, loadTests, t]
  );

  const onAllowRetake = useCallback(async () => {
    if (allowingRetake) return;
    if (!selectedTestId) {
      Alert.alert(t("tests"), "Select test first");
      return;
    }
    if (!targetStudentId.trim()) {
      Alert.alert(t("tests"), t("studentId"));
      return;
    }

    setAllowingRetake(true);
    try {
      await allowRetake({
        test_id: Number(selectedTestId),
        student_id: targetStudentId.trim(),
      });
      await loadTests();
      Alert.alert(t("tests"), t("retakeAllowed"));
    } catch (error) {
      Alert.alert(t("tests"), error?.response?.data?.error || t("unknownError"));
    } finally {
      setAllowingRetake(false);
    }
  }, [allowingRetake, loadTests, selectedTestId, t, targetStudentId]);

  const renderRoleTabs = () => {
    if (role === "teacher") {
      return (
        <AppCard style={styles.tabsCard}>
          <View style={styles.tabsRow}>
            <AppButton
              title={t("createTest")}
              variant={teacherTab === "create" ? "primary" : "ghost"}
              onPress={() => setTeacherTab("create")}
              style={styles.tabButton}
            />
            <AppButton
              title={t("tests")}
              variant={teacherTab === "list" ? "primary" : "ghost"}
              onPress={() => setTeacherTab("list")}
              style={styles.tabButton}
            />
          </View>
        </AppCard>
      );
    }

    if (role === "admin") {
      return (
        <AppCard style={styles.tabsCard}>
          <View style={styles.tabsRow}>
            <AppButton
              title={t("activateTest")}
              variant={adminTab === "activate" ? "primary" : "ghost"}
              onPress={() => setAdminTab("activate")}
              style={styles.tabButton}
            />
            <AppButton
              title={t("tests")}
              variant={adminTab === "list" ? "primary" : "ghost"}
              onPress={() => setAdminTab("list")}
              style={styles.tabButton}
            />
          </View>
        </AppCard>
      );
    }

    return null;
  };

  const renderTeacherCreate = () => {
    const safeIndex = Math.min(Math.max(0, currentDraftQuestionIndex), Math.max(0, questionDrafts.length - 1));
    const questionItem = questionDrafts[safeIndex] || makeQuestionDraft(1);
    const poolCount = questionDrafts.length;
    const isEditMode = Boolean(editingTestId);

    return (
      <AppCard>
        <Text style={[styles.sectionTitle, { color: theme.colors.text, fontFamily: theme.fonts.bold }]}>
          {isEditMode ? t("editTest") : t("createTest")}
        </Text>

        {isEditMode ? (
          <View style={styles.editModeWrap}>
            <Text style={[styles.hintText, { color: theme.colors.textMuted, fontFamily: theme.fonts.regular }]}>
              {t("editingTestLabel")}: #{editingTestId}
            </Text>
            <AppButton title={t("cancel")} variant="ghost" onPress={resetTeacherForm} />
          </View>
        ) : null}

        <Text style={[styles.inlineLabel, { color: theme.colors.text, fontFamily: theme.fonts.medium }]}>
          {t("subject")}
        </Text>
        <View style={styles.selectorWrap}>
          {teacherSubjects.map((subjectValue) => (
            <AppButton
              key={`subject-${subjectValue}`}
              title={subjectValue}
              variant={selectedSubject === subjectValue ? "primary" : "ghost"}
              onPress={() => setSelectedSubject(subjectValue)}
              style={styles.selectorButton}
            />
          ))}
        </View>

        {!teacherSubjects.length ? (
          <Text style={[styles.hintText, { color: theme.colors.textMuted, fontFamily: theme.fonts.regular }]}>
            {t("teacherHasNoSubjects")}
          </Text>
        ) : null}

        <Text style={[styles.inlineLabel, { color: theme.colors.text, fontFamily: theme.fonts.medium }]}>
          Module
        </Text>
        <View style={styles.rowWrap}>
          <AppButton
            title="Module 1"
            variant={moduleNo === "1" ? "primary" : "ghost"}
            onPress={() => setModuleNo("1")}
            style={styles.selectorButton}
          />
          <AppButton
            title="Module 2"
            variant={moduleNo === "2" ? "primary" : "ghost"}
            onPress={() => setModuleNo("2")}
            style={styles.selectorButton}
          />
        </View>

        <AppInput label={t("timerMinutes")} value={timerMinutes} onChangeText={setTimerMinutes} keyboardType="numeric" />
        <AppCard style={styles.summaryCard}>
          <Text style={[styles.summaryTitle, { color: theme.colors.text, fontFamily: theme.fonts.bold }]}>
            {t("testQuestionConfig")}
          </Text>
          <Text style={[styles.summaryLine, { color: theme.colors.textMuted, fontFamily: theme.fonts.regular }]}>
            {t("questionPoolCount")}: {poolCount}
          </Text>
          <Text style={[styles.summaryLine, { color: theme.colors.textMuted, fontFamily: theme.fonts.regular }]}>
            {t("questionsInAttempt")}: {questionsToUse}
          </Text>
          <Text style={[styles.summaryLine, { color: theme.colors.textMuted, fontFamily: theme.fonts.regular }]}>
            {t("testRandomizationHint")}
          </Text>
        </AppCard>

        <AppInput label={t("questionsInAttempt")} value={questionsToUse} onChangeText={setQuestionsToUse} keyboardType="numeric" />
        <View style={styles.rowWrap}>
          <AppButton
            title="30"
            variant={String(questionsToUse).trim() === "30" ? "primary" : "ghost"}
            onPress={() => setQuestionsToUse("30")}
            style={styles.selectorButton}
          />
          <AppButton
            title="40"
            variant={String(questionsToUse).trim() === "40" ? "primary" : "ghost"}
            onPress={() => setQuestionsToUse("40")}
            style={styles.selectorButton}
          />
        </View>

        <Text style={[styles.inlineLabel, { color: theme.colors.text, fontFamily: theme.fonts.medium }]}>
          {t("questionPool")}
        </Text>
        <View style={styles.rowWrap}>
          <AppButton title={t("generate30")} onPress={() => generateQuestions(30)} variant="secondary" />
          <AppButton title={t("generate50")} onPress={() => generateQuestions(50)} variant="secondary" />
          <AppButton title={t("generate70")} onPress={() => generateQuestions(70)} variant="secondary" />
          <AppButton title={t("addQuestion")} onPress={addQuestion} variant="ghost" />
        </View>

        <View style={styles.rowWrap}>
          <AppButton
            title={t("back")}
            variant="ghost"
            onPress={() => setCurrentDraftQuestionIndex((prev) => Math.max(0, prev - 1))}
            disabled={safeIndex <= 0}
          />
          <AppButton
            title={t("nextQuestion")}
            variant="secondary"
            onPress={() => setCurrentDraftQuestionIndex((prev) => Math.min(questionDrafts.length - 1, prev + 1))}
            disabled={safeIndex >= questionDrafts.length - 1}
          />
        </View>

        <AppCard key={questionItem.localId} style={styles.questionCard}>
          <Text style={[styles.questionCardTitle, { color: theme.colors.text, fontFamily: theme.fonts.bold }]}>
            {t("question")} {safeIndex + 1}/{questionDrafts.length}
          </Text>

          <AppInput
            label={t("questionText")}
            value={questionItem.text}
            onChangeText={(value) => setQuestionDraftValue(safeIndex, "text", value)}
          />

          {[0, 1, 2, 3].map((optionIndex) => {
            const selected = questionItem.correctIndexes.includes(optionIndex);
            return (
              <View key={`${questionItem.localId}-opt-${optionIndex}`} style={styles.optionEditorRow}>
                <View style={styles.optionEditorInputWrap}>
                  <AppInput
                    label={`${t("option")} ${optionIndex + 1}`}
                    value={questionItem.options[optionIndex]}
                    onChangeText={(value) => setQuestionOptionValue(safeIndex, optionIndex, value)}
                  />
                </View>
                <AppButton
                  title={selected ? "✓" : "○"}
                  onPress={() => toggleCorrectOption(safeIndex, optionIndex)}
                  variant={selected ? "primary" : "ghost"}
                  style={styles.correctToggleButton}
                />
              </View>
            );
          })}
          <Text style={[styles.hintText, { color: theme.colors.textMuted, fontFamily: theme.fonts.regular }]}>
            {t("multipleCorrectAnswersHint")}
          </Text>
        </AppCard>

        <View style={styles.questionGridWrap}>
          {questionDrafts.map((draft, index) => {
            const hasText = Boolean(String(draft.text || "").trim());
            const isCurrent = index === safeIndex;
            return (
              <AppButton
                key={`draft-grid-${draft.localId}`}
                title={`${index + 1}`}
                variant={isCurrent ? "primary" : hasText ? "secondary" : "ghost"}
                onPress={() => setCurrentDraftQuestionIndex(index)}
                style={styles.questionGridButton}
                textStyle={styles.questionGridButtonText}
              />
            );
          })}
        </View>

        <AppButton
          title={isEditMode ? t("saveChanges") : t("createTest")}
          onPress={onCreateTest}
          loading={savingTest}
          disabled={savingTest || loadingEditTest}
        />
      </AppCard>
    );
  };

  const renderTeacherList = () => <DataTable columns={teacherAdminColumns} rows={teacherRows} emptyText={t("noData")} />;

  const renderAdminActivation = () => (
    <AppCard>
      <Text style={[styles.sectionTitle, { color: theme.colors.text, fontFamily: theme.fonts.bold }]}> 
        {t("activateTest")}
      </Text>

      <Text style={[styles.inlineLabel, { color: theme.colors.text, fontFamily: theme.fonts.medium }]}> 
        {t("tests")}
      </Text>
      <View style={styles.selectorWrap}>
        {adminActivationTests.map((item) => (
          <AppButton
            key={`test-select-${item.id}`}
            title={`#${item.id} M${item.module_no || 1} ${item.subject || "-"}`}
            variant={String(item.id) === String(selectedTestId) ? "primary" : "ghost"}
            onPress={() => setSelectedTestId(String(item.id))}
            style={styles.selectorButton}
          />
        ))}
      </View>

      <Text style={[styles.inlineLabel, { color: theme.colors.text, fontFamily: theme.fonts.medium }]}>
        Duration
      </Text>
      <View style={styles.rowWrap}>
        <AppInput
          label={t("time")}
          value={activationDurationValue}
          onChangeText={setActivationDurationValue}
          keyboardType="numeric"
          style={styles.durationInput}
        />
        <View style={styles.durationModeWrap}>
          <AppButton
            title="Hours"
            variant={activationDurationUnit === "hours" ? "primary" : "ghost"}
            onPress={() => setActivationDurationUnit("hours")}
            style={styles.selectorButton}
          />
          <AppButton
            title="Days"
            variant={activationDurationUnit === "days" ? "primary" : "ghost"}
            onPress={() => setActivationDurationUnit("days")}
            style={styles.selectorButton}
          />
        </View>
      </View>

      <Text style={[styles.inlineLabel, { color: theme.colors.text, fontFamily: theme.fonts.medium }]}> 
        {t("activateTest")}
      </Text>
      <View style={styles.rowWrap}>
        <AppButton
          title={t("forAll")}
          variant={activationMode === "all" ? "primary" : "ghost"}
          onPress={() => setActivationMode("all")}
        />
        <AppButton
          title={t("group")}
          variant={activationMode === "group" ? "primary" : "ghost"}
          onPress={() => setActivationMode("group")}
        />
        <AppButton
          title={t("student")}
          variant={activationMode === "student" ? "primary" : "ghost"}
          onPress={() => setActivationMode("student")}
        />
      </View>

      {activationMode === "student" ? (
        <>
          <Text style={[styles.inlineLabel, { color: theme.colors.text, fontFamily: theme.fonts.medium }]}>
            {t("group")}
          </Text>
          <View style={styles.selectorWrap}>
            <AppButton
              title={t("allGroups") || "Все группы"}
              variant={studentGroupFilter === "all" ? "primary" : "ghost"}
              onPress={() => setStudentGroupFilter("all")}
              style={styles.selectorButton}
            />
            {sortedGroups.map((group) => (
              <AppButton
                key={`student-filter-${group.id}`}
                title={group.name}
                variant={studentGroupFilter === group.name ? "primary" : "ghost"}
                onPress={() => setStudentGroupFilter(group.name)}
                style={styles.selectorButton}
              />
            ))}
          </View>

          <Text style={[styles.inlineLabel, { color: theme.colors.text, fontFamily: theme.fonts.medium }]}>
            {t("studentId")}
          </Text>
          <View style={styles.selectorWrap}>
            {filteredAdminStudents.map((student) => {
              const login = String(student?.login || "");
              const selected = targetStudentId.trim().toLowerCase() === login.toLowerCase();
              const title = `${student?.group_id || "-"} • ${login}`;
              return (
                <AppButton
                  key={`activate-student-${student.id}`}
                  title={title}
                  variant={selected ? "primary" : "ghost"}
                  onPress={() => setTargetStudentId(login)}
                  style={styles.selectorButton}
                />
              );
            })}
          </View>
          {!filteredAdminStudents.length ? (
            <Text style={[styles.hintText, { color: theme.colors.textMuted, fontFamily: theme.fonts.regular }]}>
              {t("noData")}
            </Text>
          ) : null}

          <AppInput
            label={t("studentId")}
            value={targetStudentId}
            onChangeText={setTargetStudentId}
            placeholder={t("studentIdHint")}
          />

          <AppButton
            title={t("allowRetake")}
            variant="secondary"
            onPress={onAllowRetake}
            loading={allowingRetake}
            disabled={allowingRetake || !selectedTestId || !targetStudentId.trim()}
          />
        </>
      ) : null}

      {activationMode === "group" ? (
        <>
          <Text style={[styles.inlineLabel, { color: theme.colors.text, fontFamily: theme.fonts.medium }]}> 
            {t("group")}
          </Text>
          <View style={styles.selectorWrap}>
            {sortedGroups.map((group) => {
              const selected = selectedGroupIds.includes(group.name);
              return (
                <AppButton
                  key={`activate-group-${group.id}`}
                  title={group.name}
                  variant={selected ? "primary" : "ghost"}
                  onPress={() => toggleGroupForActivation(group.name)}
                  style={styles.selectorButton}
                />
              );
            })}
          </View>
        </>
      ) : null}

      <AppButton title={t("activateTest")} onPress={onActivateTest} />

      <View style={styles.activeTestsWrap}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text, fontFamily: theme.fonts.bold }]}>
          {t("activeTests")}
        </Text>

        {activeAdminTests.length ? (
          activeAdminTests.map((item) => {
            const openUntilRaw = item?.activation?.latest_open_until;
            const openUntilLabel = openUntilRaw ? String(openUntilRaw).replace("T", " ").slice(0, 16) : "∞";
            const scopeLabel = item?.activation?.open_for_all
              ? t("forAll")
              : item?.activation?.open_groups?.length
              ? item.activation.open_groups.join(", ")
              : `${t("student")}: ${Number(item?.activation?.open_student_targets || 0)}`;

            return (
              <View
                key={`active-admin-test-${item.id}`}
                style={[styles.activeTestItem, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}
              >
                <View style={styles.activeTestInfo}>
                  <Text style={[styles.activeTestTitle, { color: theme.colors.text, fontFamily: theme.fonts.medium }]}>
                    #{item.id} M{item.module_no || 1} {item.subject || "-"}
                  </Text>
                  <Text style={[styles.hintText, { color: theme.colors.textMuted, fontFamily: theme.fonts.regular }]}>
                    {t("group")}: {scopeLabel}
                  </Text>
                  <Text style={[styles.hintText, { color: theme.colors.textMuted, fontFamily: theme.fonts.regular }]}>
                    {t("activeUntil")}: {openUntilLabel}
                  </Text>
                </View>
                <AppButton
                  title={t("deactivate")}
                  variant="danger"
                  onPress={() => onDeactivateTest(item.id)}
                  loading={Number(deactivatingTestId) === Number(item.id)}
                  disabled={Boolean(deactivatingTestId)}
                  style={styles.deactivateButton}
                />
              </View>
            );
          })
        ) : (
          <Text style={[styles.hintText, { color: theme.colors.textMuted, fontFamily: theme.fonts.regular }]}>
            {t("noActiveTests")}
          </Text>
        )}
      </View>
    </AppCard>
  );

  const renderAdminList = () => (
    <>
      <AppCard>
        <Text style={[styles.inlineLabel, { color: theme.colors.text, fontFamily: theme.fonts.medium }]}> 
          {t("group")}
        </Text>
        <View style={styles.selectorWrap}>
          <AppButton
            title={t("allGroups") || "Все группы"}
            variant={groupFilter === "all" ? "primary" : "ghost"}
            onPress={() => setGroupFilter("all")}
            style={styles.selectorButton}
          />
          {sortedGroups.map((group) => (
            <AppButton
              key={`group-filter-${group.id}`}
              title={group.name}
              variant={groupFilter === group.name ? "primary" : "ghost"}
              onPress={() => setGroupFilter(group.name)}
              style={styles.selectorButton}
            />
          ))}
        </View>
      </AppCard>
      <DataTable columns={teacherAdminColumns} rows={adminRows} emptyText={t("noData")} />
    </>
  );

  const renderStudentList = () => (
    <>
      {studentFiltered.map((item) => {
        const isOpen = Boolean(item.in_progress);
        return (
          <AppCard key={`student-test-${item.id}`}>
            <Text style={[styles.studentCardTitle, { color: theme.colors.text, fontFamily: theme.fonts.bold }]}> 
              {item.subject || "-"}
            </Text>
            <Text style={[styles.studentMeta, { color: theme.colors.textMuted, fontFamily: theme.fonts.regular }]}>
              Module {Number(item.module_no || 1)}
            </Text>
            <Text style={[styles.studentMeta, { color: theme.colors.textMuted, fontFamily: theme.fonts.regular }]}> 
              {t("questionsInAttempt")}: {item.questions_count}
            </Text>
            {item.pool_questions_count ? (
              <Text style={[styles.studentMeta, { color: theme.colors.textMuted, fontFamily: theme.fonts.regular }]}>
                {t("questionPool")}: {item.pool_questions_count}
              </Text>
            ) : null}
            <Text style={[styles.studentMeta, { color: theme.colors.textMuted, fontFamily: theme.fonts.regular }]}> 
              {t("timerMinutes")}: {item.timer_minutes}
            </Text>
            {item.available_until ? (
              <Text style={[styles.studentMeta, { color: theme.colors.textMuted, fontFamily: theme.fonts.regular }]}>
                Active until: {String(item.available_until).split("T")[0]}
              </Text>
            ) : null}

            {isOpen ? (
              <Text style={[styles.studentMeta, { color: theme.colors.text, fontFamily: theme.fonts.medium }]}> 
                {t("timeLeft")}: {formatTime(item.remaining_seconds || 0)}
              </Text>
            ) : null}

            <AppButton
              title={isOpen ? (t("resumeTest") || "Продолжить") : t("startTest")}
              onPress={() => openTestSession(item.id)}
              style={styles.startButton}
            />
          </AppCard>
        );
      })}
    </>
  );

  const renderStudentActiveSession = () => {
    if (!activeSession || !currentQuestion) return null;

    const totalTimerSec = Number(activeSession.timer_minutes || 0) * 60;
    const timerProgress = totalTimerSec > 0 ? Math.max(0, Math.min(1, remainingSec / totalTimerSec)) : 0;

    const selectedValues = answers[String(currentQuestion.id)];
    const selectedList = Array.isArray(selectedValues)
      ? selectedValues.map((value) => String(value))
      : selectedValues
      ? [String(selectedValues)]
      : [];

    return (
      <AppCard>
        <View style={styles.activeTopRow}>
          <AppButton
            title={t("close") || "Закрыть"}
            variant="ghost"
            onPress={() => {
              setActiveSession(null);
              setCurrentQuestionIndex(0);
              setAnswers({});
            }}
            style={styles.compactActionButton}
          />
          <Text style={[styles.activeQuestionNumber, { color: theme.colors.text, fontFamily: theme.fonts.bold }]}> 
            {t("question")} {currentQuestionIndex + 1}/{totalQuestions}
          </Text>
          <View style={styles.headerSpacer} />
        </View>

        <Text style={[styles.timerText, { color: "#B00020", fontFamily: theme.fonts.bold }]}> 
          {t("timeLeft")}: {formatTime(remainingSec)}
        </Text>
        <View style={[styles.timerTrack, { borderColor: theme.colors.border }]}> 
          <View style={[styles.timerFill, { width: `${Math.floor(timerProgress * 100)}%` }]} />
        </View>

        {privacyMasked ? (
          <View style={[styles.privacyMask, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}>
            <Text style={[styles.privacyMaskText, { color: theme.colors.text, fontFamily: theme.fonts.medium }]}>
              {t("returnToAppToContinueTest")}
            </Text>
          </View>
        ) : (
          <View style={styles.secureContent}>
            <Text
              selectable={false}
              style={[styles.activeQuestionText, { color: theme.colors.text, fontFamily: theme.fonts.medium }]}
            >
              {currentQuestion.text}
            </Text>

            <View style={styles.optionsColumn}>
              {(currentQuestion.options || []).map((option, optionIndex) => {
                const optionText = String(option || "");
                const isSelected = selectedList.includes(optionText);
                return (
                  <AppButton
                    key={`answer-option-${currentQuestion.id}-${optionIndex}`}
                    title={`${optionIndex + 1}. ${optionText}`}
                    variant={isSelected ? "primary" : "ghost"}
                    onPress={() => onSelectAnswer(currentQuestion.id, optionText)}
                    style={styles.answerOptionButton}
                  />
                );
              })}
            </View>

            <View style={styles.rowWrap}>
              <AppButton
                title={t("back")}
                variant="ghost"
                onPress={() => setCurrentQuestionIndex((prev) => Math.max(0, prev - 1))}
                disabled={currentQuestionIndex <= 0}
              />
              <AppButton
                title={t("nextQuestion")}
                variant="secondary"
                onPress={() => setCurrentQuestionIndex((prev) => Math.min(totalQuestions - 1, prev + 1))}
                disabled={currentQuestionIndex >= totalQuestions - 1}
              />
            </View>

            <View style={styles.questionGridWrap}>
              {(activeSession.questions || []).map((questionItem, index) => {
                const answered = Array.isArray(answers[String(questionItem.id)])
                  ? answers[String(questionItem.id)].length > 0
                  : Boolean(answers[String(questionItem.id)]);
                const isCurrent = index === currentQuestionIndex;

                return (
                  <AppButton
                    key={`question-grid-${questionItem.id}`}
                    title={`${index + 1}`}
                    variant={isCurrent ? "primary" : answered ? "secondary" : "ghost"}
                    onPress={() => setCurrentQuestionIndex(index)}
                    style={styles.questionGridButton}
                    textStyle={styles.questionGridButtonText}
                  />
                );
              })}
            </View>

            {canSubmitCurrent ? (
              <AppButton
                title={submitting ? t("loading") : t("submitTest")}
                onPress={() => submitActiveTest(false)}
                loading={submitting}
                disabled={submitting}
              />
            ) : (
              <Text style={[styles.hintText, { color: theme.colors.textMuted, fontFamily: theme.fonts.regular }]}>
                {answeredCount}/{totalQuestions}
              </Text>
            )}
          </View>
        )}
      </AppCard>
    );
  };

  return (
    <ScreenLayout onRefresh={loadTests} refreshing={loading}>
      {Platform.OS === "web" ? (
        <Text style={[styles.title, { color: theme.colors.text, fontFamily: theme.fonts.bold }]}> 
          {t("tests")}
        </Text>
      ) : null}

      <Text style={[styles.meta, { color: theme.colors.textMuted }]}>{loading ? t("loading") : " "}</Text>

      {renderRoleTabs()}

      {role === "teacher" && teacherTab === "create" ? renderTeacherCreate() : null}
      {role === "teacher" && teacherTab === "list" ? renderTeacherList() : null}

      {role === "admin" && adminTab === "activate" ? renderAdminActivation() : null}
      {role === "admin" && adminTab === "list" ? renderAdminList() : null}

      {role === "student" ? (activeSession ? renderStudentActiveSession() : renderStudentList()) : null}

      <Modal
        visible={resultModal.visible}
        transparent
        animationType="fade"
        onRequestClose={() => setResultModal({ visible: false, score: 0, total: 0 })}
      >
        <View style={styles.resultModalBackdrop}>
          <View style={[styles.resultModalCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            <Text style={[styles.resultModalTitle, { color: theme.colors.text, fontFamily: theme.fonts.bold }]}>
              {t("testResultTitle")}
            </Text>
            <Text style={[styles.resultModalScore, { color: theme.colors.text, fontFamily: theme.fonts.medium }]}>
              {resultModal.score}/{resultModal.total}
            </Text>
            <AppButton
              title={t("continueAction")}
              onPress={() => setResultModal({ visible: false, score: 0, total: 0 })}
              style={styles.resultModalButton}
            />
          </View>
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
  meta: {
    marginBottom: 8,
    fontSize: 12,
    fontFamily: "serif",
  },
  sectionTitle: {
    fontSize: 17,
    marginBottom: 10,
  },
  tabsCard: {
    marginBottom: 10,
  },
  editModeWrap: {
    marginBottom: 10,
    gap: 8,
  },
  tabsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  tabButton: {
    minHeight: 36,
    paddingHorizontal: 12,
  },
  inlineLabel: {
    fontSize: 13,
    marginBottom: 6,
  },
  rowWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 10,
  },
  selectorWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 10,
  },
  selectorButton: {
    minHeight: 34,
    paddingHorizontal: 12,
  },
  inlineEditButton: {
    minHeight: 34,
    paddingHorizontal: 10,
  },
  durationInput: {
    minWidth: 120,
    flexGrow: 0,
  },
  durationModeWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    alignItems: "flex-end",
    marginBottom: 10,
  },
  activeTestsWrap: {
    marginTop: 14,
    gap: 8,
  },
  activeTestItem: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    gap: 8,
  },
  activeTestInfo: {
    gap: 2,
  },
  activeTestTitle: {
    fontSize: 14,
  },
  deactivateButton: {
    alignSelf: "flex-start",
    minHeight: 34,
  },
  summaryCard: {
    marginBottom: 10,
  },
  summaryTitle: {
    fontSize: 14,
    marginBottom: 4,
  },
  summaryLine: {
    fontSize: 12,
    marginBottom: 2,
  },
  hintText: {
    fontSize: 12,
    marginBottom: 10,
  },
  questionCard: {
    marginBottom: 10,
  },
  questionCardTitle: {
    fontSize: 14,
    marginBottom: 6,
  },
  optionEditorRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
  },
  optionEditorInputWrap: {
    flex: 1,
  },
  correctToggleButton: {
    minHeight: 42,
    width: 52,
    marginBottom: 10,
  },
  studentCardTitle: {
    fontSize: 17,
    marginBottom: 6,
  },
  studentMeta: {
    fontSize: 13,
    marginBottom: 4,
  },
  startButton: {
    marginTop: 10,
  },
  activeTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  compactActionButton: {
    minHeight: 34,
    paddingHorizontal: 10,
  },
  headerSpacer: {
    width: 90,
  },
  activeQuestionNumber: {
    fontSize: 16,
    textAlign: "center",
  },
  timerText: {
    fontSize: 16,
    textAlign: "center",
    marginBottom: 6,
  },
  timerTrack: {
    borderWidth: 1,
    borderRadius: 999,
    height: 8,
    marginBottom: 12,
    overflow: "hidden",
  },
  timerFill: {
    height: "100%",
    backgroundColor: "#B00020",
  },
  activeQuestionText: {
    fontSize: 16,
    lineHeight: 22,
    marginBottom: 12,
    textAlign: "left",
  },
  secureContent: Platform.select({
    web: {
      userSelect: "none",
      WebkitUserSelect: "none",
    },
    default: {},
  }),
  privacyMask: {
    borderWidth: 1,
    borderRadius: 10,
    minHeight: 160,
    alignItems: "center",
    justifyContent: "center",
    padding: 14,
    marginBottom: 12,
  },
  privacyMaskText: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
  optionsColumn: {
    gap: 8,
    marginBottom: 12,
  },
  answerOptionButton: {
    justifyContent: "flex-start",
    paddingHorizontal: 12,
  },
  questionGridWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 12,
  },
  questionGridButton: {
    width: 44,
    minHeight: 38,
    borderRadius: 8,
    paddingHorizontal: 0,
  },
  questionGridButtonText: {
    fontSize: 12,
  },
  resultModalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.24)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  resultModalCard: {
    width: "100%",
    maxWidth: 360,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 18,
    paddingHorizontal: 16,
    alignItems: "center",
    gap: 12,
  },
  resultModalTitle: {
    fontSize: 20,
    textAlign: "center",
  },
  resultModalScore: {
    fontSize: 30,
    textAlign: "center",
  },
  resultModalButton: {
    width: "100%",
    marginTop: 4,
  },
});
