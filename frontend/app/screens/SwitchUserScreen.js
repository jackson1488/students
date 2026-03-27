/**
 * Module: app/screens/SwitchUserScreen.js
 *
 * Purpose:
 * - Screen module for SwitchUserScreen. Handles state, data loading, and UI for this route.
 *
 * Module notes:
 * - Imports count: 10.
 * - This header is written for beginners: read purpose first, then function map below.
 *
 * Function map:
 * - SwitchUserScreen: Main React component or UI container exported by this file.
 * - handleSwitch: Event handler for user actions and interactive flows.
 * - loadUsers: Loads remote/local data and updates screen/component state.
 * - filtered: Helper function used by this module business logic.
 * - visibleUsers: Helper function used by this module business logic.
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Platform, StyleSheet, Text, View } from "react-native";

import AppButton from "../components/AppButton";
import AppCard from "../components/AppCard";
import AppInput from "../components/AppInput";
import ScreenLayout from "../components/ScreenLayout";
import { useAuth } from "../hooks/AuthContext";
import { useI18n } from "../hooks/I18nContext";
import { useThemeMode } from "../hooks/ThemeContext";
import { fetchUsers } from "../services/usersService";

const ROLE_FILTERS = ["all", "teacher", "student", "scheduler", "rector"];

export default function SwitchUserScreen() {
  const { t } = useI18n();
  const { theme } = useThemeMode();
  const { role, startImpersonation } = useAuth();

  const [loading, setLoading] = useState(false);
  const [switchingUserId, setSwitchingUserId] = useState(null);
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [users, setUsers] = useState([]);

  const loadUsers = useCallback(async () => {
    if (role !== "admin") {
      setUsers([]);
      return;
    }

    setLoading(true);
    try {
      const rows = await fetchUsers();
      const filtered = (Array.isArray(rows) ? rows : []).filter((item) => item.role !== "admin");
      setUsers(filtered);
    } catch (error) {
      Alert.alert(t("switchUser"), error?.response?.data?.error || error?.userMessage || t("unknownError"));
    } finally {
      setLoading(false);
    }
  }, [role, t]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const visibleUsers = useMemo(() => {
    const loweredQuery = String(query || "").trim().toLowerCase();

    return users
      .filter((item) => (roleFilter === "all" ? true : item.role === roleFilter))
      .filter((item) => {
        if (!loweredQuery) return true;
        const searchBlob = [
          item.login,
          item.full_name,
          item.group_id,
          item.role,
        ]
          .map((value) => String(value || "").toLowerCase())
          .join(" ");
        return searchBlob.includes(loweredQuery);
      })
      .sort((a, b) => String(a.full_name || a.login || "").localeCompare(String(b.full_name || b.login || "")));
  }, [query, roleFilter, users]);

  const handleSwitch = async (targetUserId) => {
    if (role !== "admin") {
      Alert.alert(t("switchUser"), t("forbidden"));
      return;
    }

    const numericId = Number(targetUserId);
    if (!Number.isInteger(numericId) || numericId <= 0) return;

    setSwitchingUserId(numericId);
    try {
      await startImpersonation(numericId);
    } catch (error) {
      Alert.alert(t("switchUser"), error?.response?.data?.error || error?.userMessage || error?.message || t("unknownError"));
    } finally {
      setSwitchingUserId(null);
    }
  };

  if (role !== "admin") {
    return (
      <ScreenLayout>
        <AppCard>
          <Text style={[styles.helperText, { color: theme.colors.textMuted, fontFamily: theme.fonts.regular }]}>
            {t("forbidden")}
          </Text>
        </AppCard>
      </ScreenLayout>
    );
  }

  return (
    <ScreenLayout onRefresh={loadUsers} refreshing={loading}>
      {Platform.OS === "web" ? (
        <Text style={[styles.title, { color: theme.colors.text, fontFamily: theme.fonts.bold }]}>
          {t("switchUser")}
        </Text>
      ) : null}

      <AppCard>
        <Text style={[styles.helperText, { color: theme.colors.textMuted, fontFamily: theme.fonts.regular }]}>
          {t("switchUserHint")}
        </Text>
        <AppInput
          label={t("users")}
          value={query}
          onChangeText={setQuery}
          placeholder={t("userSearchPlaceholder")}
        />
        <Text style={[styles.inputLabel, { color: theme.colors.text, fontFamily: theme.fonts.medium }]}>
          {t("role")}
        </Text>
        <View style={styles.filtersRow}>
          {ROLE_FILTERS.map((filterKey) => (
            <AppButton
              key={`switch-filter-${filterKey}`}
              title={t(filterKey === "all" ? "chatFilterAll" : filterKey)}
              variant={roleFilter === filterKey ? "primary" : "ghost"}
              onPress={() => setRoleFilter(filterKey)}
              style={styles.filterButton}
            />
          ))}
        </View>
      </AppCard>

      {!visibleUsers.length ? (
        <AppCard>
          <Text style={[styles.helperText, { color: theme.colors.textMuted, fontFamily: theme.fonts.regular }]}>
            {t("noUsersFound")}
          </Text>
        </AppCard>
      ) : null}

      {visibleUsers.map((item) => (
        <AppCard key={`switch-user-${item.id}`}>
          <Text style={[styles.name, { color: theme.colors.text, fontFamily: theme.fonts.bold }]}>
            {item.full_name || item.login || "-"}
          </Text>
          <Text style={[styles.meta, { color: theme.colors.textMuted, fontFamily: theme.fonts.regular }]}>
            @{item.login || "-"}
          </Text>
          <Text style={[styles.meta, { color: theme.colors.textMuted, fontFamily: theme.fonts.regular }]}>
            {t("role")}: {t(item.role || "student")}
          </Text>
          {item.group_id ? (
            <Text style={[styles.meta, { color: theme.colors.textMuted, fontFamily: theme.fonts.regular }]}>
              {t("groupName")}: {item.group_id}
            </Text>
          ) : null}

          <View style={styles.actionsRow}>
            <AppButton
              title={t("switchToUser")}
              onPress={() => handleSwitch(item.id)}
              loading={Number(switchingUserId) === Number(item.id)}
              disabled={Boolean(switchingUserId) && Number(switchingUserId) !== Number(item.id)}
              style={styles.actionButton}
            />
          </View>
        </AppCard>
      ))}
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 22,
    marginBottom: 12,
  },
  helperText: {
    fontSize: 12,
    marginBottom: 10,
  },
  inputLabel: {
    fontSize: 13,
    marginBottom: 6,
  },
  filtersRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 2,
  },
  filterButton: {
    minHeight: 34,
  },
  name: {
    fontSize: 16,
    marginBottom: 4,
  },
  meta: {
    fontSize: 12,
    marginBottom: 2,
  },
  actionsRow: {
    flexDirection: "row",
    marginTop: 8,
  },
  actionButton: {
    minHeight: 34,
  },
});
