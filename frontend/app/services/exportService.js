/**
 * Module: app/services/exportService.js
 *
 * Purpose:
 * - API service module: exportService. Contains HTTP calls and payload shaping.
 *
 * Module notes:
 * - Imports count: 2.
 * - This header is written for beginners: read purpose first, then function map below.
 *
 * Function map:
 * - buildExportUrl: Builds derived values and resolves runtime decisions.
 * - openExportDocument: Controls modal/sheet/screen visibility or navigation transition.
 */

import { Linking, Platform } from "react-native";

import { API_BASE_URL } from "./api";

function buildExportUrl(entity, target, format, token, language) {
  const safeEntity = String(entity || "").trim();
  const safeTarget = encodeURIComponent(String(target || "").trim());
  const safeFormat = encodeURIComponent(String(format || "pdf").trim().toLowerCase());
  const safeToken = encodeURIComponent(String(token || "").trim());
  const safeLang = encodeURIComponent(String(language || "ru").trim().toLowerCase());

  return `${API_BASE_URL}/exports/${safeEntity}/${safeTarget}?format=${safeFormat}&token=${safeToken}&lang=${safeLang}`;
}

export async function openExportDocument({ entity, target, format, token, language }) {
  const url = buildExportUrl(entity, target, format, token, language);

  if (Platform.OS === "web" && typeof window !== "undefined") {
    window.open(url, "_blank", "noopener,noreferrer");
    return;
  }

  await Linking.openURL(url);
}
