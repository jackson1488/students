/**
 * Module: app/services/academyService.js
 *
 * Purpose:
 * - API service module: academyService. Contains HTTP calls and payload shaping.
 *
 * Module notes:
 * - Imports count: 1.
 * - This header is written for beginners: read purpose first, then function map below.
 *
 * Function map:
 * - fetchGroups: Loads remote/local data and updates screen/component state.
 * - createGroup: Creates a new entity or submits creation request.
 * - updateGroup: Updates existing data or state values.
 * - fetchTeachers: Loads remote/local data and updates screen/component state.
 * - createTeacher: Creates a new entity or submits creation request.
 * - updateTeacher: Updates existing data or state values.
 * - fetchTeacherById: Loads remote/local data and updates screen/component state.
 * - fetchStudents: Loads remote/local data and updates screen/component state.
 * - createStudent: Creates a new entity or submits creation request.
 * - updateStudent: Updates existing data or state values.
 * - fetchStudentById: Loads remote/local data and updates screen/component state.
 * - fetchBindings: Loads remote/local data and updates screen/component state.
 * - createBinding: Creates a new entity or submits creation request.
 */

import api from "./api";

export async function fetchGroups() {
  const { data } = await api.get("/groups");
  return data;
}

export async function createGroup(payload) {
  const { data } = await api.post("/groups", payload);
  return data;
}

export async function updateGroup(groupId, payload) {
  const { data } = await api.put(`/groups/${groupId}`, payload);
  return data;
}

export async function fetchTeachers() {
  const { data } = await api.get("/teachers");
  return data;
}

export async function createTeacher(payload) {
  const { data } = await api.post("/teachers", payload);
  return data;
}

export async function updateTeacher(teacherId, payload) {
  const { data } = await api.put(`/teachers/${teacherId}`, payload);
  return data;
}

export async function fetchTeacherById(teacherId) {
  const { data } = await api.get(`/teachers/${teacherId}`);
  return data;
}

export async function fetchStudents() {
  const { data } = await api.get("/students");
  return data;
}

export async function createStudent(payload) {
  const { data } = await api.post("/students", payload);
  return data;
}

export async function updateStudent(studentId, payload) {
  const { data } = await api.put(`/students/${studentId}`, payload);
  return data;
}

export async function fetchStudentById(studentId) {
  const { data } = await api.get(`/students/${studentId}`);
  return data;
}

export async function fetchBindings(params = {}) {
  const { data } = await api.get("/bindings", { params });
  return data;
}

export async function createBinding(payload) {
  const { data } = await api.post("/bindings", payload);
  return data;
}
