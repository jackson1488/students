/**
 * Module: app/hooks/AuthContext.js
 *
 * Purpose:
 * - Hook/context module: AuthContext. Encapsulates shared stateful behavior.
 *
 * Module notes:
 * - Imports count: 4.
 * - This header is written for beginners: read purpose first, then function map below.
 *
 * Function map:
 * - buildSessionFromResponse: Builds derived values and resolves runtime decisions.
 * - normalizeSavedState: Transforms input/output values to stable display or API format.
 * - persistAuthState: Helper function used by this module business logic.
 * - AuthProvider: Main React component or UI container exported by this file.
 * - useAuth: Custom hook that encapsulates reusable stateful behavior.
 * - signIn: Helper function used by this module business logic.
 * - startImpersonation: Helper function used by this module business logic.
 * - restoreAdminSession: Helper function used by this module business logic.
 * - signOut: Helper function used by this module business logic.
 * - updateProfile: Updates existing data or state values.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

import { decodeTokenPayload, impersonateRequest, loginRequest } from "../services/authService";
import { setAuthToken } from "../services/api";

const STORAGE_KEY = "@student_system_auth";
const AuthContext = createContext(null);

const emptySession = {
  token: null,
  role: null,
  login: null,
  fullName: null,
  userId: null,
  groupId: null,
  avatarUrl: null,
};

const initialState = {
  ...emptySession,
  adminShadow: null,
  isLoading: true,
};

function buildSessionFromResponse(response, fallbackLogin = null) {
  const payload = decodeTokenPayload(response.token);

  return {
    token: response.token,
    role: response.role,
    login: response.login || fallbackLogin,
    fullName: response.full_name || null,
    userId: response.user_id ? Number(response.user_id) : payload?.sub ? Number(payload.sub) : null,
    groupId: response.group_id || null,
    avatarUrl: response.avatar_url || null,
  };
}

function normalizeSavedState(raw) {
  if (!raw) return null;

  const saved = JSON.parse(raw);
  if (!saved?.token || !saved?.role) {
    return null;
  }

  const session = {
    token: saved.token,
    role: saved.role,
    login: saved.login || null,
    fullName: saved.fullName || null,
    userId: saved.userId || null,
    groupId: saved.groupId || null,
    avatarUrl: saved.avatarUrl || null,
  };

  const shadow = saved.adminShadow;
  const adminShadow =
    shadow?.token && shadow?.role
      ? {
          token: shadow.token,
          role: shadow.role,
          login: shadow.login || null,
          fullName: shadow.fullName || null,
          userId: shadow.userId || null,
          groupId: shadow.groupId || null,
          avatarUrl: shadow.avatarUrl || null,
        }
      : null;

  return { session, adminShadow };
}

async function persistAuthState(session, adminShadow = null) {
  const payload = {
    ...session,
    adminShadow,
  };
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

export function AuthProvider({ children }) {
  const [state, setState] = useState(initialState);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (!raw) {
          setState((prev) => ({ ...prev, isLoading: false }));
          return;
        }

        const normalized = normalizeSavedState(raw);
        if (!normalized) {
          await AsyncStorage.removeItem(STORAGE_KEY);
          setState((prev) => ({ ...prev, isLoading: false }));
          return;
        }

        setAuthToken(normalized.session.token);
        setState({
          ...normalized.session,
          adminShadow: normalized.adminShadow,
          isLoading: false,
        });
      } catch {
        setState((prev) => ({ ...prev, isLoading: false }));
      }
    })();
  }, []);

  const signIn = async ({ login, password }) => {
    const response = await loginRequest({ login, password });
    const authData = buildSessionFromResponse(response, login);

    await persistAuthState(authData, null);
    setAuthToken(authData.token);

    setState({
      ...authData,
      adminShadow: null,
      isLoading: false,
    });

    return authData;
  };

  const startImpersonation = async (targetUserId) => {
    if (state.role !== "admin") {
      throw new Error("Forbidden");
    }

    const numericId = Number(targetUserId);
    if (!Number.isInteger(numericId) || numericId <= 0) {
      throw new Error("Invalid user_id");
    }

    const response = await impersonateRequest({ userId: numericId });
    const teacherSession = buildSessionFromResponse(response);
    const adminShadow = {
      token: state.token,
      role: state.role,
      login: state.login,
      fullName: state.fullName,
      userId: state.userId,
      groupId: state.groupId,
      avatarUrl: state.avatarUrl,
    };

    await persistAuthState(teacherSession, adminShadow);
    setAuthToken(teacherSession.token);
    setState({
      ...teacherSession,
      adminShadow,
      isLoading: false,
    });

    return teacherSession;
  };

  const restoreAdminSession = async () => {
    if (!state.adminShadow?.token || !state.adminShadow?.role) {
      return false;
    }

    const adminSession = { ...state.adminShadow };
    await persistAuthState(adminSession, null);
    setAuthToken(adminSession.token);
    setState({
      ...adminSession,
      adminShadow: null,
      isLoading: false,
    });
    return true;
  };

  const signOut = async () => {
    await AsyncStorage.removeItem(STORAGE_KEY);
    setAuthToken(null);
    setState({ ...initialState, isLoading: false });
  };

  const updateProfile = async (patch) => {
    const safePatch = patch || {};
    const next = {
      token: state.token,
      role: safePatch.role !== undefined ? safePatch.role : state.role,
      login: safePatch.login !== undefined ? safePatch.login : state.login,
      fullName: safePatch.fullName !== undefined ? safePatch.fullName : state.fullName,
      userId: safePatch.userId !== undefined ? safePatch.userId : state.userId,
      groupId: safePatch.groupId !== undefined ? safePatch.groupId : state.groupId,
      avatarUrl: safePatch.avatarUrl !== undefined ? safePatch.avatarUrl : state.avatarUrl,
    };

    await persistAuthState(next, state.adminShadow);
    setState((prev) => ({
      ...prev,
      ...next,
      isLoading: false,
    }));
  };

  const value = useMemo(
    () => ({
      ...state,
      isAuthenticated: Boolean(state.token),
      isImpersonating: Boolean(state.adminShadow?.token),
      signIn,
      startImpersonation,
      restoreAdminSession,
      signOut,
      updateProfile,
    }),
    [state]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
