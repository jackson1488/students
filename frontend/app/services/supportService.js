/**
 * Module: app/services/supportService.js
 *
 * Purpose:
 * - API service module: supportService. Contains HTTP calls and payload shaping.
 *
 * Module notes:
 * - Imports count: 1.
 * - This header is written for beginners: read purpose first, then function map below.
 *
 * Function map:
 * - fetchSupportContacts: Loads remote/local data and updates screen/component state.
 * - fetchSupportMessages: Loads remote/local data and updates screen/component state.
 * - buildImagePart: Builds derived values and resolves runtime decisions.
 * - appendAttachment: Helper function used by this module business logic.
 * - sendSupportMessage: Submits payload to backend or sends message/action request.
 */

import api from "./api";

export async function fetchSupportContacts() {
  const { data } = await api.get("/support/contacts");
  return data;
}

export async function fetchSupportMessages(withUserId) {
  const { data } = await api.get("/support/messages", {
    params: withUserId ? { with_user_id: withUserId } : undefined,
  });
  return data;
}

function buildImagePart(imageAsset) {
  if (!imageAsset?.uri) return null;
  return {
    uri: imageAsset.uri,
    name: imageAsset.fileName || imageAsset.name || `file_${Date.now()}`,
    type: imageAsset.mimeType || "application/octet-stream",
  };
}

function appendAttachment(formData, attachmentAsset) {
  const part = buildImagePart(attachmentAsset);
  if (!part) return false;

  const key = String(part.type || "").toLowerCase().startsWith("image/") ? "image" : "file";
  formData.append(key, part);
  return true;
}

export async function sendSupportMessage({ receiver_id, message, attachmentAsset }) {
  const formData = new FormData();
  if (receiver_id) {
    formData.append("receiver_id", String(receiver_id));
  }
  if (String(message || "").trim()) {
    formData.append("message", String(message).trim());
  }

  const hasAttachment = appendAttachment(formData, attachmentAsset);
  if (hasAttachment) {
    const { data } = await api.post("/support/send", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data;
  }

  const payload = {
    message,
  };
  if (receiver_id) {
    payload.receiver_id = receiver_id;
  }

  const { data } = await api.post("/support/send", payload);
  return data;
}
