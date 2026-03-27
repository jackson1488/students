/**
 * Module: app/services/homeworkService.js
 *
 * Purpose:
 * - API service module: homeworkService. Contains HTTP calls and payload shaping.
 *
 * Module notes:
 * - Imports count: 1.
 * - This header is written for beginners: read purpose first, then function map below.
 *
 * Function map:
 * - createHomework: Creates a new entity or submits creation request.
 * - fetchHomeworkTargets: Loads remote/local data and updates screen/component state.
 * - fetchHomeworkByGroup: Loads remote/local data and updates screen/component state.
 * - buildAttachmentPart: Builds derived values and resolves runtime decisions.
 * - appendAttachment: Helper function used by this module business logic.
 * - submitHomework: Submits payload to backend or sends message/action request.
 * - fetchHomeworkSubmissions: Loads remote/local data and updates screen/component state.
 * - reviewHomeworkSubmission: Helper function used by this module business logic.
 * - updateHomeworkStatus: Updates existing data or state values.
 * - deleteHomework: Deletes data or removes an item from current context.
 */

import api from "./api";

export async function createHomework(payload) {
  const { data } = await api.post("/homework", payload);
  return data;
}

export async function fetchHomeworkTargets() {
  const { data } = await api.get("/homework/targets");
  return data;
}

export async function fetchHomeworkByGroup(groupId) {
  const { data } = await api.get(`/homework/${encodeURIComponent(String(groupId || "").trim())}`);
  return data;
}

function buildAttachmentPart(attachmentAsset) {
  if (!attachmentAsset?.uri) return null;
  return {
    uri: attachmentAsset.uri,
    name: attachmentAsset.fileName || attachmentAsset.name || `file_${Date.now()}`,
    type: attachmentAsset.mimeType || "application/octet-stream",
  };
}

function appendAttachment(formData, attachmentAsset) {
  const part = buildAttachmentPart(attachmentAsset);
  if (!part) return false;

  const key = String(part.type || "").toLowerCase().startsWith("image/") ? "image" : "file";
  formData.append(key, part);
  return true;
}

export async function submitHomework(homeworkId, { comment, attachmentAsset } = {}) {
  const formData = new FormData();
  if (String(comment || "").trim()) {
    formData.append("comment", String(comment).trim());
  }

  const hasAttachment = appendAttachment(formData, attachmentAsset);
  if (hasAttachment) {
    const { data } = await api.post(`/homework/${Number(homeworkId)}/submit`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data;
  }

  const { data } = await api.post(`/homework/${Number(homeworkId)}/submit`, {
    comment: String(comment || "").trim(),
  });
  return data;
}

export async function fetchHomeworkSubmissions(homeworkId) {
  const { data } = await api.get(`/homework/${Number(homeworkId)}/submissions`);
  return data;
}

export async function reviewHomeworkSubmission(submissionId, payload) {
  const { data } = await api.patch(`/homework/submissions/${Number(submissionId)}/review`, payload || {});
  return data;
}

export async function updateHomeworkStatus(homeworkId, payload) {
  const { data } = await api.patch(`/homework/${Number(homeworkId)}/status`, payload || {});
  return data;
}

export async function deleteHomework(homeworkId) {
  const { data } = await api.delete(`/homework/${Number(homeworkId)}`);
  return data;
}
