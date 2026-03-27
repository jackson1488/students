/**
 * Module: app/services/authService.js
 *
 * Purpose:
 * - API service module: authService. Contains HTTP calls and payload shaping.
 *
 * Module notes:
 * - Imports count: 2.
 * - This header is written for beginners: read purpose first, then function map below.
 *
 * Function map:
 * - loginRequest: Helper function used by this module business logic.
 * - changePasswordRequest: Helper function used by this module business logic.
 * - impersonateRequest: Helper function used by this module business logic.
 * - decodeTokenPayload: Helper function used by this module business logic.
 */

import { decode as base64Decode } from "base-64";

import api from "./api";

export async function loginRequest({ login, password }) {
  const { data } = await api.post("/login", { login, password });
  return data;
}

export async function changePasswordRequest({ oldPassword, newPassword }) {
  const { data } = await api.post("/users/change-password", {
    old_password: oldPassword,
    new_password: newPassword,
  });
  return data;
}

export async function impersonateRequest({ userId }) {
  const { data } = await api.post("/auth/impersonate", { user_id: userId });
  return data;
}

export function decodeTokenPayload(token) {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const payloadPart = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = payloadPart + "=".repeat((4 - (payloadPart.length % 4)) % 4);
    const decoded = base64Decode(padded);
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}
