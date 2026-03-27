/**
 * Module: app/services/testsService.js
 *
 * Purpose:
 * - API service module: testsService. Contains HTTP calls and payload shaping.
 *
 * Module notes:
 * - Imports count: 1.
 * - This header is written for beginners: read purpose first, then function map below.
 *
 * Function map:
 * - fetchTests: Loads remote/local data and updates screen/component state.
 * - createTest: Creates a new entity or submits creation request.
 * - fetchTestDetail: Loads remote/local data and updates screen/component state.
 * - updateTest: Updates existing data or state values.
 * - activateTest: Helper function used by this module business logic.
 * - deactivateTest: Helper function used by this module business logic.
 * - allowRetake: Helper function used by this module business logic.
 * - submitTest: Submits payload to backend or sends message/action request.
 * - startTestAttempt: Helper function used by this module business logic.
 * - syncTestProgress: Helper function used by this module business logic.
 * - fetchModuleSummary: Loads remote/local data and updates screen/component state.
 * - saveModuleSummary: Helper function used by this module business logic.
 */

import api from "./api";

export async function fetchTests() {
  const { data } = await api.get("/tests");
  return data;
}

export async function createTest(payload) {
  const { data } = await api.post("/tests", payload);
  return data;
}

export async function fetchTestDetail(testId) {
  const { data } = await api.get(`/tests/${Number(testId)}`);
  return data;
}

export async function updateTest(testId, payload) {
  const { data } = await api.put(`/tests/${Number(testId)}`, payload);
  return data;
}

export async function activateTest(payload) {
  const { data } = await api.post("/tests/activate", payload);
  return data;
}

export async function deactivateTest(payload) {
  const { data } = await api.post("/tests/deactivate", payload);
  return data;
}

export async function allowRetake(payload) {
  const { data } = await api.post("/tests/retake", payload);
  return data;
}

export async function submitTest(payload) {
  const { data } = await api.post("/tests/submit", payload);
  return data;
}

export async function startTestAttempt(payload) {
  const { data } = await api.post("/tests/start", payload);
  return data;
}

export async function syncTestProgress(payload) {
  const { data } = await api.post("/tests/progress", payload);
  return data;
}

export async function fetchModuleSummary(studentRef) {
  const { data } = await api.get(`/tests/module-summary/${encodeURIComponent(String(studentRef || "").trim())}`);
  return data;
}

export async function saveModuleSummary(payload) {
  const { data } = await api.post("/tests/module-summary", payload);
  return data;
}
