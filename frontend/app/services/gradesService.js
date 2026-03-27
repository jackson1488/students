/**
 * Module: app/services/gradesService.js
 *
 * Purpose:
 * - API service module: gradesService. Contains HTTP calls and payload shaping.
 *
 * Module notes:
 * - Imports count: 1.
 * - This header is written for beginners: read purpose first, then function map below.
 *
 * Function map:
 * - fetchGradesByStudent: Loads remote/local data and updates screen/component state.
 * - createGrade: Creates a new entity or submits creation request.
 * - fetchGradeJournal: Loads remote/local data and updates screen/component state.
 * - saveGradeJournalValue: Helper function used by this module business logic.
 */

import api from "./api";

export async function fetchGradesByStudent(studentId) {
  const { data } = await api.get(`/grades/${studentId}`);
  return data;
}

export async function createGrade(payload) {
  const { data } = await api.post("/grades", payload);
  return data;
}

export async function fetchGradeJournal(params = {}) {
  const { data } = await api.get("/grades/journal", { params });
  return data;
}

export async function saveGradeJournalValue(payload) {
  const { data } = await api.post("/grades/journal", payload);
  return data;
}
