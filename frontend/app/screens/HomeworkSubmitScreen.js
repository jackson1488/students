/**
 * Module: app/screens/HomeworkSubmitScreen.js
 *
 * Purpose:
 * - Screen module for HomeworkSubmitScreen. Handles state, data loading, and UI for this route.
 *
 * Module notes:
 * - Imports count: 10.
 * - This header is written for beginners: read purpose first, then function map below.
 *
 * Function map:
 * - HomeworkSubmitScreen: Main React component or UI container exported by this file.
 * - firstSubmission: Helper function used by this module business logic.
 * - normalizedStatus: Transforms input/output values to stable display or API format.
 * - statusLabel: Helper function used by this module business logic.
 * - pickAttachment: Helper function used by this module business logic.
 * - onSubmit: Callback function invoked by UI or navigation events.
 * - canSubmit: Helper function used by this module business logic.
 * - loadMySubmission: Loads remote/local data and updates screen/component state.
 */

import * as DocumentPicker from "expo-document-picker";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";

import AppButton from "../components/AppButton";
import AppCard from "../components/AppCard";
import AppInput from "../components/AppInput";
import ScreenLayout from "../components/ScreenLayout";
import { useI18n } from "../hooks/I18nContext";
import { useThemeMode } from "../hooks/ThemeContext";
import { fetchHomeworkSubmissions, submitHomework } from "../services/homeworkService";

function firstSubmission(value) {
  if (!Array.isArray(value) || !value.length) return null;
  return value[0] || null;
}

function normalizedStatus(value) {
  return String(value || "").trim().toLowerCase();
}

function statusLabel(t, value) {
  const status = normalizedStatus(value);
  if (!status) return t("homeworkNotSubmitted");
  if (status === "submitted") return t("submittedStatus");
  if (status === "reviewed") return t("reviewedStatus");
  if (status === "completed") return t("completedStatus");
  if (status === "needs_fix" || status === "rejected") return t("needsFixStatus");
  return value || "-";
}

export default function HomeworkSubmitScreen({ route, navigation }) {
  const { t } = useI18n();
  const { theme } = useThemeMode();

  const homeworkId = Number(route?.params?.homeworkId || 0);
  const subject = String(route?.params?.subject || "General").trim() || "General";
  const title = String(route?.params?.title || "").trim();
  const description = String(route?.params?.description || "").trim();
  const dueDate = String(route?.params?.dueDate || "").trim();
  const initialSubmission = route?.params?.submission || null;

  const [comment, setComment] = useState(String(initialSubmission?.comment || ""));
  const [pendingAttachment, setPendingAttachment] = useState(null);
  const [existingSubmission, setExistingSubmission] = useState(initialSubmission);
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(false);

  const canSubmit = useMemo(() => Boolean(homeworkId > 0), [homeworkId]);
  const submissionStatus = normalizedStatus(existingSubmission?.status);
  const isCompleted = submissionStatus === "completed";
  const needsResubmit = submissionStatus === "needs_fix" || submissionStatus === "rejected";

  const loadMySubmission = useCallback(async () => {
    if (!homeworkId) return;
    setLoading(true);
    try {
      const data = await fetchHomeworkSubmissions(homeworkId);
      const one = firstSubmission(data);
      setExistingSubmission(one);
      if (one) {
        setComment((prev) => (String(prev || "").trim() ? prev : String(one.comment || "")));
      }
    } catch (error) {
      Alert.alert(t("homework"), error?.response?.data?.error || t("unknownError"));
    } finally {
      setLoading(false);
    }
  }, [homeworkId, t]);

  useEffect(() => {
    loadMySubmission();
  }, [loadMySubmission]);

  const pickAttachment = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ["*/*"],
      copyToCacheDirectory: true,
      multiple: false,
    });

    if (result.canceled || !result.assets?.length) return;
    setPendingAttachment(result.assets[0]);
  };

  const onSubmit = async () => {
    const cleanComment = String(comment || "").trim();
    if (!cleanComment && !pendingAttachment) {
      Alert.alert(t("homework"), t("homeworkAddCommentOrFile"));
      return;
    }

    if (!canSubmit) return;
    setSending(true);
    try {
      const row = await submitHomework(homeworkId, {
        comment: cleanComment,
        attachmentAsset: pendingAttachment,
      });
      setExistingSubmission(row || null);
      setPendingAttachment(null);
      Alert.alert(t("homework"), t("homeworkSubmittedSuccess"));
      navigation.goBack();
    } catch (error) {
      Alert.alert(t("homework"), error?.response?.data?.error || t("unknownError"));
    } finally {
      setSending(false);
    }
  };

  return (
    <ScreenLayout onRefresh={loadMySubmission} refreshing={loading}>
      <AppCard>
        <Text style={[styles.subject, { color: theme.colors.text, fontFamily: theme.fonts.bold }]}>{subject}</Text>
        <Text style={[styles.title, { color: theme.colors.text, fontFamily: theme.fonts.bold }]}>{title || "-"}</Text>
        <Text style={[styles.description, { color: theme.colors.text, fontFamily: theme.fonts.regular }]}>
          {description || "-"}
        </Text>
        <Text style={[styles.meta, { color: theme.colors.textMuted, fontFamily: theme.fonts.regular }]}>
          {t("dueDate")}: {dueDate || "-"}
        </Text>
        <Text style={[styles.meta, { color: theme.colors.textMuted, fontFamily: theme.fonts.regular }]}>
          {t("homeworkMySubmissionStatus")}: {statusLabel(t, existingSubmission?.status)}
        </Text>
        {needsResubmit ? (
          <Text style={[styles.meta, { color: "#B00020", fontFamily: theme.fonts.medium }]}>{t("homeworkNeedsResubmit")}</Text>
        ) : null}
        {existingSubmission?.review_comment ? (
          <Text style={[styles.meta, { color: theme.colors.textMuted, fontFamily: theme.fonts.regular }]}>
            {t("reviewComment")}: {existingSubmission.review_comment}
          </Text>
        ) : null}
      </AppCard>

      <AppCard>
        <Text style={[styles.sectionTitle, { color: theme.colors.text, fontFamily: theme.fonts.bold }]}>
          {t("submitHomeworkAction")}
        </Text>
        <AppInput
          label={t("submissionComment")}
          value={comment}
          onChangeText={setComment}
          multiline
          inputStyle={{ minHeight: 120, textAlignVertical: "top" }}
        />

        <View style={styles.actionsRow}>
          <AppButton title={t("attachFile")} variant="ghost" onPress={pickAttachment} style={styles.actionButton} />
          {pendingAttachment ? (
            <AppButton
              title={t("removeFile")}
              variant="ghost"
              onPress={() => setPendingAttachment(null)}
              style={styles.actionButton}
            />
          ) : null}
        </View>

        <Text style={[styles.fileLabel, { color: theme.colors.textMuted, fontFamily: theme.fonts.regular }]}>
          {pendingAttachment?.name || existingSubmission?.attachment_name || t("noFileAttached")}
        </Text>

        <AppButton
          title={isCompleted ? t("completedStatus") : t("submitHomeworkAction")}
          onPress={onSubmit}
          loading={sending}
          disabled={!canSubmit || isCompleted}
        />
      </AppCard>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  subject: {
    fontSize: 13,
    marginBottom: 6,
  },
  title: {
    fontSize: 19,
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  meta: {
    fontSize: 12,
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 17,
    marginBottom: 10,
  },
  actionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 8,
  },
  actionButton: {
    minHeight: 36,
  },
  fileLabel: {
    fontSize: 12,
    marginBottom: 10,
  },
});
