/**
 * Module: app/screens/UsersScreen.js
 *
 * Purpose:
 * - Screen module for UsersScreen. Handles state, data loading, and UI for this route.
 *
 * Module notes:
 * - Imports count: 13.
 * - This header is written for beginners: read purpose first, then function map below.
 *
 * Function map:
 * - UsersScreen: Main React component or UI container exported by this file.
 * - normalizeId: Transforms input/output values to stable display or API format.
 * - calculateCourse: Helper function used by this module business logic.
 * - subjectCsvToArray: Helper function used by this module business logic.
 * - resolveMediaUrl: Builds derived values and resolves runtime decisions.
 * - extractStudentCode: Helper function used by this module business logic.
 * - onCreateGroup: Callback function invoked by UI or navigation events.
 * - onUpdateGroupCourse: Callback function invoked by UI or navigation events.
 * - onCreateTeacher: Callback function invoked by UI or navigation events.
 * - onCreateStudent: Callback function invoked by UI or navigation events.
 * - onCreateBinding: Callback function invoked by UI or navigation events.
 * - onDeleteUser: Callback function invoked by UI or navigation events.
 * - saveEditTeacher: Helper function used by this module business logic.
 * - saveEditStudent: Helper function used by this module business logic.
 * - startEditTeacher: Helper function used by this module business logic.
 * - cancelEditTeacher: Helper function used by this module business logic.
 * - startEditStudent: Helper function used by this module business logic.
 * - cancelEditStudent: Helper function used by this module business logic.
 * - renderPasswordToggle: Builds and returns a UI fragment for rendering.
 * - renderTabs: Builds and returns a UI fragment for rendering.
 * - renderTeacherCards: Builds and returns a UI fragment for rendering.
 * - renderStudentCards: Builds and returns a UI fragment for rendering.
 * - renderGroupsTab: Builds and returns a UI fragment for rendering.
 * - renderTeachersTab: Builds and returns a UI fragment for rendering.
 * - renderStudentsTab: Builds and returns a UI fragment for rendering.
 * - renderBindingsTab: Builds and returns a UI fragment for rendering.
 * - loadGroups: Loads remote/local data and updates screen/component state.
 * - loadTeachers: Loads remote/local data and updates screen/component state.
 * - loadStudents: Loads remote/local data and updates screen/component state.
 * - loadBindings: Loads remote/local data and updates screen/component state.
 * - loadAll: Loads remote/local data and updates screen/component state.
 * - exists: Helper function used by this module business logic.
 * - selectedGroup: Helper function used by this module business logic.
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Image, Platform, Pressable, StyleSheet, Text, View } from "react-native";

import AppButton from "../components/AppButton";
import AppCard from "../components/AppCard";
import AppInput from "../components/AppInput";
import BirthDateField from "../components/BirthDateField";
import DataTable from "../components/DataTable";
import ScreenLayout from "../components/ScreenLayout";
import { useI18n } from "../hooks/I18nContext";
import { useThemeMode } from "../hooks/ThemeContext";
import {
  createBinding,
  createGroup,
  createStudent,
  createTeacher,
  fetchBindings,
  fetchGroups,
  fetchStudents,
  fetchTeachers,
  updateGroup,
  updateStudent,
  updateTeacher,
} from "../services/academyService";
import { removeUser } from "../services/usersService";
import { API_BASE_URL } from "../services/api";

const TAB_KEYS = ["groups", "teachers", "students", "bindings"];
const TAB_TITLE_KEYS = {
  groups: "usersTabsGroups",
  teachers: "usersTabsTeachers",
  students: "usersTabsStudents",
  bindings: "usersTabsBindings",
};

function normalizeId(value) {
  const num = Number(value);
  return Number.isInteger(num) && num > 0 ? num : null;
}

function calculateCourse(admissionYear) {
  const year = Number(admissionYear);
  if (!Number.isInteger(year) || year <= 0) return "-";

  const now = new Date();
  let course = now.getFullYear() - year;
  if (now.getMonth() >= 8) {
    course += 1;
  }

  return String(Math.max(1, Math.min(6, course)));
}

function subjectCsvToArray(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function resolveMediaUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;
  if (raw.startsWith("/")) return `${API_BASE_URL}${raw}`;
  return raw;
}

function extractStudentCode(loginValue) {
  const raw = String(loginValue || "").trim();
  if (!raw) return "";
  const parts = raw.split("-");
  const tail = parts[parts.length - 1] || "";
  return /^\d+$/.test(tail) ? tail : "";
}

export default function UsersScreen({ navigation }) {
  const { t } = useI18n();
  const { theme } = useThemeMode();

  const [activeTab, setActiveTab] = useState("groups");
  const [loading, setLoading] = useState(false);

  const [groups, setGroups] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [students, setStudents] = useState([]);
  const [bindings, setBindings] = useState([]);

  const [groupName, setGroupName] = useState("");
  const [groupYear, setGroupYear] = useState("");
  const [groupSpecialty, setGroupSpecialty] = useState("");
  const [groupCourseTargetId, setGroupCourseTargetId] = useState("");
  const [groupCourseValue, setGroupCourseValue] = useState("");

  const [teacherLastName, setTeacherLastName] = useState("");
  const [teacherFirstName, setTeacherFirstName] = useState("");
  const [teacherMiddleName, setTeacherMiddleName] = useState("");
  const [teacherLogin, setTeacherLogin] = useState("");
  const [teacherSubjects, setTeacherSubjects] = useState("");
  const [teacherPassword, setTeacherPassword] = useState("");
  const [teacherBirthDate, setTeacherBirthDate] = useState("");
  const [teacherBiography, setTeacherBiography] = useState("");
  const [showTeacherPassword, setShowTeacherPassword] = useState(false);

  const [studentLastName, setStudentLastName] = useState("");
  const [studentFirstName, setStudentFirstName] = useState("");
  const [studentMiddleName, setStudentMiddleName] = useState("");
  const [studentGroupId, setStudentGroupId] = useState("");
  const [studentBirthDate, setStudentBirthDate] = useState("");
  const [studentBiography, setStudentBiography] = useState("");
  const [createdStudentCredentials, setCreatedStudentCredentials] = useState(null);

  const [bindingTeacherId, setBindingTeacherId] = useState("");
  const [bindingGroupId, setBindingGroupId] = useState("");
  const [bindingSubject, setBindingSubject] = useState("");

  const [editingTeacherId, setEditingTeacherId] = useState(null);
  const [editingTeacherLastName, setEditingTeacherLastName] = useState("");
  const [editingTeacherFirstName, setEditingTeacherFirstName] = useState("");
  const [editingTeacherMiddleName, setEditingTeacherMiddleName] = useState("");
  const [editingTeacherLogin, setEditingTeacherLogin] = useState("");
  const [editingTeacherSubjects, setEditingTeacherSubjects] = useState("");
  const [editingTeacherPassword, setEditingTeacherPassword] = useState("");
  const [editingTeacherBirthDate, setEditingTeacherBirthDate] = useState("");
  const [showEditingTeacherPassword, setShowEditingTeacherPassword] = useState(false);

  const [editingStudentId, setEditingStudentId] = useState(null);
  const [editingStudentLastName, setEditingStudentLastName] = useState("");
  const [editingStudentFirstName, setEditingStudentFirstName] = useState("");
  const [editingStudentMiddleName, setEditingStudentMiddleName] = useState("");
  const [editingStudentLogin, setEditingStudentLogin] = useState("");
  const [editingStudentGroupId, setEditingStudentGroupId] = useState("");
  const [editingStudentPassword, setEditingStudentPassword] = useState("");
  const [editingStudentBirthDate, setEditingStudentBirthDate] = useState("");
  const [showEditingStudentPassword, setShowEditingStudentPassword] = useState(false);

  const loadGroups = useCallback(async () => {
    const data = await fetchGroups();
    setGroups(Array.isArray(data) ? data : []);
  }, []);

  const loadTeachers = useCallback(async () => {
    const data = await fetchTeachers();
    setTeachers(Array.isArray(data) ? data : []);
  }, []);

  const loadStudents = useCallback(async () => {
    const data = await fetchStudents();
    setStudents(Array.isArray(data) ? data : []);
  }, []);

  const loadBindings = useCallback(async () => {
    const data = await fetchBindings();
    setBindings(Array.isArray(data) ? data : []);
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([loadGroups(), loadTeachers(), loadStudents(), loadBindings()]);
    } catch (error) {
      Alert.alert(t("users"), error?.response?.data?.error || t("unknownError"));
    } finally {
      setLoading(false);
    }
  }, [loadBindings, loadGroups, loadStudents, loadTeachers, t]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    if (!groups.length) {
      setGroupCourseTargetId("");
      setGroupCourseValue("");
      return;
    }

    const exists = groups.some((group) => Number(group.id) === Number(groupCourseTargetId));
    if (!exists) {
      setGroupCourseTargetId(String(groups[0].id));
    }
  }, [groupCourseTargetId, groups]);

  useEffect(() => {
    const selectedGroup = groups.find((group) => Number(group.id) === Number(groupCourseTargetId));
    if (!selectedGroup) return;
    setGroupCourseValue(calculateCourse(selectedGroup.admission_year));
  }, [groupCourseTargetId, groups]);

  const onCreateGroup = async () => {
    if (!groupName.trim() || !groupYear.trim() || !groupSpecialty.trim()) return;

    try {
      await createGroup({
        name: groupName.trim(),
        admission_year: Number(groupYear),
        specialty: groupSpecialty.trim(),
      });

      setGroupName("");
      setGroupYear("");
      setGroupSpecialty("");
      await loadGroups();
    } catch (error) {
      Alert.alert(t("users"), error?.response?.data?.error || t("unknownError"));
    }
  };

  const onUpdateGroupCourse = async () => {
    const targetGroupId = normalizeId(groupCourseTargetId);
    const targetCourse = Number(groupCourseValue);
    if (!targetGroupId) return;
    if (!Number.isInteger(targetCourse) || targetCourse < 1 || targetCourse > 6) {
      Alert.alert(t("users"), `${t("course")}: 1-6`);
      return;
    }

    try {
      await updateGroup(targetGroupId, { course: targetCourse });
      await Promise.all([loadGroups(), loadStudents()]);
    } catch (error) {
      Alert.alert(t("users"), error?.response?.data?.error || t("unknownError"));
    }
  };

  const onCreateTeacher = async () => {
    const subjects = subjectCsvToArray(teacherSubjects);

    if (
      !teacherLastName.trim() ||
      !teacherFirstName.trim() ||
      !teacherLogin.trim() ||
      !teacherPassword.trim() ||
      !subjects.length
    ) {
      return;
    }

    try {
      await createTeacher({
        last_name: teacherLastName.trim(),
        first_name: teacherFirstName.trim(),
        middle_name: teacherMiddleName.trim() || null,
        login: teacherLogin.trim().toLowerCase(),
        subjects,
        password: teacherPassword,
        birth_date: String(teacherBirthDate || "").trim(),
        biography: String(teacherBiography || "").trim(),
      });

      setTeacherLastName("");
      setTeacherFirstName("");
      setTeacherMiddleName("");
      setTeacherLogin("");
      setTeacherSubjects("");
      setTeacherPassword("");
      setTeacherBirthDate("");
      setTeacherBiography("");
      setShowTeacherPassword(false);
      await loadTeachers();
    } catch (error) {
      Alert.alert(t("users"), error?.response?.data?.error || t("unknownError"));
    }
  };

  const onCreateStudent = async () => {
    const targetGroupId = normalizeId(studentGroupId);
    if (!studentLastName.trim() || !studentFirstName.trim() || !targetGroupId) return;

    try {
      const created = await createStudent({
        last_name: studentLastName.trim(),
        first_name: studentFirstName.trim(),
        middle_name: studentMiddleName.trim() || null,
        group_id: targetGroupId,
        birth_date: String(studentBirthDate || "").trim(),
        biography: String(studentBiography || "").trim(),
      });

      setStudentLastName("");
      setStudentFirstName("");
      setStudentMiddleName("");
      setStudentBirthDate("");
      setStudentBiography("");
      setCreatedStudentCredentials({
        login: created?.login || "",
        initialPassword: created?.initial_password || "",
      });
      await loadStudents();
    } catch (error) {
      Alert.alert(t("users"), error?.response?.data?.error || t("unknownError"));
    }
  };

  const selectedTeacher = useMemo(
    () => teachers.find((row) => Number(row.id) === Number(bindingTeacherId)),
    [bindingTeacherId, teachers]
  );

  const onCreateBinding = async () => {
    const targetTeacherId = normalizeId(bindingTeacherId);
    const targetGroupId = normalizeId(bindingGroupId);
    if (!targetTeacherId || !targetGroupId || !bindingSubject.trim()) return;

    try {
      await createBinding({
        teacher_id: targetTeacherId,
        group_id: targetGroupId,
        subject: bindingSubject.trim(),
      });

      setBindingSubject("");
      await loadBindings();
    } catch (error) {
      Alert.alert(t("users"), error?.response?.data?.error || t("unknownError"));
    }
  };

  const onDeleteUser = async (userId) => {
    try {
      await removeUser(userId);
      await Promise.all([loadTeachers(), loadStudents(), loadBindings()]);
      if (Number(editingTeacherId) === Number(userId)) {
        setEditingTeacherId(null);
      }
      if (Number(editingStudentId) === Number(userId)) {
        setEditingStudentId(null);
      }
    } catch (error) {
      Alert.alert(t("users"), error?.response?.data?.error || t("unknownError"));
    }
  };

  const startEditTeacher = (row) => {
    setEditingTeacherId(row.id);
    setEditingTeacherLastName(row.last_name || "");
    setEditingTeacherFirstName(row.first_name || "");
    setEditingTeacherMiddleName(row.middle_name || "");
    setEditingTeacherLogin(row.login || "");
    setEditingTeacherSubjects((row.subjects || []).join(", "));
    setEditingTeacherPassword("");
    setEditingTeacherBirthDate(row.birth_date || "");
    setShowEditingTeacherPassword(false);
  };

  const cancelEditTeacher = () => {
    setEditingTeacherId(null);
    setEditingTeacherLastName("");
    setEditingTeacherFirstName("");
    setEditingTeacherMiddleName("");
    setEditingTeacherLogin("");
    setEditingTeacherSubjects("");
    setEditingTeacherPassword("");
    setEditingTeacherBirthDate("");
    setShowEditingTeacherPassword(false);
  };

  const saveEditTeacher = async () => {
    const subjects = subjectCsvToArray(editingTeacherSubjects);
    if (!editingTeacherId || !editingTeacherLastName.trim() || !editingTeacherFirstName.trim() || !editingTeacherLogin.trim() || !subjects.length) {
      return;
    }

    try {
      const payload = {
        last_name: editingTeacherLastName.trim(),
        first_name: editingTeacherFirstName.trim(),
        middle_name: editingTeacherMiddleName.trim() || null,
        login: editingTeacherLogin.trim().toLowerCase(),
        subjects,
        birth_date: String(editingTeacherBirthDate || "").trim(),
      };
      if (editingTeacherPassword.trim()) {
        payload.password = editingTeacherPassword;
      }

      await updateTeacher(editingTeacherId, payload);
      cancelEditTeacher();
      await Promise.all([loadTeachers(), loadBindings()]);
    } catch (error) {
      Alert.alert(t("users"), error?.response?.data?.error || t("unknownError"));
    }
  };

  const startEditStudent = (row) => {
    setEditingStudentId(row.id);
    setEditingStudentLastName(row.last_name || "");
    setEditingStudentFirstName(row.first_name || "");
    setEditingStudentMiddleName(row.middle_name || "");
    setEditingStudentLogin(row.login || "");
    setEditingStudentGroupId(String(row.group_ref_id || ""));
    setEditingStudentPassword("");
    setEditingStudentBirthDate(row.birth_date || "");
    setShowEditingStudentPassword(false);
  };

  const cancelEditStudent = () => {
    setEditingStudentId(null);
    setEditingStudentLastName("");
    setEditingStudentFirstName("");
    setEditingStudentMiddleName("");
    setEditingStudentLogin("");
    setEditingStudentGroupId("");
    setEditingStudentPassword("");
    setEditingStudentBirthDate("");
    setShowEditingStudentPassword(false);
  };

  const saveEditStudent = async () => {
    const targetGroupId = normalizeId(editingStudentGroupId);
    if (!editingStudentId || !editingStudentLastName.trim() || !editingStudentFirstName.trim() || !editingStudentLogin.trim() || !targetGroupId) {
      return;
    }

    try {
      const payload = {
        last_name: editingStudentLastName.trim(),
        first_name: editingStudentFirstName.trim(),
        middle_name: editingStudentMiddleName.trim() || null,
        login: editingStudentLogin.trim().toLowerCase(),
        group_id: targetGroupId,
        birth_date: String(editingStudentBirthDate || "").trim(),
      };
      if (editingStudentPassword.trim()) {
        payload.password = editingStudentPassword;
      }

      await updateStudent(editingStudentId, payload);
      cancelEditStudent();
      await loadStudents();
    } catch (error) {
      Alert.alert(t("users"), error?.response?.data?.error || t("unknownError"));
    }
  };

  const renderPasswordToggle = (visible, onPress) => (
    <Pressable onPress={onPress} hitSlop={8}>
      <Text style={[styles.eyeIcon, { color: theme.colors.textMuted }]}>{visible ? "🙈" : "👁"}</Text>
    </Pressable>
  );

  const groupColumns = useMemo(
    () => [
      { key: "id", title: "ID" },
      { key: "name", title: t("groupName") },
      { key: "admission_year", title: t("admissionYear") },
      { key: "course", title: t("course"), render: (row) => calculateCourse(row.admission_year) },
      { key: "specialty", title: t("specialty") },
    ],
    [t]
  );

  const bindingColumns = useMemo(
    () => [
      { key: "id", title: "ID" },
      { key: "group_name", title: t("groupName") },
      { key: "teacher_name", title: t("teacher") },
      { key: "subject", title: t("subject") },
    ],
    [t]
  );

  const renderTabs = () => (
    <View style={styles.tabsWrap}>
      {TAB_KEYS.map((tabKey) => (
        <AppButton
          key={tabKey}
          title={t(TAB_TITLE_KEYS[tabKey])}
          onPress={() => setActiveTab(tabKey)}
          variant={activeTab === tabKey ? "primary" : "ghost"}
          style={styles.tabBtn}
        />
      ))}
    </View>
  );

  const renderTeacherCards = () => {
    if (!teachers.length) {
      return (
        <AppCard>
          <Text style={[styles.helperText, { color: theme.colors.textMuted, fontFamily: theme.fonts.regular }]}>{t("noData")}</Text>
        </AppCard>
      );
    }

    return (
      <View style={styles.cardsWrap}>
        {teachers.map((row) => {
          const isEditing = Number(editingTeacherId) === Number(row.id);
          const title = `${row.last_name || ""} ${row.first_name || ""}`.trim() || row.login;
          const avatarUri = resolveMediaUrl(row.avatar_url);

          return (
            <AppCard key={`teacher-card-${row.id}`}>
              <View style={styles.profileHeadRow}>
                <View style={[styles.avatarThumbWrap, { borderColor: theme.colors.border, backgroundColor: theme.colors.rowAlt }]}>
                  {avatarUri ? (
                    <Image source={{ uri: avatarUri }} style={styles.avatarThumbImage} resizeMode="cover" />
                  ) : (
                    <Text style={[styles.avatarThumbFallback, { color: theme.colors.text, fontFamily: theme.fonts.bold }]}>
                      {String(title || "T").slice(0, 1).toUpperCase()}
                    </Text>
                  )}
                </View>
                <View style={styles.profileHeadMeta}>
                  <Text style={[styles.cardTitle, { color: theme.colors.text, fontFamily: theme.fonts.bold }]}>{title}</Text>
                  <Text style={[styles.cardMeta, { color: theme.colors.textMuted, fontFamily: theme.fonts.regular }]}>@{row.login}</Text>
                </View>
              </View>

              {!isEditing ? (
                <>
                  <Text style={[styles.cardMeta, { color: theme.colors.text, fontFamily: theme.fonts.medium }]}>
                    {t("subjects")}: {(row.subjects || []).join(", ") || "-"}
                  </Text>
                  <Text style={[styles.cardMeta, { color: theme.colors.text, fontFamily: theme.fonts.regular }]}>
                    {t("birthDate")}: {row.birth_date || "-"}
                  </Text>
                  <View style={styles.cardActions}>
                    <AppButton
                      title={t("openProfile")}
                      onPress={() => navigation.navigate("TeacherProfileAdmin", { teacherId: row.id })}
                      variant="ghost"
                      style={styles.inlineButton}
                    />
                    <AppButton title={t("edit")} onPress={() => startEditTeacher(row)} variant="ghost" style={styles.inlineButton} />
                    <AppButton title={t("delete")} onPress={() => onDeleteUser(row.id)} variant="ghost" style={styles.inlineButton} />
                  </View>
                </>
              ) : (
                <>
                  <AppInput label={t("lastName")} value={editingTeacherLastName} onChangeText={setEditingTeacherLastName} />
                  <AppInput label={t("firstName")} value={editingTeacherFirstName} onChangeText={setEditingTeacherFirstName} />
                  <AppInput label={t("middleName")} value={editingTeacherMiddleName} onChangeText={setEditingTeacherMiddleName} />
                  <AppInput
                    label={t("customLogin")}
                    value={editingTeacherLogin}
                    onChangeText={setEditingTeacherLogin}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  <AppInput
                    label={t("subjects")}
                    value={editingTeacherSubjects}
                    onChangeText={setEditingTeacherSubjects}
                    placeholder={t("subjectsCsvHint")}
                  />
                  <AppInput
                    label={t("newPassword")}
                    value={editingTeacherPassword}
                    onChangeText={setEditingTeacherPassword}
                    secureTextEntry={!showEditingTeacherPassword}
                    rightElement={renderPasswordToggle(showEditingTeacherPassword, () => setShowEditingTeacherPassword((prev) => !prev))}
                  />
                  <BirthDateField
                    label={t("birthDate")}
                    value={editingTeacherBirthDate}
                    onChangeText={setEditingTeacherBirthDate}
                    maximumDate={new Date()}
                  />
                  <View style={styles.cardActions}>
                    <AppButton title={t("save")} onPress={saveEditTeacher} style={styles.inlineButton} />
                    <AppButton title={t("cancel")} onPress={cancelEditTeacher} variant="ghost" style={styles.inlineButton} />
                    <AppButton title={t("delete")} onPress={() => onDeleteUser(row.id)} variant="ghost" style={styles.inlineButton} />
                  </View>
                </>
              )}
            </AppCard>
          );
        })}
      </View>
    );
  };

  const renderStudentCards = () => {
    if (!students.length) {
      return (
        <AppCard>
          <Text style={[styles.helperText, { color: theme.colors.textMuted, fontFamily: theme.fonts.regular }]}>{t("noData")}</Text>
        </AppCard>
      );
    }

    return (
      <View style={styles.cardsWrap}>
        {students.map((row) => {
          const isEditing = Number(editingStudentId) === Number(row.id);
          const title = `${row.last_name || ""} ${row.first_name || ""}`.trim() || row.login;
          const avatarUri = resolveMediaUrl(row.avatar_url);

          return (
            <AppCard key={`student-card-${row.id}`}>
              <View style={styles.profileHeadRow}>
                <View style={[styles.avatarThumbWrap, { borderColor: theme.colors.border, backgroundColor: theme.colors.rowAlt }]}>
                  {avatarUri ? (
                    <Image source={{ uri: avatarUri }} style={styles.avatarThumbImage} resizeMode="cover" />
                  ) : (
                    <Text style={[styles.avatarThumbFallback, { color: theme.colors.text, fontFamily: theme.fonts.bold }]}>
                      {String(title || "S").slice(0, 1).toUpperCase()}
                    </Text>
                  )}
                </View>
                <View style={styles.profileHeadMeta}>
                  <Text style={[styles.cardTitle, { color: theme.colors.text, fontFamily: theme.fonts.bold }]}>{title}</Text>
                  <Text style={[styles.cardMeta, { color: theme.colors.textMuted, fontFamily: theme.fonts.regular }]}>@{row.login}</Text>
                </View>
              </View>
              <Text style={[styles.cardMeta, { color: theme.colors.text, fontFamily: theme.fonts.medium }]}>
                {t("groupName")}: {row.group_name || row.group_id || "-"}
              </Text>
              <Text style={[styles.cardMeta, { color: theme.colors.text, fontFamily: theme.fonts.regular }]}>
                {t("studentId")}: {row.student_code || extractStudentCode(row.login) || row.id}
              </Text>
              <Text style={[styles.cardMeta, { color: theme.colors.text, fontFamily: theme.fonts.regular }]}>
                {t("admissionYear")}: {row.group_admission_year || "-"}
              </Text>
              <Text style={[styles.cardMeta, { color: theme.colors.text, fontFamily: theme.fonts.regular }]}>
                {t("course")}: {calculateCourse(row.group_admission_year)}
              </Text>
              <Text style={[styles.cardMeta, { color: theme.colors.text, fontFamily: theme.fonts.regular }]}>
                {t("birthDate")}: {row.birth_date || "-"}
              </Text>

              {!isEditing ? (
                <View style={styles.cardActions}>
                  <AppButton
                    title={t("openProfile")}
                    onPress={() => navigation.navigate("StudentProfileAdmin", { studentId: row.id })}
                    variant="ghost"
                    style={styles.inlineButton}
                  />
                  <AppButton title={t("edit")} onPress={() => startEditStudent(row)} variant="ghost" style={styles.inlineButton} />
                  <AppButton title={t("delete")} onPress={() => onDeleteUser(row.id)} variant="ghost" style={styles.inlineButton} />
                </View>
              ) : (
                <>
                  <AppInput label={t("lastName")} value={editingStudentLastName} onChangeText={setEditingStudentLastName} />
                  <AppInput label={t("firstName")} value={editingStudentFirstName} onChangeText={setEditingStudentFirstName} />
                  <AppInput label={t("middleName")} value={editingStudentMiddleName} onChangeText={setEditingStudentMiddleName} />
                  <AppInput
                    label={t("customLogin")}
                    value={editingStudentLogin}
                    onChangeText={setEditingStudentLogin}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />

                  <Text style={[styles.inputLabel, { color: theme.colors.text, fontFamily: theme.fonts.medium }]}>{t("groupName")}</Text>
                  <View style={styles.selectorWrap}>
                    {groups.map((group) => (
                      <AppButton
                        key={`edit-student-group-${group.id}`}
                        title={group.name}
                        variant={Number(editingStudentGroupId) === Number(group.id) ? "primary" : "ghost"}
                        onPress={() => setEditingStudentGroupId(String(group.id))}
                        style={styles.selectorBtn}
                      />
                    ))}
                  </View>

                  <AppInput
                    label={t("newPassword")}
                    value={editingStudentPassword}
                    onChangeText={setEditingStudentPassword}
                    secureTextEntry={!showEditingStudentPassword}
                    rightElement={renderPasswordToggle(showEditingStudentPassword, () => setShowEditingStudentPassword((prev) => !prev))}
                  />
                  <BirthDateField
                    label={t("birthDate")}
                    value={editingStudentBirthDate}
                    onChangeText={setEditingStudentBirthDate}
                    maximumDate={new Date()}
                  />

                  <View style={styles.cardActions}>
                    <AppButton title={t("save")} onPress={saveEditStudent} style={styles.inlineButton} />
                    <AppButton title={t("cancel")} onPress={cancelEditStudent} variant="ghost" style={styles.inlineButton} />
                    <AppButton title={t("delete")} onPress={() => onDeleteUser(row.id)} variant="ghost" style={styles.inlineButton} />
                  </View>
                </>
              )}
            </AppCard>
          );
        })}
      </View>
    );
  };

  const renderGroupsTab = () => (
    <>
      <AppCard>
        <Text style={[styles.sectionTitle, { color: theme.colors.text, fontFamily: theme.fonts.bold }]}>{t("usersTabsGroups")}</Text>
        <AppInput label={t("groupName")} value={groupName} onChangeText={setGroupName} placeholder="pcs-1-23" />
        <AppInput
          label={t("admissionYear")}
          value={groupYear}
          onChangeText={setGroupYear}
          keyboardType="numeric"
          placeholder="2023"
        />
        <AppInput label={t("specialty")} value={groupSpecialty} onChangeText={setGroupSpecialty} />
        <AppButton title={t("create")} onPress={onCreateGroup} />
      </AppCard>

      <AppCard>
        <Text style={[styles.sectionTitle, { color: theme.colors.text, fontFamily: theme.fonts.bold }]}>
          {t("edit")} {t("course")}
        </Text>
        <Text style={[styles.inputLabel, { color: theme.colors.text, fontFamily: theme.fonts.medium }]}>{t("groupName")}</Text>
        <View style={styles.selectorWrap}>
          {groups.map((group) => (
            <AppButton
              key={`course-group-${group.id}`}
              title={group.name}
              variant={Number(groupCourseTargetId) === Number(group.id) ? "primary" : "ghost"}
              onPress={() => setGroupCourseTargetId(String(group.id))}
              style={styles.selectorBtn}
            />
          ))}
        </View>
        <AppInput
          label={t("course")}
          value={groupCourseValue}
          onChangeText={setGroupCourseValue}
          keyboardType="numeric"
          placeholder="1-6"
        />
        <AppButton title={t("save")} onPress={onUpdateGroupCourse} />
      </AppCard>
      <DataTable columns={groupColumns} rows={groups} emptyText={t("noData")} />
    </>
  );

  const renderTeachersTab = () => (
    <>
      <AppCard>
        <Text style={[styles.sectionTitle, { color: theme.colors.text, fontFamily: theme.fonts.bold }]}>{t("usersTabsTeachers")}</Text>
        <AppInput label={t("lastName")} value={teacherLastName} onChangeText={setTeacherLastName} />
        <AppInput label={t("firstName")} value={teacherFirstName} onChangeText={setTeacherFirstName} />
        <AppInput label={t("middleName")} value={teacherMiddleName} onChangeText={setTeacherMiddleName} />
        <AppInput
          label={t("customLogin")}
          value={teacherLogin}
          onChangeText={setTeacherLogin}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder={t("userLoginPlaceholder")}
        />
        <AppInput
          label={t("subjects")}
          value={teacherSubjects}
          onChangeText={setTeacherSubjects}
          placeholder={t("subjectsCsvHint")}
        />
        <AppInput
          label={t("biography")}
          value={teacherBiography}
          onChangeText={setTeacherBiography}
          multiline
          inputStyle={styles.bioInput}
          placeholder={t("biographyPlaceholder")}
        />
        <BirthDateField
          label={t("birthDate")}
          value={teacherBirthDate}
          onChangeText={setTeacherBirthDate}
          maximumDate={new Date()}
        />
        <AppInput
          label={t("passwordMin4")}
          value={teacherPassword}
          onChangeText={setTeacherPassword}
          secureTextEntry={!showTeacherPassword}
          rightElement={renderPasswordToggle(showTeacherPassword, () => setShowTeacherPassword((prev) => !prev))}
        />
        <AppButton title={t("create")} onPress={onCreateTeacher} />
      </AppCard>

      {renderTeacherCards()}
    </>
  );

  const renderStudentsTab = () => (
    <>
      <AppCard>
        <Text style={[styles.sectionTitle, { color: theme.colors.text, fontFamily: theme.fonts.bold }]}>{t("usersTabsStudents")}</Text>
        <AppInput label={t("lastName")} value={studentLastName} onChangeText={setStudentLastName} />
        <AppInput label={t("firstName")} value={studentFirstName} onChangeText={setStudentFirstName} />
        <AppInput label={t("middleName")} value={studentMiddleName} onChangeText={setStudentMiddleName} />
        <AppInput
          label={t("biography")}
          value={studentBiography}
          onChangeText={setStudentBiography}
          multiline
          inputStyle={styles.bioInput}
          placeholder={t("biographyPlaceholder")}
        />
        <BirthDateField
          label={t("birthDate")}
          value={studentBirthDate}
          onChangeText={setStudentBirthDate}
          maximumDate={new Date()}
        />

        <Text style={[styles.inputLabel, { color: theme.colors.text, fontFamily: theme.fonts.medium }]}>{t("groupName")}</Text>
        <View style={styles.selectorWrap}>
          {groups.map((group) => (
            <AppButton
              key={String(group.id)}
              title={`${group.name}`}
              variant={Number(studentGroupId) === Number(group.id) ? "primary" : "ghost"}
              onPress={() => setStudentGroupId(String(group.id))}
              style={styles.selectorBtn}
            />
          ))}
        </View>

        <Text style={[styles.helperText, { color: theme.colors.textMuted, fontFamily: theme.fonts.regular }]}>{t("studentPasswordAutoHint")}</Text>
        <AppButton title={t("create")} onPress={onCreateStudent} />
      </AppCard>

      {createdStudentCredentials ? (
        <AppCard style={styles.generatedCard}>
          <Text style={[styles.generatedTitle, { color: theme.colors.text, fontFamily: theme.fonts.bold }]}>{t("generatedCredentials")}</Text>
          <Text style={[styles.generatedLine, { color: theme.colors.text, fontFamily: theme.fonts.medium }]}>
            {t("loginLabel")}: {createdStudentCredentials.login}
          </Text>
          <Text style={[styles.generatedLine, { color: theme.colors.text, fontFamily: theme.fonts.medium }]}>
            {t("generatedPassword")}: {createdStudentCredentials.initialPassword}
          </Text>
        </AppCard>
      ) : null}

      {renderStudentCards()}
    </>
  );

  const renderBindingsTab = () => (
    <>
      <AppCard>
        <Text style={[styles.sectionTitle, { color: theme.colors.text, fontFamily: theme.fonts.bold }]}>{t("usersTabsBindings")}</Text>

        <Text style={[styles.inputLabel, { color: theme.colors.text, fontFamily: theme.fonts.medium }]}>{t("teacher")}</Text>
        <View style={styles.selectorWrap}>
          {teachers.map((teacher) => (
            <AppButton
              key={String(teacher.id)}
              title={`${teacher.last_name} ${teacher.first_name}`.trim() || teacher.login}
              variant={Number(bindingTeacherId) === Number(teacher.id) ? "primary" : "ghost"}
              onPress={() => {
                setBindingTeacherId(String(teacher.id));
                setBindingSubject((teacher.subjects || [])[0] || "");
              }}
              style={styles.selectorBtn}
            />
          ))}
        </View>

        <Text style={[styles.inputLabel, { color: theme.colors.text, fontFamily: theme.fonts.medium }]}>{t("groupName")}</Text>
        <View style={styles.selectorWrap}>
          {groups.map((group) => (
            <AppButton
              key={String(group.id)}
              title={group.name}
              variant={Number(bindingGroupId) === Number(group.id) ? "primary" : "ghost"}
              onPress={() => setBindingGroupId(String(group.id))}
              style={styles.selectorBtn}
            />
          ))}
        </View>

        <Text style={[styles.inputLabel, { color: theme.colors.text, fontFamily: theme.fonts.medium }]}>{t("subject")}</Text>
        <View style={styles.selectorWrap}>
          {(selectedTeacher?.subjects || []).map((subject) => (
            <AppButton
              key={subject}
              title={subject}
              variant={bindingSubject === subject ? "primary" : "ghost"}
              onPress={() => setBindingSubject(subject)}
              style={styles.selectorBtn}
            />
          ))}
        </View>
        {!selectedTeacher ? (
          <Text style={[styles.helperText, { color: theme.colors.textMuted, fontFamily: theme.fonts.regular }]}>{t("selectTeacherFirst")}</Text>
        ) : null}
        {selectedTeacher && !(selectedTeacher.subjects || []).length ? (
          <Text style={[styles.helperText, { color: theme.colors.textMuted, fontFamily: theme.fonts.regular }]}>{t("teacherHasNoSubjects")}</Text>
        ) : null}

        <AppButton title={t("create")} onPress={onCreateBinding} />
      </AppCard>

      <DataTable columns={bindingColumns} rows={bindings} emptyText={t("noData")} />

      <AppCard>
        <Text style={[styles.sectionTitle, { color: theme.colors.text, fontFamily: theme.fonts.bold }]}>{t("visualBindings")}</Text>
        {!bindings.length ? (
          <Text style={[styles.helperText, { color: theme.colors.textMuted, fontFamily: theme.fonts.regular }]}>{t("noData")}</Text>
        ) : (
          <View style={styles.bindingGraphWrap}>
            {bindings.map((row) => (
              <View
                key={`binding-visual-${row.id}`}
                style={[styles.bindingGraphRow, { borderColor: theme.colors.border, backgroundColor: theme.colors.background }]}
              >
                <View style={[styles.bindingNode, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}>
                  <Text style={[styles.bindingPrimary, { color: theme.colors.text, fontFamily: theme.fonts.medium }]}>{row.teacher_name || row.teacher_login}</Text>
                  <Text style={[styles.bindingSecondary, { color: theme.colors.textMuted, fontFamily: theme.fonts.regular }]}>{row.teacher_login}</Text>
                </View>
                <Text style={[styles.arrow, { color: theme.colors.text }]}>→</Text>
                <View style={[styles.bindingNodeSmall, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}>
                  <Text style={[styles.bindingPrimary, { color: theme.colors.text, fontFamily: theme.fonts.medium }]}>{row.subject}</Text>
                </View>
                <Text style={[styles.arrow, { color: theme.colors.text }]}>→</Text>
                <View style={[styles.bindingNode, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}>
                  <Text style={[styles.bindingPrimary, { color: theme.colors.text, fontFamily: theme.fonts.medium }]}>{row.group_name}</Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </AppCard>
    </>
  );

  return (
    <ScreenLayout onRefresh={loadAll} refreshing={loading}>
      <View style={styles.headRow}>
        {Platform.OS === "web" ? <Text style={[styles.title, { color: theme.colors.text, fontFamily: theme.fonts.bold }]}>{t("users")}</Text> : null}
      </View>

      {renderTabs()}

      <Text style={[styles.status, { color: theme.colors.textMuted }]}>{loading ? t("loading") : " "}</Text>

      {activeTab === "groups" ? renderGroupsTab() : null}
      {activeTab === "teachers" ? renderTeachersTab() : null}
      {activeTab === "students" ? renderStudentsTab() : null}
      {activeTab === "bindings" ? renderBindingsTab() : null}
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  headRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
    gap: 10,
  },
  title: {
    fontSize: 22,
  },
  tabsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 10,
  },
  tabBtn: {
    minHeight: 36,
  },
  sectionTitle: {
    fontSize: 17,
    marginBottom: 12,
  },
  helperText: {
    fontSize: 12,
    marginBottom: 10,
  },
  generatedCard: {
    borderStyle: "dashed",
  },
  generatedTitle: {
    fontSize: 15,
    marginBottom: 8,
  },
  generatedLine: {
    fontSize: 14,
    marginBottom: 4,
  },
  inputLabel: {
    fontSize: 13,
    marginBottom: 6,
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
  inlineButton: {
    minHeight: 32,
    paddingHorizontal: 10,
  },
  status: {
    fontSize: 12,
    marginBottom: 8,
    fontFamily: "serif",
  },
  cardsWrap: {
    gap: 8,
  },
  cardTitle: {
    fontSize: 16,
    marginBottom: 4,
  },
  profileHeadRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 6,
  },
  profileHeadMeta: {
    flex: 1,
  },
  avatarThumbWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarThumbImage: {
    width: "100%",
    height: "100%",
  },
  avatarThumbFallback: {
    fontSize: 16,
  },
  cardMeta: {
    fontSize: 13,
    marginBottom: 4,
  },
  bioInput: {
    minHeight: 96,
    textAlignVertical: "top",
  },
  cardActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 8,
  },
  eyeIcon: {
    fontSize: 18,
    lineHeight: 20,
  },
  bindingGraphWrap: {
    gap: 8,
  },
  bindingGraphRow: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
  },
  bindingNode: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    minWidth: 118,
  },
  bindingNodeSmall: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    minWidth: 90,
  },
  bindingPrimary: {
    fontSize: 13,
  },
  bindingSecondary: {
    fontSize: 11,
    marginTop: 2,
  },
  arrow: {
    fontSize: 16,
  },
});
