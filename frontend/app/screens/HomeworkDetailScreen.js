/**
 * Module: app/screens/HomeworkDetailScreen.js
 *
 * Purpose:
 * - Screen module for HomeworkDetailScreen. Handles state, data loading, and UI for this route.
 *
 * Module notes:
 * - Imports count: 15.
 * - This header is written for beginners: read purpose first, then function map below.
 *
 * Function map:
 * - HomeworkDetailScreen: Main React component or UI container exported by this file.
 * - readableDate: Helper function used by this module business logic.
 * - normalizeRows: Transforms input/output values to stable display or API format.
 * - normalizedStatus: Transforms input/output values to stable display or API format.
 * - isCompletedStatus: Helper function used by this module business logic.
 * - isArchivedStatus: Helper function used by this module business logic.
 * - isNeedsFixStatus: Helper function used by this module business logic.
 * - statusLabel: Helper function used by this module business logic.
 * - onExport: Callback function invoked by UI or navigation events.
 * - onShareText: Callback function invoked by UI or navigation events.
 * - onShareImage: Callback function invoked by UI or navigation events.
 * - onToggleHomeworkActive: Callback function invoked by UI or navigation events.
 * - onToggleHomeworkArchive: Callback function invoked by UI or navigation events.
 * - onDeleteHomework: Callback function invoked by UI or navigation events.
 * - onSaveHomeworkEdit: Callback function invoked by UI or navigation events.
 * - onSaveSubmissionReview: Callback function invoked by UI or navigation events.
 * - onQuickSubmissionAction: Callback function invoked by UI or navigation events.
 * - openAttachment: Controls modal/sheet/screen visibility or navigation transition.
 * - setSubmissionBusy: Applies value updates to state/configuration.
 * - setHomeworkBusy: Applies value updates to state/configuration.
 * - openSubmitScreen: Controls modal/sheet/screen visibility or navigation transition.
 * - updateDraft: Updates existing data or state values.
 * - toggleHomeworkEdit: Toggles boolean state or switches between two modes.
 * - updateHomeworkDraft: Updates existing data or state values.
 * - loadSubjectHomework: Loads remote/local data and updates screen/component state.
 * - filtered: Helper function used by this module business logic.
 * - subtitle: Helper function used by this module business logic.
 * - reviewQueueRows: Helper function used by this module business logic.
 * - completedQueueRows: Helper function used by this module business logic.
 * - unsubscribe: Helper function used by this module business logic.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Linking, Platform, Pressable, Share, StyleSheet, Text, View } from "react-native";
import { captureRef } from "react-native-view-shot";
import * as Sharing from "expo-sharing";

import AppButton from "../components/AppButton";
import AppCard from "../components/AppCard";
import AppInput from "../components/AppInput";
import BirthDateField from "../components/BirthDateField";
import OverflowMenu from "../components/OverflowMenu";
import ScreenLayout from "../components/ScreenLayout";
import { useAuth } from "../hooks/AuthContext";
import { useI18n } from "../hooks/I18nContext";
import { useThemeMode } from "../hooks/ThemeContext";
import { openExportDocument } from "../services/exportService";
import {
  deleteHomework,
  fetchHomeworkByGroup,
  fetchHomeworkSubmissions,
  reviewHomeworkSubmission,
  updateHomeworkStatus,
} from "../services/homeworkService";

function readableDate(value) {
  if (!value || typeof value !== "string") return "-";
  return value.split("T")[0];
}

function normalizeRows(rows) {
  return Array.isArray(rows) ? rows : [];
}

const TEACHER_TAB_TASKS = "tasks";
const TEACHER_TAB_REVIEW = "review";
const TEACHER_TAB_COMPLETED = "completed";

function normalizedStatus(value) {
  return String(value || "").trim().toLowerCase();
}

function isCompletedStatus(value) {
  return normalizedStatus(value) === "completed";
}

function isArchivedStatus(value) {
  return normalizedStatus(value) === "archived";
}

function isNeedsFixStatus(value) {
  return ["needs_fix", "rejected"].includes(normalizedStatus(value));
}

function statusLabel(t, value) {
  const status = normalizedStatus(value);
  if (status === "submitted") return t("submittedStatus");
  if (status === "reviewed") return t("reviewedStatus");
  if (status === "completed") return t("completedStatus");
  if (status === "needs_fix" || status === "rejected") return t("needsFixStatus");
  if (status === "deactivated") return t("deactivatedStatus");
  if (status === "archived") return t("archivedStatus");
  return value || "-";
}

export default function HomeworkDetailScreen({ route, navigation }) {
  const { t, language } = useI18n();
  const { theme } = useThemeMode();
  const { token, role, groupId: currentGroupId } = useAuth();

  const groupId = String(route?.params?.groupId || "").trim();
  const subject = String(route?.params?.subject || "General").trim() || "General";

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submissionsByHomework, setSubmissionsByHomework] = useState({});
  const [reviewDrafts, setReviewDrafts] = useState({});
  const [busySubmissionIds, setBusySubmissionIds] = useState({});
  const [busyHomeworkIds, setBusyHomeworkIds] = useState({});
  const [editingHomeworkIds, setEditingHomeworkIds] = useState({});
  const [homeworkDrafts, setHomeworkDrafts] = useState({});
  const [teacherTab, setTeacherTab] = useState(TEACHER_TAB_TASKS);

  const cardRefs = useRef({});

  const isStudent = role === "student";
  const isTeacher = role === "teacher";
  const isAdmin = role === "admin";
  const effectiveGroup = isStudent ? currentGroupId : groupId;

  const setSubmissionBusy = (submissionId, value) => {
    setBusySubmissionIds((prev) => ({
      ...prev,
      [submissionId]: Boolean(value),
    }));
  };

  const setHomeworkBusy = (homeworkId, value) => {
    setBusyHomeworkIds((prev) => ({
      ...prev,
      [homeworkId]: Boolean(value),
    }));
  };

  const loadSubmissionsForRows = useCallback(
    async (homeworkRows) => {
      if (!Array.isArray(homeworkRows) || !homeworkRows.length) {
        setSubmissionsByHomework({});
        return;
      }

      if (!isTeacher && !isAdmin) {
        setSubmissionsByHomework({});
        return;
      }

      const pairs = await Promise.all(
        homeworkRows.map(async (item) => {
          try {
            const data = await fetchHomeworkSubmissions(item.id);
            return [item.id, normalizeRows(data)];
          } catch {
            return [item.id, []];
          }
        })
      );

      const next = {};
      pairs.forEach(([homeworkId, list]) => {
        next[homeworkId] = list;
      });
      setSubmissionsByHomework(next);
    },
    [isAdmin, isTeacher]
  );

  const loadSubjectHomework = useCallback(async () => {
    const targetGroup = String(effectiveGroup || "").trim();
    if (!targetGroup) {
      setRows([]);
      setSubmissionsByHomework({});
      return;
    }

    setLoading(true);
    try {
      const data = await fetchHomeworkByGroup(targetGroup);
      const list = normalizeRows(data);
      const filtered = list.filter((item) => String(item.subject || "General").trim() === subject);
      setRows(filtered);
      await loadSubmissionsForRows(filtered);
    } catch (error) {
      Alert.alert(t("homework"), error?.response?.data?.error || t("unknownError"));
    } finally {
      setLoading(false);
    }
  }, [effectiveGroup, loadSubmissionsForRows, subject, t]);

  const onExport = async (homeworkId, format) => {
    try {
      await openExportDocument({
        entity: "homework",
        target: String(homeworkId),
        format,
        token,
        language,
      });
    } catch {
      Alert.alert(t("homework"), t("unknownError"));
    }
  };

  const buildShareText = useCallback(
    (item) => {
      return [
        `${t("subject")}: ${item.subject || "General"}`,
        `${t("title")}: ${item.title || "-"}`,
        `${t("description")}: ${item.description || "-"}`,
        `${t("dueDate")}: ${item.due_date || "-"}`,
        `${t("groupName")}: ${item.group_id || "-"}`,
      ].join("\n");
    },
    [t]
  );

  const onShareText = async (item) => {
    try {
      await Share.share({ message: buildShareText(item) });
    } catch {
      Alert.alert(t("homework"), t("shareNotAvailable"));
    }
  };

  const onShareImage = async (item) => {
    const cardRef = cardRefs.current[item.id];
    if (!cardRef) {
      Alert.alert(t("homework"), t("shareNotAvailable"));
      return;
    }

    if (Platform.OS === "web") {
      await onShareText(item);
      return;
    }

    try {
      const imageUri = await captureRef(cardRef, {
        format: "png",
        quality: 1,
      });

      const isSharingAvailable = await Sharing.isAvailableAsync();
      if (isSharingAvailable) {
        await Sharing.shareAsync(imageUri, {
          mimeType: "image/png",
          dialogTitle: t("shareHomeworkImage"),
        });
      } else {
        await onShareText(item);
      }
    } catch {
      Alert.alert(t("homework"), t("shareNotAvailable"));
    }
  };

  const openSubmitScreen = (item) => {
    navigation.navigate("HomeworkSubmit", {
      homeworkId: item.id,
      groupId: effectiveGroup,
      subject: item.subject || "General",
      title: item.title || "",
      description: item.description || "",
      dueDate: item.due_date || "",
      submission: item.submission || null,
    });
  };

  const onToggleHomeworkActive = async (item) => {
    if (busyHomeworkIds[item.id]) return;
    setHomeworkBusy(item.id, true);
    try {
      await updateHomeworkStatus(item.id, { is_active: !Boolean(item.is_active) });
      await loadSubjectHomework();
    } catch (error) {
      Alert.alert(t("homework"), error?.response?.data?.error || t("unknownError"));
    } finally {
      setHomeworkBusy(item.id, false);
    }
  };

  const onToggleHomeworkArchive = async (item) => {
    if (busyHomeworkIds[item.id]) return;
    setHomeworkBusy(item.id, true);
    try {
      await updateHomeworkStatus(item.id, { archive: !Boolean(item.archived_at) });
      await loadSubjectHomework();
    } catch (error) {
      Alert.alert(t("homework"), error?.response?.data?.error || t("unknownError"));
    } finally {
      setHomeworkBusy(item.id, false);
    }
  };

  const onDeleteHomework = async (item) => {
    Alert.alert(
      t("homework"),
      t("confirmDeleteHomework"),
      [
        { text: t("cancel"), style: "cancel" },
        {
          text: t("delete"),
          style: "destructive",
          onPress: async () => {
            try {
              await deleteHomework(item.id);
              await loadSubjectHomework();
            } catch (error) {
              Alert.alert(t("homework"), error?.response?.data?.error || t("unknownError"));
            }
          },
        },
      ],
      { cancelable: true }
    );
  };

  const updateDraft = (submissionId, patch) => {
    setReviewDrafts((prev) => ({
      ...prev,
      [submissionId]: {
        grade: "",
        review_comment: "",
        ...prev[submissionId],
        ...(patch || {}),
      },
    }));
  };

  const toggleHomeworkEdit = (item) => {
    const itemId = Number(item.id);
    setEditingHomeworkIds((prev) => ({
      ...prev,
      [itemId]: !Boolean(prev[itemId]),
    }));

    setHomeworkDrafts((prev) => ({
      ...prev,
      [itemId]: {
        title: String(prev[itemId]?.title ?? item.title ?? ""),
        description: String(prev[itemId]?.description ?? item.description ?? ""),
        dueDate: String(prev[itemId]?.dueDate ?? item.due_date ?? ""),
      },
    }));
  };

  const updateHomeworkDraft = (homeworkId, patch) => {
    const itemId = Number(homeworkId);
    setHomeworkDrafts((prev) => ({
      ...prev,
      [itemId]: {
        title: "",
        description: "",
        dueDate: "",
        ...prev[itemId],
        ...(patch || {}),
      },
    }));
  };

  const onSaveHomeworkEdit = async (item) => {
    if (busyHomeworkIds[item.id]) return;
    const draft = homeworkDrafts[item.id] || {};
    const nextTitle = String(draft.title || "").trim();
    const nextDescription = String(draft.description || "").trim();
    const nextDueDate = String(draft.dueDate || "").trim();

    if (!nextTitle || !nextDescription) {
      Alert.alert(t("homework"), t("fillRequiredFields"));
      return;
    }

    setHomeworkBusy(item.id, true);
    try {
      await updateHomeworkStatus(item.id, {
        title: nextTitle,
        description: nextDescription,
        due_date: nextDueDate || "",
      });
      setEditingHomeworkIds((prev) => ({ ...prev, [item.id]: false }));
      await loadSubjectHomework();
    } catch (error) {
      Alert.alert(t("homework"), error?.response?.data?.error || t("unknownError"));
    } finally {
      setHomeworkBusy(item.id, false);
    }
  };

  const onSaveSubmissionReview = async (homeworkItem, submission) => {
    const draft = reviewDrafts[submission.id] || {};
    const gradeValue = String(draft.grade || "").trim();
    const reviewComment = String(draft.review_comment || "").trim();
    if (!["1", "2", "3", "4", "5"].includes(gradeValue)) {
      Alert.alert(t("homework"), t("homeworkSelectGrade"));
      return;
    }
    const payload = {
      status: "completed",
      review_comment: reviewComment || undefined,
      grade_value: gradeValue,
    };

    setSubmissionBusy(submission.id, true);
    try {
      await reviewHomeworkSubmission(submission.id, payload);
      await loadSubmissionsForRows([homeworkItem]);
    } catch (error) {
      Alert.alert(t("homework"), error?.response?.data?.error || t("unknownError"));
    } finally {
      setSubmissionBusy(submission.id, false);
    }
  };

  const onQuickSubmissionAction = async (homeworkItem, submission, payload) => {
    setSubmissionBusy(submission.id, true);
    try {
      await reviewHomeworkSubmission(submission.id, payload);
      await loadSubmissionsForRows([homeworkItem]);
    } catch (error) {
      Alert.alert(t("homework"), error?.response?.data?.error || t("unknownError"));
    } finally {
      setSubmissionBusy(submission.id, false);
    }
  };

  const openAttachment = async (url) => {
    const raw = String(url || "").trim();
    if (!raw) return;

    if (Platform.OS === "web" && typeof window !== "undefined") {
      window.open(raw, "_blank", "noopener,noreferrer");
      return;
    }

    const canOpen = await Linking.canOpenURL(raw);
    if (!canOpen) {
      Alert.alert(t("homework"), t("fileOpenUnavailable"));
      return;
    }
    await Linking.openURL(raw);
  };

  const subtitle = useMemo(() => {
    return `${t("groupName")}: ${effectiveGroup || "-"} • ${t("tasksCount")}: ${rows.length}`;
  }, [effectiveGroup, rows.length, t]);

  const reviewQueueRows = useMemo(() => {
    if (!isTeacher) return [];
    const list = [];
    rows.forEach((homeworkItem) => {
      const submissionRows = submissionsByHomework[homeworkItem.id] || [];
      submissionRows.forEach((submission) => {
        const statusValue = normalizedStatus(submission.status);
        if (isCompletedStatus(statusValue) || isArchivedStatus(statusValue)) return;
        list.push({ homework: homeworkItem, submission });
      });
    });
    return list.sort((a, b) => String(b.submission?.submitted_at || "").localeCompare(String(a.submission?.submitted_at || "")));
  }, [isTeacher, rows, submissionsByHomework]);

  const completedQueueRows = useMemo(() => {
    if (!isTeacher) return [];
    const list = [];
    rows.forEach((homeworkItem) => {
      const submissionRows = submissionsByHomework[homeworkItem.id] || [];
      submissionRows.forEach((submission) => {
        if (!isCompletedStatus(submission.status)) return;
        list.push({ homework: homeworkItem, submission });
      });
    });
    return list.sort((a, b) => String(b.submission?.reviewed_at || "").localeCompare(String(a.submission?.reviewed_at || "")));
  }, [isTeacher, rows, submissionsByHomework]);

  useEffect(() => {
    loadSubjectHomework();
  }, [loadSubjectHomework]);

  useEffect(() => {
    const unsubscribe = navigation.addListener("focus", () => {
      loadSubjectHomework();
    });
    return unsubscribe;
  }, [loadSubjectHomework, navigation]);

  return (
    <ScreenLayout onRefresh={loadSubjectHomework} refreshing={loading}>
      <Text style={[styles.title, { color: theme.colors.text, fontFamily: theme.fonts.bold }]}>{subject}</Text>
      <Text style={[styles.meta, { color: theme.colors.textMuted, fontFamily: theme.fonts.regular }]}>{subtitle}</Text>

      {isTeacher ? (
        <AppCard style={styles.tabsCard}>
          <View style={styles.tabsRow}>
            <AppButton
              title={t("homeworkTabTasks")}
              variant={teacherTab === TEACHER_TAB_TASKS ? "primary" : "ghost"}
              onPress={() => setTeacherTab(TEACHER_TAB_TASKS)}
              style={styles.tabButton}
            />
            <AppButton
              title={t("homeworkTabReview")}
              variant={teacherTab === TEACHER_TAB_REVIEW ? "primary" : "ghost"}
              onPress={() => setTeacherTab(TEACHER_TAB_REVIEW)}
              style={styles.tabButton}
            />
            <AppButton
              title={t("homeworkTabCompleted")}
              variant={teacherTab === TEACHER_TAB_COMPLETED ? "primary" : "ghost"}
              onPress={() => setTeacherTab(TEACHER_TAB_COMPLETED)}
              style={styles.tabButton}
            />
          </View>
        </AppCard>
      ) : null}

      {!rows.length ? (
        null
      ) : null}

      {rows.length && (!isTeacher || teacherTab === TEACHER_TAB_TASKS)
        ? rows.map((item) => {
            const submissionRows = submissionsByHomework[item.id] || [];
            const isEditingHomework = Boolean(editingHomeworkIds[item.id]);
            const homeworkBusy = Boolean(busyHomeworkIds[item.id]);
            const homeworkDraft = homeworkDrafts[item.id] || {
              title: String(item.title || ""),
              description: String(item.description || ""),
              dueDate: String(item.due_date || ""),
            };
            const studentStatusCode = normalizedStatus(item?.submission?.status);
            const needsResubmit = Boolean(item?.requires_resubmit || isNeedsFixStatus(studentStatusCode));
            return (
              <View
                key={`homework-item-${item.id}`}
                ref={(node) => {
                  if (node) {
                    cardRefs.current[item.id] = node;
                  }
                }}
                collapsable={false}
              >
                <AppCard>
                  <View style={styles.cardTopRow}>
                    <Text style={[styles.cardTitle, { color: theme.colors.text, fontFamily: theme.fonts.bold }]}>
                      {item.title}
                    </Text>

                    <OverflowMenu
                      buttonHint={t("actions")}
                      options={[
                        { key: `export-html-${item.id}`, label: t("exportHtml"), onPress: () => onExport(item.id, "html") },
                        { key: `export-pdf-${item.id}`, label: t("exportPdf"), onPress: () => onExport(item.id, "pdf") },
                        { key: `export-xlsx-${item.id}`, label: t("exportExcel"), onPress: () => onExport(item.id, "xlsx") },
                        { key: `share-image-${item.id}`, label: t("shareAsImage"), onPress: () => onShareImage(item) },
                        { key: `share-text-${item.id}`, label: t("shareAsText"), onPress: () => onShareText(item) },
                        ...(isTeacher
                          ? [
                              {
                                key: `active-${item.id}`,
                                label: item.is_active ? t("deactivateHomework") : t("activateHomework"),
                                onPress: () => onToggleHomeworkActive(item),
                              },
                              {
                                key: `archive-${item.id}`,
                                label: item.archived_at ? t("unarchiveHomework") : t("archiveHomework"),
                                onPress: () => onToggleHomeworkArchive(item),
                              },
                            ]
                          : []),
                        ...(isAdmin ? [{ key: `delete-${item.id}`, label: t("deleteHomework"), onPress: () => onDeleteHomework(item) }] : []),
                      ]}
                    />
                  </View>

                  <Text style={[styles.cardDescription, { color: theme.colors.text, fontFamily: theme.fonts.regular }]}>
                    {item.description}
                  </Text>

                  <Text style={[styles.cardMeta, { color: theme.colors.textMuted, fontFamily: theme.fonts.regular }]}>
                    {t("dueDate")}: {item.due_date || "-"}
                  </Text>
                  <Text style={[styles.cardMeta, { color: theme.colors.textMuted, fontFamily: theme.fonts.regular }]}>
                    {t("date")}: {readableDate(item.created_at)}
                  </Text>
                  {isTeacher || isAdmin ? (
                    <Text style={[styles.cardMeta, { color: theme.colors.textMuted, fontFamily: theme.fonts.regular }]}>
                      {t("homeworkSubmissionsCount")}: {submissionRows.length}
                    </Text>
                  ) : null}
                  {isTeacher ? (
                    <Text style={[styles.cardMeta, { color: theme.colors.textMuted, fontFamily: theme.fonts.regular }]}>
                      {t("status")}: {item.archived_at ? t("archive") : item.is_active ? t("activate") : t("deactivate")}
                    </Text>
                  ) : null}

                  {isTeacher ? (
                    <View style={styles.homeworkEditWrap}>
                      <AppButton
                        title={isEditingHomework ? t("cancel") : t("edit")}
                        variant="ghost"
                        onPress={() => toggleHomeworkEdit(item)}
                        disabled={homeworkBusy}
                        style={styles.editButton}
                      />
                      {isEditingHomework ? (
                        <View style={styles.editFormWrap}>
                          <AppInput label={t("title")} value={homeworkDraft.title} onChangeText={(value) => updateHomeworkDraft(item.id, { title: value })} />
                          <AppInput
                            label={t("description")}
                            value={homeworkDraft.description}
                            onChangeText={(value) => updateHomeworkDraft(item.id, { description: value })}
                            multiline
                            inputStyle={{ minHeight: 90, textAlignVertical: "top" }}
                          />
                          <BirthDateField
                            label={t("dueDate")}
                            value={homeworkDraft.dueDate}
                            onChangeText={(value) => updateHomeworkDraft(item.id, { dueDate: value })}
                          />
                          <AppButton title={t("save")} onPress={() => onSaveHomeworkEdit(item)} loading={homeworkBusy} />
                        </View>
                      ) : null}
                    </View>
                  ) : null}

                  {isStudent ? (
                    <View style={styles.studentSubmissionWrap}>
                      <Text style={[styles.studentStatus, { color: theme.colors.textMuted, fontFamily: theme.fonts.regular }]}>
                        {t("homeworkMySubmissionStatus")}:{" "}
                        {item?.submission?.status ? statusLabel(t, item?.submission?.status) : t("homeworkNotSubmitted")}
                      </Text>
                      {needsResubmit ? (
                        <Text style={[styles.needsFixText, { color: "#B00020", fontFamily: theme.fonts.medium }]}>
                          {t("homeworkNeedsResubmit")}
                        </Text>
                      ) : null}
                      {item?.submission?.review_comment ? (
                        <Text style={[styles.studentStatus, { color: theme.colors.textMuted, fontFamily: theme.fonts.regular }]}>
                          {t("reviewComment")}: {item.submission.review_comment}
                        </Text>
                      ) : null}
                      <AppButton title={item?.submission ? t("resubmitHomework") : t("submitHomeworkAction")} onPress={() => openSubmitScreen(item)} />
                    </View>
                  ) : null}
                </AppCard>
              </View>
            );
          })
        : null}

      {isTeacher && rows.length && teacherTab === TEACHER_TAB_REVIEW ? (
        <AppCard>
          <Text style={[styles.submissionsTitle, { color: theme.colors.text, fontFamily: theme.fonts.bold }]}>{t("homeworkReviewSection")}</Text>
          {reviewQueueRows.length ? (
            reviewQueueRows.map(({ homework, submission }) => {
              const draft = reviewDrafts[submission.id] || {
                grade: submission.grade_value || "",
                review_comment: submission.review_comment || "",
              };
              const busy = Boolean(busySubmissionIds[submission.id]);
              return (
                <View key={`review-submission-${submission.id}`} style={[styles.submissionItem, { borderColor: theme.colors.border, backgroundColor: theme.colors.rowAlt }]}>
                  <Text style={[styles.submissionName, { color: theme.colors.text, fontFamily: theme.fonts.bold }]}>
                    {submission.student_name || `#${submission.student_id}`}
                  </Text>
                  <Text style={[styles.reviewHomeworkTitle, { color: theme.colors.textMuted, fontFamily: theme.fonts.medium }]}>
                    {homework.title}
                  </Text>
                  <Text style={[styles.submissionMeta, { color: theme.colors.textMuted, fontFamily: theme.fonts.regular }]}>
                    {t("status")}: {statusLabel(t, submission.status)}
                  </Text>
                  <Text style={[styles.submissionMeta, { color: theme.colors.textMuted, fontFamily: theme.fonts.regular }]}>
                    {t("date")}: {readableDate(submission.submitted_at)}
                  </Text>
                  {submission.comment ? (
                    <Text style={[styles.submissionText, { color: theme.colors.text, fontFamily: theme.fonts.regular }]}>
                      {t("submissionComment")}: {submission.comment}
                    </Text>
                  ) : null}
                  {submission.attachment_url ? (
                    <Pressable onPress={() => openAttachment(submission.attachment_url)}>
                      <Text style={[styles.attachmentLink, { color: theme.colors.primary, fontFamily: theme.fonts.medium }]}>
                        {t("openFile")}: {submission.attachment_name || t("file")}
                      </Text>
                    </Pressable>
                  ) : null}

                  <Text style={[styles.inputLabel, { color: theme.colors.text, fontFamily: theme.fonts.medium }]}>{t("homeworkGradeScale")}</Text>
                  <View style={styles.gradeScaleRow}>
                    {["1", "2", "3", "4", "5"].map((gradeItem) => (
                      <AppButton
                        key={`grade-${submission.id}-${gradeItem}`}
                        title={gradeItem}
                        variant={String(draft.grade || "") === gradeItem ? "primary" : "ghost"}
                        onPress={() => updateDraft(submission.id, { grade: gradeItem })}
                        disabled={busy}
                        style={styles.gradeButton}
                      />
                    ))}
                  </View>

                  <AppInput
                    label={t("reviewComment")}
                    value={String(draft.review_comment || "")}
                    onChangeText={(value) => updateDraft(submission.id, { review_comment: value })}
                    multiline
                    inputStyle={{ minHeight: 72, textAlignVertical: "top" }}
                  />

                  <View style={styles.submissionActions}>
                    <AppButton title={t("saveReview")} onPress={() => onSaveSubmissionReview(homework, submission)} loading={busy} style={styles.actionBtn} />
                    <AppButton
                      title={t("homeworkNeedFix")}
                      variant="ghost"
                      onPress={() =>
                        onQuickSubmissionAction(homework, submission, {
                          status: "needs_fix",
                          review_comment: String(draft.review_comment || "").trim() || undefined,
                          grade_value: "",
                        })
                      }
                      disabled={busy}
                      style={styles.actionBtn}
                    />
                  </View>
                </View>
              );
            })
          ) : (
            null
          )}
        </AppCard>
      ) : null}

      {isTeacher && rows.length && teacherTab === TEACHER_TAB_COMPLETED ? (
        <AppCard>
          <Text style={[styles.submissionsTitle, { color: theme.colors.text, fontFamily: theme.fonts.bold }]}>{t("homeworkCompletedSection")}</Text>
          {completedQueueRows.length ? (
            completedQueueRows.map(({ homework, submission }) => (
              <View key={`completed-submission-${submission.id}`} style={[styles.submissionItem, { borderColor: theme.colors.border, backgroundColor: theme.colors.rowAlt }]}>
                <Text style={[styles.submissionName, { color: theme.colors.text, fontFamily: theme.fonts.bold }]}>
                  {submission.student_name || `#${submission.student_id}`}
                </Text>
                <Text style={[styles.reviewHomeworkTitle, { color: theme.colors.textMuted, fontFamily: theme.fonts.medium }]}>{homework.title}</Text>
                <Text style={[styles.submissionMeta, { color: theme.colors.textMuted, fontFamily: theme.fonts.regular }]}>
                  {t("grade")}: {submission.grade_value || "-"}
                </Text>
                <Text style={[styles.submissionMeta, { color: theme.colors.textMuted, fontFamily: theme.fonts.regular }]}>
                  {t("date")}: {readableDate(submission.reviewed_at || submission.updated_at)}
                </Text>
                {submission.review_comment ? (
                  <Text style={[styles.submissionText, { color: theme.colors.text, fontFamily: theme.fonts.regular }]}>
                    {t("reviewComment")}: {submission.review_comment}
                  </Text>
                ) : null}
                {submission.attachment_url ? (
                  <Pressable onPress={() => openAttachment(submission.attachment_url)}>
                    <Text style={[styles.attachmentLink, { color: theme.colors.primary, fontFamily: theme.fonts.medium }]}>
                      {t("openFile")}: {submission.attachment_name || t("file")}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            ))
          ) : (
            null
          )}
        </AppCard>
      ) : null}
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 22,
    marginBottom: 6,
  },
  meta: {
    fontSize: 12,
    marginBottom: 10,
  },
  tabsCard: {
    marginBottom: 10,
  },
  tabsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  tabButton: {
    minHeight: 34,
    paddingHorizontal: 12,
  },
  cardTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 10,
  },
  cardTitle: {
    flex: 1,
    fontSize: 18,
    lineHeight: 24,
  },
  cardDescription: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 8,
  },
  cardMeta: {
    fontSize: 12,
  },
  homeworkEditWrap: {
    marginTop: 10,
    gap: 8,
  },
  editButton: {
    alignSelf: "flex-start",
    minHeight: 34,
  },
  editFormWrap: {
    marginTop: 2,
  },
  studentSubmissionWrap: {
    marginTop: 12,
    gap: 8,
  },
  studentStatus: {
    fontSize: 12,
  },
  needsFixText: {
    fontSize: 12,
  },
  inputLabel: {
    fontSize: 13,
    marginBottom: 6,
  },
  submissionsWrap: {
    marginTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 12,
  },
  submissionsTitle: {
    fontSize: 14,
    marginBottom: 8,
  },
  submissionItem: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    marginBottom: 10,
  },
  submissionName: {
    fontSize: 14,
    marginBottom: 4,
  },
  submissionMeta: {
    fontSize: 12,
    marginBottom: 2,
  },
  reviewHomeworkTitle: {
    fontSize: 12,
    marginBottom: 4,
  },
  submissionText: {
    fontSize: 13,
    marginTop: 6,
    marginBottom: 6,
  },
  attachmentLink: {
    fontSize: 13,
    marginBottom: 8,
  },
  submissionActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 2,
  },
  gradeScaleRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 8,
  },
  gradeButton: {
    minHeight: 34,
    minWidth: 44,
  },
  actionBtn: {
    minHeight: 34,
  },
});
