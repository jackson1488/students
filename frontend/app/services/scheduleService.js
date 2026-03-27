/**
 * Module: app/services/scheduleService.js
 *
 * Purpose:
 * - API service module: scheduleService. Contains HTTP calls and payload shaping.
 *
 * Module notes:
 * - Imports count: 1.
 * - This header is written for beginners: read purpose first, then function map below.
 *
 * Function map:
 * - fetchScheduleByGroup: Loads remote/local data and updates screen/component state.
 * - createScheduleEntry: Creates a new entity or submits creation request.
 * - updateScheduleEntry: Updates existing data or state values.
 * - deleteScheduleEntry: Deletes data or removes an item from current context.
 */

import api from "./api";

export async function fetchScheduleByGroup(groupId) {
  const { data } = await api.get(`/schedule/${groupId}`);
  return data;
}

export async function createScheduleEntry(payload) {
  const { data } = await api.post("/schedule", payload);
  return data;
}

export async function updateScheduleEntry(entryId, payload) {
  const { data } = await api.put(`/schedule/${entryId}`, payload);
  return data;
}

export async function deleteScheduleEntry(entryId) {
  const { data } = await api.delete(`/schedule/${entryId}`);
  return data;
}
