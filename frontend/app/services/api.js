/**
 * Module: app/services/api.js
 *
 * Purpose:
 * - API service module: api. Contains HTTP calls and payload shaping.
 *
 * Module notes:
 * - Imports count: 4.
 * - This header is written for beginners: read purpose first, then function map below.
 *
 * Function map:
 * - extractHost: Helper function used by this module business logic.
 * - inferDeviceHost: Builds derived values and resolves runtime decisions.
 * - resolveBaseURL: Builds derived values and resolves runtime decisions.
 * - localizeApiErrorMessage: Helper function used by this module business logic.
 * - setAuthToken: Applies value updates to state/configuration.
 */

import axios from "axios";
import Constants from "expo-constants";
import { Platform } from "react-native";

import i18n from "../i18n";

function extractHost(value) {
  if (!value || typeof value !== "string") return null;

  const normalized = value.replace(/^https?:\/\//i, "");
  const firstPart = normalized.split("/")[0];
  const host = firstPart.split(":")[0];
  return host || null;
}

function inferDeviceHost() {
  const fromExpoConfig = Constants.expoConfig?.hostUri;
  const fromManifest2 = Constants.manifest2?.extra?.expoClient?.hostUri;
  const fromManifest = Constants.manifest?.debuggerHost;

  return extractHost(fromExpoConfig) || extractHost(fromManifest2) || extractHost(fromManifest);
}

function resolveBaseURL() {
  const envBaseUrl = process.env.EXPO_PUBLIC_API_URL;
  if (envBaseUrl) return envBaseUrl;

  if (Platform.OS === "web" && typeof window !== "undefined") {
    const host = window.location.hostname || "localhost";
    return `http://${host}:5000`;
  }

  const inferredHost = inferDeviceHost();
  if (inferredHost && inferredHost !== "localhost" && inferredHost !== "127.0.0.1") {
    return `http://${inferredHost}:5000`;
  }

  if (Platform.OS === "android") {
    return "http://10.0.2.2:5000";
  }

  return "http://127.0.0.1:5000";
}

export const API_BASE_URL = resolveBaseURL();

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
});

function localizeApiErrorMessage(rawMessage, statusCode) {
  const normalized = String(rawMessage || "").trim().toLowerCase();

  if (statusCode === 401) {
    return i18n.t("unauthorized");
  }

  if (
    statusCode === 403 ||
    normalized === "forbidden" ||
    normalized.includes("only admin can")
  ) {
    return i18n.t("forbidden");
  }

  if (!normalized) {
    return i18n.t("unknownError");
  }

  return rawMessage;
}

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const statusCode = error?.response?.status;
    const rawMessage = error?.response?.data?.error || error?.message;
    const localized = localizeApiErrorMessage(rawMessage, statusCode);

    if (error?.response?.data && typeof error.response.data === "object") {
      error.response.data.error = localized;
    }
    error.userMessage = localized;
    return Promise.reject(error);
  }
);

export function setAuthToken(token) {
  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common.Authorization;
  }
}

export default api;
