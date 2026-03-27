/**
 * Module: app/screens/ChatScreen.js
 *
 * Purpose:
 * - Screen module for ChatScreen. Handles state, data loading, and UI for this route.
 *
 * Module notes:
 * - Imports count: 12.
 * - This header is written for beginners: read purpose first, then function map below.
 *
 * Function map:
 * - ChatScreen: Main React component or UI container exported by this file.
 * - resolveMediaUrl: Builds derived values and resolves runtime decisions.
 * - initialsFromName: Helper function used by this module business logic.
 * - normalizeGroupKey: Transforms input/output values to stable display or API format.
 * - roomKey: Helper function used by this module business logic.
 * - openDirectChat: Controls modal/sheet/screen visibility or navigation transition.
 * - openGroupChat: Controls modal/sheet/screen visibility or navigation transition.
 * - openGroupFromStudent: Controls modal/sheet/screen visibility or navigation transition.
 * - openGroupFromTeacher: Controls modal/sheet/screen visibility or navigation transition.
 * - renderAvatar: Builds and returns a UI fragment for rendering.
 * - renderAdminFilters: Builds and returns a UI fragment for rendering.
 * - renderTeacherFilters: Builds and returns a UI fragment for rendering.
 * - renderContactRow: Builds and returns a UI fragment for rendering.
 * - renderRoomRow: Builds and returns a UI fragment for rendering.
 * - onRefresh: Callback function invoked by UI or navigation events.
 * - teacherGroupsById: Helper function used by this module business logic.
 * - adminGroupOptions: Helper function used by this module business logic.
 * - teacherGroupOptions: Helper function used by this module business logic.
 * - adminVisibleContacts: Helper function used by this module business logic.
 * - teacherDirectContacts: Helper function used by this module business logic.
 * - teacherVisibleRooms: Helper function used by this module business logic.
 * - studentVisibleContacts: Helper function used by this module business logic.
 * - listRows: Returns computed or fetched data for caller usage.
 * - groups: Helper function used by this module business logic.
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { FlatList, Image, Platform, ScrollView, Pressable, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";

import AppButton from "../components/AppButton";
import ScreenLayout from "../components/ScreenLayout";
import usePolling from "../hooks/usePolling";
import { useAuth } from "../hooks/AuthContext";
import { useI18n } from "../hooks/I18nContext";
import { useThemeMode } from "../hooks/ThemeContext";
import { fetchBindings } from "../services/academyService";
import { API_BASE_URL } from "../services/api";
import { fetchChatContacts, fetchGroupChatRooms } from "../services/chatService";

const GROUP_GENERAL_SUBJECT = "__general__";
const ADMIN_ROLE_TABS = ["all", "teacher", "student"];
const TEACHER_CHAT_MODES = ["direct", "group"];

function resolveMediaUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (raw.startsWith("data:")) return raw;
  if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;
  if (raw.startsWith("/")) return `${API_BASE_URL}${raw}`;
  if (/^(users|chat|support|uploads)\//i.test(raw)) {
    return `${API_BASE_URL}/${raw.replace(/^\/+/, "")}`;
  }
  return raw;
}

function initialsFromName(value) {
  const source = String(value || "").trim();
  return source ? source.slice(0, 1).toUpperCase() : "U";
}

function normalizeGroupKey(value) {
  return String(value || "").trim().toLowerCase();
}

function roomKey(room) {
  return `${String(room?.group_id || "")}-${String(room?.subject || "")}`;
}

export default function ChatScreen({ navigation }) {
  const { t } = useI18n();
  const { theme } = useThemeMode();
  const { role, groupId } = useAuth();

  const [contacts, setContacts] = useState([]);
  const [bindings, setBindings] = useState([]);
  const [groupRooms, setGroupRooms] = useState([]);

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);

  const [adminRoleFilter, setAdminRoleFilter] = useState("all");
  const [adminGroupFilter, setAdminGroupFilter] = useState("all");

  const [teacherMode, setTeacherMode] = useState("direct");
  const [teacherGroupFilter, setTeacherGroupFilter] = useState("all");

  const loadContacts = useCallback(
    async ({ showLoader = false } = {}) => {
      const shouldShowLoader = showLoader || !hasLoadedOnce;
      if (shouldShowLoader) {
        setLoading(true);
      }

      try {
        if (role === "admin") {
          const [contactsData, bindingsData] = await Promise.all([fetchChatContacts(), fetchBindings()]);
          setContacts(Array.isArray(contactsData) ? contactsData : []);
          setBindings(Array.isArray(bindingsData) ? bindingsData : []);
          setGroupRooms([]);
        } else if (role === "teacher") {
          const [contactsData, roomsData, bindingsData] = await Promise.all([
            fetchChatContacts(),
            fetchGroupChatRooms(),
            fetchBindings(),
          ]);

          setContacts(Array.isArray(contactsData) ? contactsData : []);
          setGroupRooms(Array.isArray(roomsData) ? roomsData : []);
          setBindings(Array.isArray(bindingsData) ? bindingsData : []);
        } else {
          const contactsData = await fetchChatContacts();
          setContacts(Array.isArray(contactsData) ? contactsData : []);
          setBindings([]);
          setGroupRooms([]);
        }

        setHasLoadedOnce(true);
      } catch {
        // Keep previous data to avoid UI flicker while polling.
      } finally {
        if (shouldShowLoader) {
          setLoading(false);
        }
      }
    },
    [hasLoadedOnce, role]
  );

  usePolling(() => loadContacts(), 1000, [role]);

  useFocusEffect(
    useCallback(() => {
      loadContacts();
      return undefined;
    }, [loadContacts])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadContacts({ showLoader: true });
    setRefreshing(false);
  }, [loadContacts]);

  const teacherGroupsById = useMemo(() => {
    const map = {};
    (Array.isArray(bindings) ? bindings : []).forEach((item) => {
      const teacherId = Number(item?.teacher_id || 0);
      const groupName = String(item?.group_name || "").trim();
      if (!teacherId || !groupName) return;

      if (!map[teacherId]) {
        map[teacherId] = new Set();
      }
      map[teacherId].add(groupName);
    });
    return map;
  }, [bindings]);

  const adminGroupOptions = useMemo(() => {
    const set = new Set();

    (Array.isArray(contacts) ? contacts : []).forEach((item) => {
      if (item?.role === "student" && item?.group_id) {
        set.add(String(item.group_id).trim());
      }
    });

    (Array.isArray(bindings) ? bindings : []).forEach((item) => {
      if (item?.group_name) {
        set.add(String(item.group_name).trim());
      }
    });

    return ["all", ...Array.from(set).sort((a, b) => a.localeCompare(b, "ru", { sensitivity: "base" }))];
  }, [bindings, contacts]);

  const teacherGroupOptions = useMemo(() => {
    const set = new Set();

    (Array.isArray(contacts) ? contacts : []).forEach((item) => {
      if (item?.role === "student" && item?.group_id) {
        set.add(String(item.group_id).trim());
      }
    });

    (Array.isArray(groupRooms) ? groupRooms : []).forEach((room) => {
      if (room?.group_id) {
        set.add(String(room.group_id).trim());
      }
    });

    return ["all", ...Array.from(set).sort((a, b) => a.localeCompare(b, "ru", { sensitivity: "base" }))];
  }, [contacts, groupRooms]);

  useEffect(() => {
    if (role !== "admin") return;
    if (adminGroupFilter === "all") return;
    if (!adminGroupOptions.includes(adminGroupFilter)) {
      setAdminGroupFilter("all");
    }
  }, [adminGroupFilter, adminGroupOptions, role]);

  useEffect(() => {
    if (role !== "teacher") return;
    if (teacherGroupFilter === "all") return;
    if (!teacherGroupOptions.includes(teacherGroupFilter)) {
      setTeacherGroupFilter("all");
    }
  }, [role, teacherGroupFilter, teacherGroupOptions]);

  const adminVisibleContacts = useMemo(() => {
    if (role !== "admin") return [];

    let rows = Array.isArray(contacts) ? contacts : [];

    if (adminRoleFilter !== "all") {
      rows = rows.filter((item) => item.role === adminRoleFilter);
    }

    if (adminGroupFilter !== "all") {
      const target = normalizeGroupKey(adminGroupFilter);
      rows = rows.filter((item) => {
        if (item.role === "student") {
          return normalizeGroupKey(item.group_id) === target;
        }

        if (item.role === "teacher") {
          const groups = teacherGroupsById[Number(item.id)] || new Set();
          return Array.from(groups).some((groupName) => normalizeGroupKey(groupName) === target);
        }

        return false;
      });
    }

    return [...rows].sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "ru", { sensitivity: "base" }));
  }, [adminGroupFilter, adminRoleFilter, contacts, role, teacherGroupsById]);

  const teacherDirectContacts = useMemo(() => {
    if (role !== "teacher") return [];

    let rows = (Array.isArray(contacts) ? contacts : []).filter((item) => item.role === "student");

    if (teacherGroupFilter !== "all") {
      const target = normalizeGroupKey(teacherGroupFilter);
      rows = rows.filter((item) => normalizeGroupKey(item.group_id) === target);
    }

    return [...rows].sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "ru", { sensitivity: "base" }));
  }, [contacts, role, teacherGroupFilter]);

  const teacherVisibleRooms = useMemo(() => {
    if (role !== "teacher") return [];

    let rows = Array.isArray(groupRooms) ? groupRooms : [];

    if (teacherGroupFilter !== "all") {
      const target = normalizeGroupKey(teacherGroupFilter);
      rows = rows.filter((room) => normalizeGroupKey(room.group_id) === target);
    }

    return [...rows].sort((a, b) => {
      const groupCmp = String(a.group_id || "").localeCompare(String(b.group_id || ""), "ru", { sensitivity: "base" });
      if (groupCmp !== 0) return groupCmp;
      return String(a.title || "").localeCompare(String(b.title || ""), "ru", { sensitivity: "base" });
    });
  }, [groupRooms, role, teacherGroupFilter]);

  const studentVisibleContacts = useMemo(() => {
    if (role !== "student") return [];
    return (Array.isArray(contacts) ? contacts : [])
      .filter((item) => item.role === "teacher")
      .sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "ru", { sensitivity: "base" }));
  }, [contacts, role]);

  const listRows = useMemo(() => {
    if (role === "admin") {
      return adminVisibleContacts.map((item) => ({ rowType: "contact", key: `contact-${item.id}`, payload: item }));
    }

    if (role === "teacher") {
      if (teacherMode === "group") {
        return teacherVisibleRooms.map((room) => ({ rowType: "room", key: `room-${roomKey(room)}`, payload: room }));
      }

      return teacherDirectContacts.map((item) => ({ rowType: "contact", key: `contact-${item.id}`, payload: item }));
    }

    return studentVisibleContacts.map((item) => ({ rowType: "contact", key: `contact-${item.id}`, payload: item }));
  }, [adminVisibleContacts, role, studentVisibleContacts, teacherDirectContacts, teacherMode, teacherVisibleRooms]);

  const openDirectChat = (contact) => {
    navigation.navigate("ChatThread", {
      partner: {
        id: contact.id,
        name: contact.name,
        avatar_url: contact.avatar_url,
        role: contact.role,
        group_id: contact.group_id,
      },
    });
  };

  const openGroupChat = (room) => {
    if (!room?.group_id || !room?.subject) return;

    navigation.navigate("ChatThread", {
      room: {
        group_id: room.group_id,
        subject: room.subject,
        title: room.title || `${room.group_id}`,
      },
    });
  };

  const openGroupFromStudent = (contact) => {
    if (!contact?.group_id) return;
    openGroupChat({
      group_id: contact.group_id,
      subject: GROUP_GENERAL_SUBJECT,
      title: `${contact.group_id} • ${t("groupChats")}`,
    });
  };

  const openGroupFromTeacher = (contact) => {
    const targetGroup = String(contact?.group_id || groupId || "").trim();
    if (!targetGroup) return;
    openGroupChat({
      group_id: targetGroup,
      subject: GROUP_GENERAL_SUBJECT,
      title: `${targetGroup} • ${t("groupChats")}`,
    });
  };

  const renderAvatar = (uri, fallbackName) => {
    if (uri) {
      return <Image source={{ uri }} style={styles.avatarImage} resizeMode="cover" />;
    }

    return (
      <View style={[styles.avatarFallback, { borderColor: theme.colors.border, backgroundColor: theme.colors.rowAlt }]}> 
        <Text style={{ color: theme.colors.text, fontFamily: theme.fonts.bold }}>{initialsFromName(fallbackName)}</Text>
      </View>
    );
  };

  const renderAdminFilters = () => {
    if (role !== "admin") return null;

    return (
      <View style={styles.filtersWrap}>
        <View style={styles.roleTabsRow}>
          {ADMIN_ROLE_TABS.map((tab) => {
            const title =
              tab === "all" ? t("chatFilterAll") : tab === "teacher" ? t("chatFilterTeachers") : t("chatFilterStudents");

            return (
              <AppButton
                key={tab}
                title={title}
                onPress={() => setAdminRoleFilter(tab)}
                variant={adminRoleFilter === tab ? "primary" : "ghost"}
                style={styles.filterButton}
              />
            );
          })}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.groupTabsRow}>
          {adminGroupOptions.map((item) => {
            const active = adminGroupFilter === item;
            return (
              <AppButton
                key={`admin-group-${item}`}
                title={item === "all" ? t("allGroupsFilter") : item}
                onPress={() => setAdminGroupFilter(item)}
                variant={active ? "primary" : "ghost"}
                style={styles.groupFilterButton}
              />
            );
          })}
        </ScrollView>
      </View>
    );
  };

  const renderTeacherFilters = () => {
    if (role !== "teacher") return null;

    return (
      <View style={styles.filtersWrap}>
        <View style={styles.roleTabsRow}>
          {TEACHER_CHAT_MODES.map((mode) => (
            <AppButton
              key={mode}
              title={mode === "direct" ? t("chatModeDirect") : t("chatModeGroup")}
              onPress={() => setTeacherMode(mode)}
              variant={teacherMode === mode ? "primary" : "ghost"}
              style={styles.filterButton}
            />
          ))}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.groupTabsRow}>
          {teacherGroupOptions.map((groupName) => {
            const active = teacherGroupFilter === groupName;
            return (
              <AppButton
                key={`teacher-group-${groupName}`}
                title={groupName === "all" ? t("allGroupsFilter") : groupName}
                onPress={() => setTeacherGroupFilter(groupName)}
                variant={active ? "primary" : "ghost"}
                style={styles.groupFilterButton}
              />
            );
          })}
        </ScrollView>
      </View>
    );
  };

  const renderContactRow = (contact) => {
    const avatar = resolveMediaUrl(contact.avatar_url);

    let subtitle = t("selectTeacherOrStudent");
    if (contact.role === "student") {
      subtitle = `${t("groupName")}: ${contact.group_id || "-"}`;
    } else if (contact.role === "teacher") {
      const subjects = Array.isArray(contact.subjects) ? contact.subjects : [];
      const chunks = [];
      if (subjects.length) {
        chunks.push(subjects.join(", "));
      }

      if (role === "admin") {
        const groups = Array.from(teacherGroupsById[Number(contact.id)] || []).sort((a, b) => a.localeCompare(b, "ru", { sensitivity: "base" }));
        if (groups.length) {
          chunks.push(`${t("group")}: ${groups.join(", ")}`);
        }
      }

      subtitle = chunks.join(" • ") || t("selectTeacherOrStudent");
    }

    return (
      <Pressable
        onPress={() => openDirectChat(contact)}
        onLongPress={
          role === "teacher" && contact.role === "student"
            ? () => openGroupFromStudent(contact)
            : role === "student" && contact.role === "teacher"
            ? () => openGroupFromTeacher(contact)
            : undefined
        }
        delayLongPress={360}
        style={({ pressed }) => [
          styles.row,
          {
            borderColor: theme.colors.border,
            backgroundColor: pressed ? theme.colors.rowAlt : theme.colors.surface,
          },
        ]}
      >
        <View style={styles.avatarWrap}>{renderAvatar(avatar, contact.name)}</View>

        <View style={styles.metaWrap}>
          <Text style={[styles.name, { color: theme.colors.text, fontFamily: theme.fonts.medium }]}>{contact.name}</Text>
          <Text style={[styles.subtitle, { color: theme.colors.textMuted, fontFamily: theme.fonts.regular }]} numberOfLines={1}>
            {subtitle}
          </Text>
        </View>

        <Text style={[styles.chevron, { color: theme.colors.textMuted, fontFamily: theme.fonts.bold }]}>›</Text>
      </Pressable>
    );
  };

  const renderRoomRow = (room) => {
    const title = String(room?.title || `${room?.group_id || ""}`).trim() || `${room?.group_id || "-"}`;
    const subtitle = `${t("groupName")}: ${room?.group_id || "-"}`;

    return (
      <Pressable
        onPress={() => openGroupChat(room)}
        style={({ pressed }) => [
          styles.row,
          {
            borderColor: theme.colors.border,
            backgroundColor: pressed ? theme.colors.rowAlt : theme.colors.surface,
          },
        ]}
      >
        <View style={styles.avatarWrap}>
          <View style={[styles.roomIconWrap, { borderColor: theme.colors.border, backgroundColor: theme.colors.rowAlt }]}> 
            <Text style={[styles.roomIconText, { color: theme.colors.text, fontFamily: theme.fonts.bold }]}>#</Text>
          </View>
        </View>

        <View style={styles.metaWrap}>
          <Text style={[styles.name, { color: theme.colors.text, fontFamily: theme.fonts.medium }]}>{title}</Text>
          <Text style={[styles.subtitle, { color: theme.colors.textMuted, fontFamily: theme.fonts.regular }]} numberOfLines={1}>
            {subtitle}
          </Text>
        </View>

        <Text style={[styles.chevron, { color: theme.colors.textMuted, fontFamily: theme.fonts.bold }]}>›</Text>
      </Pressable>
    );
  };

  return (
    <ScreenLayout scroll={false} contentContainerStyle={styles.screen}>
      {Platform.OS === "web" ? (
        <Text style={[styles.title, { color: theme.colors.text, fontFamily: theme.fonts.bold }]}>{t("chat")}</Text>
      ) : null}

      {renderAdminFilters()}
      {renderTeacherFilters()}

      <FlatList
        data={listRows}
        keyExtractor={(item) => item.key}
        refreshing={refreshing || (loading && !hasLoadedOnce)}
        onRefresh={onRefresh}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => {
          if (item.rowType === "room") {
            return renderRoomRow(item.payload);
          }
          return renderContactRow(item.payload);
        }}
        ListEmptyComponent={
          hasLoadedOnce && !loading ? (
            <View style={[styles.empty, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}> 
              <Text style={[styles.emptyText, { color: theme.colors.textMuted, fontFamily: theme.fonts.regular }]}> 
                {t("noContacts")}
              </Text>
            </View>
          ) : null
        }
      />
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  title: {
    fontSize: 22,
    marginBottom: 10,
  },
  filtersWrap: {
    marginBottom: 10,
  },
  roleTabsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 8,
  },
  groupTabsRow: {
    flexDirection: "row",
    gap: 8,
    paddingRight: 12,
  },
  filterButton: {
    minHeight: 34,
    paddingHorizontal: 10,
  },
  groupFilterButton: {
    minHeight: 34,
    paddingHorizontal: 10,
  },
  listContent: {
    paddingBottom: 12,
  },
  row: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  avatarWrap: {
    width: 38,
    height: 38,
    marginRight: 10,
  },
  avatarImage: {
    width: 38,
    height: 38,
    borderRadius: 19,
  },
  avatarFallback: {
    width: 38,
    height: 38,
    borderWidth: 1,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  roomIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  roomIconText: {
    fontSize: 16,
    marginTop: -1,
  },
  metaWrap: {
    flex: 1,
  },
  name: {
    fontSize: 16,
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 12,
  },
  chevron: {
    fontSize: 26,
    marginLeft: 8,
    lineHeight: 26,
  },
  empty: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
  },
  emptyText: {
    fontSize: 13,
  },
});
