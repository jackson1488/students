/**
 * Module: app/screens/HomeworkScreen.js
 *
 * Purpose:
 * - Screen module for HomeworkScreen. Handles state, data loading, and UI for this route.
 *
 * Module notes:
 * - Imports count: 12.
 * - This header is written for beginners: read purpose first, then function map below.
 *
 * Function map:
 * - HomeworkScreen: Main React component or UI container exported by this file.
 * - readableDate: Helper function used by this module business logic.
 * - normalizeArray: Transforms input/output values to stable display or API format.
 * - normalizeGroupRows: Transforms input/output values to stable display or API format.
 * - normalizeStudentRows: Transforms input/output values to stable display or API format.
 * - onCreate: Callback function invoked by UI or navigation events.
 * - onRefresh: Callback function invoked by UI or navigation events.
 * - openSubject: Controls modal/sheet/screen visibility or navigation transition.
 * - viewGroups: Helper function used by this module business logic.
 * - groupsForSubject: Helper function used by this module business logic.
 * - studentsForCreateGroup: Helper function used by this module business logic.
 * - loadAdminGroups: Loads remote/local data and updates screen/component state.
 * - loadTeacherTargets: Loads remote/local data and updates screen/component state.
 * - names: Helper function used by this module business logic.
 * - ids: Helper function used by this module business logic.
 * - subjectBuckets: Helper function used by this module business logic.
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Platform, Pressable, StyleSheet, Text, View } from "react-native";

import AppButton from "../components/AppButton";
import AppCard from "../components/AppCard";
import AppInput from "../components/AppInput";
import BirthDateField from "../components/BirthDateField";
import ScreenLayout from "../components/ScreenLayout";
import { useAuth } from "../hooks/AuthContext";
import { useI18n } from "../hooks/I18nContext";
import { useThemeMode } from "../hooks/ThemeContext";
import { fetchGroups } from "../services/academyService";
import { createHomework, fetchHomeworkByGroup, fetchHomeworkTargets } from "../services/homeworkService";

const TARGET_MODE_ALL_GROUPS = "all_groups";
const TARGET_MODE_GROUP = "group";
const TARGET_MODE_STUDENT = "student";

function readableDate(value) {
  if (!value || typeof value !== "string") return "-";
  return value.split("T")[0];
}

function normalizeArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeGroupRows(rows) {
  return normalizeArray(rows)
    .map((row) => ({
      id: row?.id,
      name: String(row?.name || "").trim(),
      subjects: normalizeArray(row?.subjects).map((item) => String(item || "").trim()).filter(Boolean),
    }))
    .filter((row) => row.name);
}

function normalizeStudentRows(rows) {
  return normalizeArray(rows)
    .map((row) => ({
      id: Number(row?.id || 0),
      group_id: String(row?.group_id || "").trim(),
      name: String(row?.name || "").trim() || String(row?.login || "").trim() || "-",
    }))
    .filter((row) => row.id > 0 && row.group_id);
}

export default function HomeworkScreen({ navigation }) {
  const { t } = useI18n();
  const { theme } = useThemeMode();
  const { role, groupId: currentGroupId } = useAuth();

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  const [adminGroups, setAdminGroups] = useState([]);
  const [teacherGroups, setTeacherGroups] = useState([]);
  const [teacherSubjects, setTeacherSubjects] = useState([]);
  const [teacherStudents, setTeacherStudents] = useState([]);

  const [selectedViewGroup, setSelectedViewGroup] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("");
  const [targetMode, setTargetMode] = useState(TARGET_MODE_GROUP);
  const [createTargetGroup, setCreateTargetGroup] = useState("");
  const [selectedTargetStudentId, setSelectedTargetStudentId] = useState("");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");

  const canCreate = role === "teacher";
  const canLoadByGroup = role === "teacher" || role === "admin";

  const viewGroups = useMemo(() => {
    if (role === "admin") {
      return adminGroups;
    }
    if (role === "teacher") {
      return teacherGroups.map((row) => row.name);
    }
    return [];
  }, [adminGroups, role, teacherGroups]);

  const groupsForSubject = useMemo(() => {
    if (!selectedSubject) return teacherGroups.map((row) => row.name);
    return teacherGroups
      .filter((row) => row.subjects.includes(selectedSubject))
      .map((row) => row.name);
  }, [selectedSubject, teacherGroups]);

  const studentsForCreateGroup = useMemo(() => {
    if (!createTargetGroup) return [];
    return teacherStudents.filter((row) => row.group_id === createTargetGroup);
  }, [createTargetGroup, teacherStudents]);

  const targetGroup = canLoadByGroup ? selectedViewGroup : currentGroupId;

  const loadHomework = useCallback(
    async (groupRef) => {
      const target = String(groupRef || "").trim();
      if (!target) {
        setRows([]);
        return;
      }

      setLoading(true);
      try {
        const data = await fetchHomeworkByGroup(target);
        setRows(Array.isArray(data) ? data : []);
      } catch (error) {
        Alert.alert(t("homework"), error?.response?.data?.error || t("unknownError"));
      } finally {
        setLoading(false);
      }
    },
    [t]
  );

  const loadAdminGroups = useCallback(async () => {
    if (role !== "admin") return;
    try {
      const data = await fetchGroups();
      const list = normalizeArray(data)
        .map((row) => String(row?.name || "").trim())
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b, "ru", { sensitivity: "base" }));

      setAdminGroups(list);
      setSelectedViewGroup((prev) => {
        if (prev && list.includes(prev)) return prev;
        return list[0] || "";
      });
    } catch (error) {
      Alert.alert(t("homework"), error?.response?.data?.error || t("unknownError"));
    }
  }, [role, t]);

  const loadTeacherTargets = useCallback(async () => {
    if (role !== "teacher") return;
    try {
      const data = await fetchHomeworkTargets();
      const nextGroups = normalizeGroupRows(data?.groups);
      const nextSubjects = normalizeArray(data?.subjects)
        .map((item) => String(item || "").trim())
        .filter(Boolean);
      const nextStudents = normalizeStudentRows(data?.students);

      setTeacherGroups(nextGroups);
      setTeacherSubjects(nextSubjects);
      setTeacherStudents(nextStudents);

      setSelectedViewGroup((prev) => {
        const names = nextGroups.map((row) => row.name);
        if (prev && names.includes(prev)) return prev;
        return names[0] || "";
      });
      setSelectedSubject((prev) => {
        if (prev && nextSubjects.includes(prev)) return prev;
        return nextSubjects[0] || "";
      });
    } catch (error) {
      Alert.alert(t("homework"), error?.response?.data?.error || t("unknownError"));
    }
  }, [role, t]);

  useEffect(() => {
    if (role === "admin") {
      loadAdminGroups();
      return;
    }
    if (role === "teacher") {
      loadTeacherTargets();
      return;
    }

    setAdminGroups([]);
    setTeacherGroups([]);
    setTeacherSubjects([]);
    setTeacherStudents([]);
    setSelectedViewGroup("");
    setSelectedSubject("");
  }, [loadAdminGroups, loadTeacherTargets, role]);

  useEffect(() => {
    if (role !== "teacher") return;
    if (!teacherSubjects.length) {
      setSelectedSubject("");
      return;
    }
    if (!teacherSubjects.includes(selectedSubject)) {
      setSelectedSubject(teacherSubjects[0]);
    }
  }, [role, selectedSubject, teacherSubjects]);

  useEffect(() => {
    if (role !== "teacher") return;
    if (!groupsForSubject.length) {
      setCreateTargetGroup("");
      return;
    }
    if (!groupsForSubject.includes(createTargetGroup)) {
      setCreateTargetGroup(groupsForSubject[0]);
    }
  }, [createTargetGroup, groupsForSubject, role]);

  useEffect(() => {
    if (role !== "teacher") return;
    if (targetMode !== TARGET_MODE_STUDENT) return;
    if (!studentsForCreateGroup.length) {
      setSelectedTargetStudentId("");
      return;
    }
    const ids = studentsForCreateGroup.map((row) => String(row.id));
    if (!ids.includes(selectedTargetStudentId)) {
      setSelectedTargetStudentId(ids[0]);
    }
  }, [role, selectedTargetStudentId, studentsForCreateGroup, targetMode]);

  useEffect(() => {
    if (role === "student") {
      if (currentGroupId) {
        loadHomework(currentGroupId);
      } else {
        setRows([]);
      }
      return;
    }

    if (canLoadByGroup && selectedViewGroup) {
      loadHomework(selectedViewGroup);
      return;
    }

    if (canLoadByGroup && !selectedViewGroup) {
      setRows([]);
    }
  }, [canLoadByGroup, currentGroupId, loadHomework, role, selectedViewGroup]);

  const onCreate = async () => {
    if (!canCreate) return;

    if (!selectedSubject || !title.trim() || !description.trim()) {
      Alert.alert(t("homework"), t("fillRequiredFields"));
      return;
    }

    const payload = {
      subject: selectedSubject,
      title: title.trim(),
      description: description.trim(),
      due_date: String(dueDate || "").trim() || undefined,
      target_mode: targetMode,
    };

    if (targetMode === TARGET_MODE_GROUP) {
      if (!createTargetGroup) {
        Alert.alert(t("homework"), t("fillRequiredFields"));
        return;
      }
      payload.group_id = createTargetGroup;
    }

    if (targetMode === TARGET_MODE_STUDENT) {
      if (!createTargetGroup || !selectedTargetStudentId) {
        Alert.alert(t("homework"), t("fillRequiredFields"));
        return;
      }
      payload.group_id = createTargetGroup;
      payload.student_id = Number(selectedTargetStudentId);
    }

    try {
      await createHomework(payload);
      setTitle("");
      setDescription("");
      setDueDate("");

      const refreshGroup = selectedViewGroup || createTargetGroup || currentGroupId;
      if (refreshGroup) {
        await loadHomework(refreshGroup);
      }
    } catch (error) {
      Alert.alert(t("homework"), error?.response?.data?.error || t("unknownError"));
    }
  };

  const onRefresh = async () => {
    if (!targetGroup) return;
    await loadHomework(targetGroup);
  };

  const subjectBuckets = useMemo(() => {
    const map = new Map();
    rows.forEach((item) => {
      const key = String(item.subject || "General").trim() || "General";
      const bucket = map.get(key) || { subject: key, count: 0, lastDate: "" };
      bucket.count += 1;
      bucket.lastDate = readableDate(item.created_at);
      map.set(key, bucket);
    });
    return Array.from(map.values()).sort((a, b) => a.subject.localeCompare(b.subject, "ru", { sensitivity: "base" }));
  }, [rows]);

  const openSubject = (subjectName) => {
    if (!targetGroup) return;
    navigation.navigate("HomeworkDetail", {
      groupId: targetGroup,
      subject: subjectName,
    });
  };

  return (
    <ScreenLayout onRefresh={onRefresh} refreshing={loading}>
      {Platform.OS === "web" ? (
        <Text style={[styles.title, { color: theme.colors.text, fontFamily: theme.fonts.bold }]}>{t("homework")}</Text>
      ) : null}

      {canCreate ? (
        <AppCard>
          <Text style={[styles.sectionTitle, { color: theme.colors.text, fontFamily: theme.fonts.bold }]}>
            {t("createHomework")}
          </Text>

          <Text style={[styles.inputLabel, { color: theme.colors.text, fontFamily: theme.fonts.medium }]}>{t("subject")}</Text>
          <View style={styles.selectorWrap}>
            {teacherSubjects.map((subjectName) => (
              <AppButton
                key={`subject-${subjectName}`}
                title={subjectName}
                variant={selectedSubject === subjectName ? "primary" : "ghost"}
                onPress={() => setSelectedSubject(subjectName)}
                style={styles.selectorBtn}
              />
            ))}
          </View>
          {!teacherSubjects.length ? (
            <Text style={[styles.helperText, { color: theme.colors.textMuted, fontFamily: theme.fonts.regular }]}>
              {t("homeworkNoTeacherSubjects")}
            </Text>
          ) : null}

          <Text style={[styles.inputLabel, { color: theme.colors.text, fontFamily: theme.fonts.medium }]}>{t("homeworkAssignMode")}</Text>
          <View style={styles.selectorWrap}>
            <AppButton
              title={t("homeworkTargetAllGroups")}
              variant={targetMode === TARGET_MODE_ALL_GROUPS ? "primary" : "ghost"}
              onPress={() => setTargetMode(TARGET_MODE_ALL_GROUPS)}
              style={styles.selectorBtn}
            />
            <AppButton
              title={t("homeworkTargetGroup")}
              variant={targetMode === TARGET_MODE_GROUP ? "primary" : "ghost"}
              onPress={() => setTargetMode(TARGET_MODE_GROUP)}
              style={styles.selectorBtn}
            />
            <AppButton
              title={t("homeworkTargetStudent")}
              variant={targetMode === TARGET_MODE_STUDENT ? "primary" : "ghost"}
              onPress={() => setTargetMode(TARGET_MODE_STUDENT)}
              style={styles.selectorBtn}
            />
          </View>

          {targetMode !== TARGET_MODE_ALL_GROUPS ? (
            <>
              <Text style={[styles.inputLabel, { color: theme.colors.text, fontFamily: theme.fonts.medium }]}>
                {t("groupName")}
              </Text>
              <View style={styles.selectorWrap}>
                {groupsForSubject.map((groupName) => (
                  <AppButton
                    key={`create-group-${groupName}`}
                    title={groupName}
                    variant={createTargetGroup === groupName ? "primary" : "ghost"}
                    onPress={() => setCreateTargetGroup(groupName)}
                    style={styles.selectorBtn}
                  />
                ))}
              </View>
              {!groupsForSubject.length ? (
                <Text style={[styles.helperText, { color: theme.colors.textMuted, fontFamily: theme.fonts.regular }]}>
                  {t("homeworkNoTargetGroups")}
                </Text>
              ) : null}
            </>
          ) : (
            <Text style={[styles.helperText, { color: theme.colors.textMuted, fontFamily: theme.fonts.regular }]}>
              {t("homeworkAllGroupsHint", { count: groupsForSubject.length })}
            </Text>
          )}

          {targetMode === TARGET_MODE_STUDENT ? (
            <>
              <Text style={[styles.inputLabel, { color: theme.colors.text, fontFamily: theme.fonts.medium }]}>
                {t("homeworkSelectStudent")}
              </Text>
              <View style={styles.selectorWrap}>
                {studentsForCreateGroup.map((student) => (
                  <AppButton
                    key={`student-target-${student.id}`}
                    title={student.name}
                    variant={selectedTargetStudentId === String(student.id) ? "primary" : "ghost"}
                    onPress={() => setSelectedTargetStudentId(String(student.id))}
                    style={styles.selectorBtn}
                  />
                ))}
              </View>
              {!studentsForCreateGroup.length ? (
                <Text style={[styles.helperText, { color: theme.colors.textMuted, fontFamily: theme.fonts.regular }]}>
                  {t("homeworkNoGroupStudents")}
                </Text>
              ) : null}
            </>
          ) : null}

          <AppInput label={t("title")} value={title} onChangeText={setTitle} />
          <AppInput
            label={t("description")}
            value={description}
            onChangeText={setDescription}
            multiline
            inputStyle={{ minHeight: 80, textAlignVertical: "top" }}
          />
          <BirthDateField label={t("dueDate")} value={dueDate} onChangeText={setDueDate} />
          <AppButton title={t("create")} onPress={onCreate} disabled={!teacherSubjects.length} />
        </AppCard>
      ) : null}

      {canLoadByGroup ? (
        <AppCard style={styles.groupSelectorCard}>
          <View style={styles.selectorWrap}>
            {viewGroups.map((groupName) => (
              <AppButton
                key={`group-view-${groupName}`}
                title={groupName}
                variant={selectedViewGroup === groupName ? "primary" : "ghost"}
                onPress={() => setSelectedViewGroup(groupName)}
                style={styles.selectorBtn}
              />
            ))}
          </View>
        </AppCard>
      ) : null}

      <Text style={[styles.meta, { color: theme.colors.textMuted }]}>{loading ? t("loading") : " "}</Text>

      {subjectBuckets.length ? (
        subjectBuckets.map((item) => (
          <Pressable key={`subject-${item.subject}`} onPress={() => openSubject(item.subject)} style={({ pressed }) => [{ opacity: pressed ? 0.92 : 1 }]}>
            <AppCard>
              <Text style={[styles.subjectTitle, { color: theme.colors.text, fontFamily: theme.fonts.bold }]}>{item.subject}</Text>
              <Text style={[styles.subjectMeta, { color: theme.colors.textMuted, fontFamily: theme.fonts.regular }]}>
                {t("tasksCount")}: {item.count}
              </Text>
              <Text style={[styles.subjectMeta, { color: theme.colors.textMuted, fontFamily: theme.fonts.regular }]}>
                {t("date")}: {item.lastDate || "-"}
              </Text>
            </AppCard>
          </Pressable>
        ))
      ) : null}
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
  helperText: {
    fontSize: 12,
    marginBottom: 10,
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
  groupSelectorCard: {
    paddingTop: 10,
    paddingBottom: 10,
  },
  meta: {
    marginBottom: 8,
    fontSize: 12,
    fontFamily: "serif",
  },
  subjectTitle: {
    fontSize: 20,
    marginBottom: 6,
  },
  subjectMeta: {
    fontSize: 12,
  },
});
