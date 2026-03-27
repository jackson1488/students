/**
 * Module: app/screens/ScheduleScreen.js
 *
 * Purpose:
 * - Screen module for ScheduleScreen. Handles state, data loading, and UI for this route.
 *
 * Module notes:
 * - Imports count: 13.
 * - This header is written for beginners: read purpose first, then function map below.
 *
 * Function map:
 * - ScheduleScreen: Main React component or UI container exported by this file.
 * - getTodayScheduleDay: Returns computed or fetched data for caller usage.
 * - normalizeDayValue: Transforms input/output values to stable display or API format.
 * - onCreateSchedule: Callback function invoked by UI or navigation events.
 * - onUpdateSchedule: Callback function invoked by UI or navigation events.
 * - onDeleteEntry: Callback function invoked by UI or navigation events.
 * - onExport: Callback function invoked by UI or navigation events.
 * - resetCreateForm: Helper function used by this module business logic.
 * - resetEditor: Helper function used by this module business logic.
 * - onEditEntry: Callback function invoked by UI or navigation events.
 * - match: Helper function used by this module business logic.
 * - availableCreateTeachers: Helper function used by this module business logic.
 * - availableEditTeachers: Helper function used by this module business logic.
 * - rowsByDay: Helper function used by this module business logic.
 * - visibleDays: Helper function used by this module business logic.
 * - hasSaturday: Helper function used by this module business logic.
 * - loadGroups: Loads remote/local data and updates screen/component state.
 * - editGroup: Helper function used by this module business logic.
 * - onLoadSchedule: Callback function invoked by UI or navigation events.
 * - group: Helper function used by this module business logic.
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Platform, ScrollView, StyleSheet, Text, View } from "react-native";

import AppButton from "../components/AppButton";
import AppCard from "../components/AppCard";
import AppInput from "../components/AppInput";
import OverflowMenu from "../components/OverflowMenu";
import ScreenLayout from "../components/ScreenLayout";
import { useAuth } from "../hooks/AuthContext";
import { useI18n } from "../hooks/I18nContext";
import { useThemeMode } from "../hooks/ThemeContext";
import { fetchBindings, fetchGroups } from "../services/academyService";
import { openExportDocument } from "../services/exportService";
import {
  createScheduleEntry,
  deleteScheduleEntry,
  fetchScheduleByGroup,
  updateScheduleEntry,
} from "../services/scheduleService";

const DAY_VALUES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DAY_LABEL_KEYS = {
  Monday: "dayMonday",
  Tuesday: "dayTuesday",
  Wednesday: "dayWednesday",
  Thursday: "dayThursday",
  Friday: "dayFriday",
  Saturday: "daySaturday",
};

function getTodayScheduleDay() {
  const dayIndex = new Date().getDay();
  if (dayIndex === 1) return "Monday";
  if (dayIndex === 2) return "Tuesday";
  if (dayIndex === 3) return "Wednesday";
  if (dayIndex === 4) return "Thursday";
  if (dayIndex === 5) return "Friday";
  if (dayIndex === 6) return "Saturday";
  return "Monday";
}

function normalizeDayValue(day) {
  const value = String(day || "").trim().toLowerCase();
  const match = DAY_VALUES.find((item) => item.toLowerCase() === value);
  return match || String(day || "").trim();
}

export default function ScheduleScreen() {
  const { role, groupId: currentGroupId, token } = useAuth();
  const { t, language } = useI18n();
  const { theme } = useThemeMode();

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  const [groups, setGroups] = useState([]);
  const [createGroupBindings, setCreateGroupBindings] = useState([]);
  const [editGroupBindings, setEditGroupBindings] = useState([]);

  const [createGroupRef, setCreateGroupRef] = useState("");
  const [createTeacherId, setCreateTeacherId] = useState("");
  const [createDayOfWeek, setCreateDayOfWeek] = useState(getTodayScheduleDay());
  const [createStartTime, setCreateStartTime] = useState("");
  const [createEndTime, setCreateEndTime] = useState("");
  const [createSubject, setCreateSubject] = useState("");
  const [createRoom, setCreateRoom] = useState("");

  const [viewGroupRef, setViewGroupRef] = useState("");
  const [editingEntryId, setEditingEntryId] = useState(null);
  const [editGroupRef, setEditGroupRef] = useState("");
  const [editTeacherId, setEditTeacherId] = useState("");
  const [editDayOfWeek, setEditDayOfWeek] = useState(getTodayScheduleDay());
  const [editStartTime, setEditStartTime] = useState("");
  const [editEndTime, setEditEndTime] = useState("");
  const [editSubject, setEditSubject] = useState("");
  const [editRoom, setEditRoom] = useState("");
  const [selectedDay, setSelectedDay] = useState(getTodayScheduleDay());

  const canManageSchedule = role === "scheduler" || role === "admin";
  const isStudent = role === "student";

  const selectedCreateGroup = useMemo(
    () => groups.find((item) => Number(item.id) === Number(createGroupRef)),
    [createGroupRef, groups]
  );

  const selectedViewGroup = useMemo(
    () => groups.find((item) => Number(item.id) === Number(viewGroupRef)),
    [groups, viewGroupRef]
  );

  const availableCreateTeachers = useMemo(() => {
    const map = new Map();
    createGroupBindings.forEach((row) => {
      if (!map.has(row.teacher_id)) {
        map.set(row.teacher_id, row.teacher_name || row.teacher_login || String(row.teacher_id));
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id: Number(id), name }));
  }, [createGroupBindings]);

  const availableCreateSubjects = useMemo(
    () =>
      createGroupBindings
        .filter((row) => Number(row.teacher_id) === Number(createTeacherId))
        .map((row) => row.subject),
    [createTeacherId, createGroupBindings]
  );

  const availableEditTeachers = useMemo(() => {
    const map = new Map();
    editGroupBindings.forEach((row) => {
      if (!map.has(row.teacher_id)) {
        map.set(row.teacher_id, row.teacher_name || row.teacher_login || String(row.teacher_id));
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id: Number(id), name }));
  }, [editGroupBindings]);

  const availableEditSubjects = useMemo(
    () =>
      editGroupBindings
        .filter((row) => Number(row.teacher_id) === Number(editTeacherId))
        .map((row) => row.subject),
    [editTeacherId, editGroupBindings]
  );

  const rowsByDay = useMemo(() => {
    const base = {};
    DAY_VALUES.forEach((day) => {
      base[day] = [];
    });

    rows.forEach((row) => {
      const key = normalizeDayValue(row.day_of_week);
      if (!base[key]) {
        base[key] = [];
      }
      base[key].push(row);
    });

    Object.keys(base).forEach((day) => {
      base[day].sort((a, b) => String(a.start_time || "").localeCompare(String(b.start_time || "")));
    });

    return base;
  }, [rows]);

  const visibleDays = useMemo(() => {
    const hasSaturday = rows.some((row) => normalizeDayValue(row.day_of_week) === "Saturday");
    return hasSaturday ? DAY_VALUES : DAY_VALUES.slice(0, 5);
  }, [rows]);

  useEffect(() => {
    if (!visibleDays.length) {
      return;
    }
    if (!visibleDays.includes(selectedDay)) {
      const today = getTodayScheduleDay();
      setSelectedDay(visibleDays.includes(today) ? today : visibleDays[0]);
    }
  }, [selectedDay, visibleDays]);

  const resetCreateForm = () => {
    setCreateTeacherId("");
    setCreateDayOfWeek(getTodayScheduleDay());
    setCreateStartTime("");
    setCreateEndTime("");
    setCreateSubject("");
    setCreateRoom("");
  };

  const resetEditor = () => {
    setEditingEntryId(null);
    setEditGroupRef("");
    setEditTeacherId("");
    setEditDayOfWeek(getTodayScheduleDay());
    setEditStartTime("");
    setEditEndTime("");
    setEditSubject("");
    setEditRoom("");
    setEditGroupBindings([]);
  };

  const loadGroups = useCallback(async () => {
    if (isStudent) {
      return;
    }

    const data = await fetchGroups();
    const list = Array.isArray(data) ? data : [];
    setGroups(list);

    if (!list.length) {
      setViewGroupRef("");
      setCreateGroupRef("");
      return;
    }

    if (!viewGroupRef || !list.find((item) => Number(item.id) === Number(viewGroupRef))) {
      setViewGroupRef(String(list[0].id));
    }

    if (canManageSchedule && (!createGroupRef || !list.find((item) => Number(item.id) === Number(createGroupRef)))) {
      setCreateGroupRef(String(list[0].id));
    }
  }, [canManageSchedule, createGroupRef, isStudent, viewGroupRef]);

  const loadBindingsForGroup = useCallback(
    async (groupNumericId, targetSetter) => {
      if (!groupNumericId) {
        targetSetter([]);
        return;
      }

      try {
        const data = await fetchBindings({ group_id: groupNumericId });
        targetSetter(Array.isArray(data) ? data : []);
      } catch (error) {
        Alert.alert(t("schedule"), error?.response?.data?.error || t("unknownError"));
      }
    },
    [t]
  );

  const loadScheduleByGroup = useCallback(
    async (groupName) => {
      const targetGroupName = String(groupName || "").trim();
      if (!targetGroupName) {
        setRows([]);
        return;
      }

      setLoading(true);
      try {
        const data = await fetchScheduleByGroup(targetGroupName);
        setRows(Array.isArray(data) ? data : []);
      } catch (error) {
        Alert.alert(t("schedule"), error?.response?.data?.error || t("unknownError"));
      } finally {
        setLoading(false);
      }
    },
    [t]
  );

  useEffect(() => {
    loadGroups().catch((error) => {
      Alert.alert(t("schedule"), error?.response?.data?.error || t("unknownError"));
    });
  }, [loadGroups, t]);

  useEffect(() => {
    if (!canManageSchedule || !createGroupRef) {
      return;
    }
    loadBindingsForGroup(Number(createGroupRef), setCreateGroupBindings);
  }, [canManageSchedule, createGroupRef, loadBindingsForGroup]);

  useEffect(() => {
    if (!canManageSchedule || !editingEntryId || !editGroupRef) {
      return;
    }
    loadBindingsForGroup(Number(editGroupRef), setEditGroupBindings);
  }, [canManageSchedule, editGroupRef, editingEntryId, loadBindingsForGroup]);

  useEffect(() => {
    if (!isStudent || !currentGroupId) {
      return;
    }
    loadScheduleByGroup(currentGroupId);
  }, [currentGroupId, isStudent, loadScheduleByGroup]);

  useEffect(() => {
    if (isStudent || !selectedViewGroup?.name) {
      return;
    }
    loadScheduleByGroup(selectedViewGroup.name);
  }, [isStudent, loadScheduleByGroup, selectedViewGroup?.name]);

  const onCreateSchedule = async () => {
    if (
      !selectedCreateGroup ||
      !createTeacherId ||
      !createDayOfWeek.trim() ||
      !createStartTime.trim() ||
      !createEndTime.trim() ||
      !createSubject.trim()
    ) {
      return;
    }

    const payload = {
      group_id: selectedCreateGroup.name,
      teacher_id: Number(createTeacherId),
      day_of_week: createDayOfWeek.trim(),
      start_time: createStartTime.trim(),
      end_time: createEndTime.trim(),
      subject: createSubject.trim(),
      room: createRoom.trim() || undefined,
    };

    try {
      await createScheduleEntry(payload);
      resetCreateForm();

      if (selectedViewGroup?.name) {
        await loadScheduleByGroup(selectedViewGroup.name);
      } else if (isStudent && currentGroupId) {
        await loadScheduleByGroup(currentGroupId);
      }
    } catch (error) {
      Alert.alert(t("schedule"), error?.response?.data?.error || t("unknownError"));
    }
  };

  const onUpdateSchedule = async () => {
    if (
      !editingEntryId ||
      !editGroupRef ||
      !editTeacherId ||
      !editDayOfWeek.trim() ||
      !editStartTime.trim() ||
      !editEndTime.trim() ||
      !editSubject.trim()
    ) {
      return;
    }

    const editGroup = groups.find((item) => Number(item.id) === Number(editGroupRef));
    if (!editGroup) {
      return;
    }

    const payload = {
      group_id: editGroup.name,
      teacher_id: Number(editTeacherId),
      day_of_week: editDayOfWeek.trim(),
      start_time: editStartTime.trim(),
      end_time: editEndTime.trim(),
      subject: editSubject.trim(),
      room: editRoom.trim() || undefined,
    };

    try {
      await updateScheduleEntry(Number(editingEntryId), payload);
      resetEditor();
      await onLoadSchedule();
    } catch (error) {
      Alert.alert(t("schedule"), error?.response?.data?.error || t("unknownError"));
    }
  };

  const onLoadSchedule = useCallback(async () => {
    if (isStudent) {
      if (currentGroupId) {
        await loadScheduleByGroup(currentGroupId);
      }
      return;
    }

    if (!selectedViewGroup?.name) {
      return;
    }

    await loadScheduleByGroup(selectedViewGroup.name);
  }, [currentGroupId, isStudent, loadScheduleByGroup, selectedViewGroup?.name]);

  const onEditEntry = (row) => {
    const group = groups.find((item) => item.name === row.group_id);
    const groupRef = group ? String(group.id) : "";

    setEditGroupRef(groupRef);
    setEditTeacherId(row.teacher_id ? String(row.teacher_id) : "");
    setEditDayOfWeek(normalizeDayValue(row.day_of_week));
    setEditStartTime(String(row.start_time || ""));
    setEditEndTime(String(row.end_time || ""));
    setEditSubject(String(row.subject || ""));
    setEditRoom(String(row.room || ""));
    setEditingEntryId(row.id);

    if (groupRef) {
      loadBindingsForGroup(Number(groupRef), setEditGroupBindings);
    } else {
      setEditGroupBindings([]);
    }
  };

  const onDeleteEntry = async (entryId) => {
    try {
      await deleteScheduleEntry(Number(entryId));
      await onLoadSchedule();
      if (Number(editingEntryId) === Number(entryId)) {
        resetEditor();
      }
    } catch (error) {
      Alert.alert(t("schedule"), error?.response?.data?.error || t("unknownError"));
    }
  };

  const onExport = async (format) => {
    const groupName = isStudent ? currentGroupId : selectedViewGroup?.name;
    if (!groupName) {
      Alert.alert(t("schedule"), t("selectGroupForExport"));
      return;
    }

    try {
      await openExportDocument({
        entity: "schedule",
        target: String(groupName),
        format,
        token,
        language,
      });
    } catch {
      Alert.alert(t("schedule"), t("unknownError"));
    }
  };

  const activeRows = rowsByDay[selectedDay] || [];

  return (
    <ScreenLayout onRefresh={onLoadSchedule} refreshing={loading}>
      {Platform.OS === "web" ? (
        <Text style={[styles.title, { color: theme.colors.text, fontFamily: theme.fonts.bold }]}> 
          {t("schedule")}
        </Text>
      ) : null}

      {canManageSchedule ? (
        <>
          <AppCard>
            <Text style={[styles.sectionTitle, { color: theme.colors.text, fontFamily: theme.fonts.bold }]}> 
              {t("createSchedule")}
            </Text>

            <Text style={[styles.inputLabel, { color: theme.colors.text, fontFamily: theme.fonts.medium }]}> 
              {t("group")}
            </Text>
            <View style={styles.selectorWrap}>
              {groups.map((group) => (
                <AppButton
                  key={`create-group-${group.id}`}
                  title={group.name}
                  variant={Number(createGroupRef) === Number(group.id) ? "primary" : "ghost"}
                  onPress={() => {
                    setCreateGroupRef(String(group.id));
                    setCreateTeacherId("");
                    setCreateSubject("");
                  }}
                  style={styles.selectorBtn}
                />
              ))}
            </View>

            <Text style={[styles.inputLabel, { color: theme.colors.text, fontFamily: theme.fonts.medium }]}> 
              {t("teacher")}
            </Text>
            <View style={styles.selectorWrap}>
              {availableCreateTeachers.map((teacher) => (
                <AppButton
                  key={`create-teacher-${teacher.id}`}
                  title={teacher.name}
                  variant={Number(createTeacherId) === Number(teacher.id) ? "primary" : "ghost"}
                  onPress={() => {
                    setCreateTeacherId(String(teacher.id));
                    setCreateSubject("");
                  }}
                  style={styles.selectorBtn}
                />
              ))}
            </View>

            <Text style={[styles.inputLabel, { color: theme.colors.text, fontFamily: theme.fonts.medium }]}> 
              {t("subject")}
            </Text>
            <View style={styles.selectorWrap}>
              {availableCreateSubjects.map((value) => (
                <AppButton
                  key={`create-subject-${value}`}
                  title={value}
                  variant={createSubject === value ? "primary" : "ghost"}
                  onPress={() => setCreateSubject(value)}
                  style={styles.selectorBtn}
                />
              ))}
            </View>

            <Text style={[styles.inputLabel, { color: theme.colors.text, fontFamily: theme.fonts.medium }]}> 
              {t("dayOfWeek")}
            </Text>
            <View style={styles.selectorWrap}>
              {DAY_VALUES.map((value) => (
                <AppButton
                  key={`create-day-${value}`}
                  title={t(DAY_LABEL_KEYS[value])}
                  variant={createDayOfWeek === value ? "primary" : "ghost"}
                  onPress={() => setCreateDayOfWeek(value)}
                  style={styles.selectorBtn}
                />
              ))}
            </View>

            <AppInput label={t("startTime")} value={createStartTime} onChangeText={setCreateStartTime} placeholder="09:00" />
            <AppInput label={t("endTime")} value={createEndTime} onChangeText={setCreateEndTime} placeholder="10:30" />
            <AppInput label={t("room")} value={createRoom} onChangeText={setCreateRoom} />

            <View style={styles.actionRow}>
              <AppButton title={t("create")} onPress={onCreateSchedule} />
              <AppButton title={t("cancel")} onPress={resetCreateForm} variant="ghost" />
            </View>
          </AppCard>

          <AppCard>
            <Text style={[styles.sectionTitle, { color: theme.colors.text, fontFamily: theme.fonts.bold }]}> 
              {t("editSchedule")}
            </Text>

            {editingEntryId ? (
              <>
                <Text style={[styles.inputLabel, { color: theme.colors.text, fontFamily: theme.fonts.medium }]}> 
                  {t("group")}
                </Text>
                <View style={styles.selectorWrap}>
                  {groups.map((group) => (
                    <AppButton
                      key={`edit-group-${group.id}`}
                      title={group.name}
                      variant={Number(editGroupRef) === Number(group.id) ? "primary" : "ghost"}
                      onPress={() => {
                        setEditGroupRef(String(group.id));
                        setEditTeacherId("");
                        setEditSubject("");
                      }}
                      style={styles.selectorBtn}
                    />
                  ))}
                </View>

                <Text style={[styles.inputLabel, { color: theme.colors.text, fontFamily: theme.fonts.medium }]}> 
                  {t("teacher")}
                </Text>
                <View style={styles.selectorWrap}>
                  {availableEditTeachers.map((teacher) => (
                    <AppButton
                      key={`edit-teacher-${teacher.id}`}
                      title={teacher.name}
                      variant={Number(editTeacherId) === Number(teacher.id) ? "primary" : "ghost"}
                      onPress={() => {
                        setEditTeacherId(String(teacher.id));
                        setEditSubject("");
                      }}
                      style={styles.selectorBtn}
                    />
                  ))}
                </View>

                <Text style={[styles.inputLabel, { color: theme.colors.text, fontFamily: theme.fonts.medium }]}> 
                  {t("subject")}
                </Text>
                <View style={styles.selectorWrap}>
                  {availableEditSubjects.map((value) => (
                    <AppButton
                      key={`edit-subject-${value}`}
                      title={value}
                      variant={editSubject === value ? "primary" : "ghost"}
                      onPress={() => setEditSubject(value)}
                      style={styles.selectorBtn}
                    />
                  ))}
                </View>

                <Text style={[styles.inputLabel, { color: theme.colors.text, fontFamily: theme.fonts.medium }]}> 
                  {t("dayOfWeek")}
                </Text>
                <View style={styles.selectorWrap}>
                  {DAY_VALUES.map((value) => (
                    <AppButton
                      key={`edit-day-${value}`}
                      title={t(DAY_LABEL_KEYS[value])}
                      variant={editDayOfWeek === value ? "primary" : "ghost"}
                      onPress={() => setEditDayOfWeek(value)}
                      style={styles.selectorBtn}
                    />
                  ))}
                </View>

                <AppInput label={t("startTime")} value={editStartTime} onChangeText={setEditStartTime} placeholder="09:00" />
                <AppInput label={t("endTime")} value={editEndTime} onChangeText={setEditEndTime} placeholder="10:30" />
                <AppInput label={t("room")} value={editRoom} onChangeText={setEditRoom} />

                <View style={styles.actionRow}>
                  <AppButton title={t("save")} onPress={onUpdateSchedule} />
                  <AppButton title={t("cancel")} onPress={resetEditor} variant="ghost" />
                </View>
              </>
            ) : (
              <Text style={[styles.lessonMeta, { color: theme.colors.textMuted, fontFamily: theme.fonts.regular }]}> 
                {t("editScheduleHint")}
              </Text>
            )}
          </AppCard>
        </>
      ) : null}

      {!isStudent ? (
        <AppCard style={styles.compactCard}>
          <View style={styles.selectorWrap}>
            {groups.map((group) => (
              <AppButton
                key={`view-group-${group.id}`}
                title={group.name}
                variant={Number(viewGroupRef) === Number(group.id) ? "primary" : "ghost"}
                onPress={() => setViewGroupRef(String(group.id))}
                style={styles.selectorBtn}
              />
            ))}
          </View>
        </AppCard>
      ) : null}

      <AppCard style={styles.compactCard}>
        <View style={styles.toolsRow}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.daysTabsWrap}
            style={styles.daysTabsScroll}
          >
            {visibleDays.map((day) => (
              <AppButton
                key={`schedule-day-tab-${day}`}
                title={t(DAY_LABEL_KEYS[day])}
                variant={selectedDay === day ? "primary" : "ghost"}
                onPress={() => setSelectedDay(day)}
                style={styles.dayTabButton}
              />
            ))}
          </ScrollView>

          <OverflowMenu
            buttonHint={t("export")}
            options={[
              { key: "schedule-html", label: t("exportHtml"), onPress: () => onExport("html") },
              { key: "schedule-pdf", label: t("exportPdf"), onPress: () => onExport("pdf") },
              { key: "schedule-xlsx", label: t("exportExcel"), onPress: () => onExport("xlsx") },
            ]}
          />
        </View>
      </AppCard>

      <Text style={[styles.meta, { color: theme.colors.textMuted }]}>{loading ? t("loading") : " "}</Text>

      <AppCard>
        {activeRows.length ? (
          activeRows.map((item) => (
            <View
              key={`schedule-item-${item.id}`}
              style={[
                styles.lessonCard,
                { borderColor: theme.colors.border, backgroundColor: theme.colors.background },
              ]}
            >
              <Text style={[styles.lessonMain, { color: theme.colors.text, fontFamily: theme.fonts.medium }]}> 
                {item.start_time} - {item.end_time} • {item.subject}
              </Text>
              <Text style={[styles.lessonMeta, { color: theme.colors.textMuted, fontFamily: theme.fonts.regular }]}> 
                {item.teacher_name || "-"} {item.room ? `• ${t("room")}: ${item.room}` : ""}
              </Text>

              {canManageSchedule ? (
                <View style={styles.entryActionRow}>
                  <AppButton title={t("edit")} onPress={() => onEditEntry(item)} variant="ghost" style={styles.smallBtn} />
                  <AppButton
                    title={t("delete")}
                    onPress={() => onDeleteEntry(item.id)}
                    variant="ghost"
                    style={styles.smallBtn}
                  />
                </View>
              ) : null}
            </View>
          ))
        ) : (
          <Text style={[styles.lessonMeta, { color: theme.colors.textMuted, fontFamily: theme.fonts.regular }]}> 
            {t("noData")}
          </Text>
        )}
      </AppCard>
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
  selectorWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 10,
  },
  selectorBtn: {
    minHeight: 34,
  },
  compactCard: {
    paddingTop: 10,
    paddingBottom: 10,
  },
  meta: {
    marginBottom: 8,
    fontSize: 12,
    fontFamily: "serif",
  },
  actionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 4,
  },
  dayTabButton: {
    minHeight: 36,
  },
  daysTabsWrap: {
    flexDirection: "row",
    gap: 8,
    paddingRight: 4,
  },
  daysTabsScroll: {
    flex: 1,
  },
  lessonCard: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  lessonMain: {
    fontSize: 14,
    marginBottom: 4,
  },
  lessonMeta: {
    fontSize: 12,
  },
  entryActionRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
  },
  smallBtn: {
    minHeight: 32,
    paddingHorizontal: 10,
  },
  toolsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 8,
  },
  toolsLabel: {
    fontSize: 14,
  },
});
