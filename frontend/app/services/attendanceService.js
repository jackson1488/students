/**
 * Module: app/services/attendanceService.js
 *
 * Purpose:
 * - API service module: attendanceService. Contains HTTP calls and payload shaping.
 *
 * Module notes:
 * - Imports count: 1.
 * - This header is written for beginners: read purpose first, then function map below.
 *
 * Function map:
 * - fetchAttendanceByStudent: Loads remote/local data and updates screen/component state.
 * - createAttendance: Creates a new entity or submits creation request.
 */

import api from "./api";

export async function fetchAttendanceByStudent(studentId) {
  const { data } = await api.get(`/attendance/${studentId}`);
  return data;
}

export async function createAttendance(payload) {
  const { data } = await api.post("/attendance", payload);
  return data;
}
