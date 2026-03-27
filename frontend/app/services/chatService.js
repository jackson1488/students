/**
 * Module: app/services/chatService.js
 *
 * Purpose:
 * - API service module: chatService. Contains HTTP calls and payload shaping.
 *
 * Module notes:
 * - Imports count: 1.
 * - This header is written for beginners: read purpose first, then function map below.
 *
 * Function map:
 * - fetchChatContacts: Loads remote/local data and updates screen/component state.
 * - fetchMessages: Loads remote/local data and updates screen/component state.
 * - fetchGroupChatRooms: Loads remote/local data and updates screen/component state.
 * - fetchGroupMessages: Loads remote/local data and updates screen/component state.
 * - buildAttachmentPart: Builds derived values and resolves runtime decisions.
 * - appendAttachment: Helper function used by this module business logic.
 * - sendMessage: Submits payload to backend or sends message/action request.
 * - sendGroupMessage: Submits payload to backend or sends message/action request.
 * - deleteMessageForMe: Deletes data or removes an item from current context.
 * - clearChatForMe: Helper function used by this module business logic.
 */

import api from "./api";

export async function fetchChatContacts() {
  const { data } = await api.get("/chat/contacts");
  return data;
}

export async function fetchMessages(withUserId) {
  const { data } = await api.get("/chat/messages", {
    params: withUserId ? { with_user_id: withUserId } : undefined,
  });
  return data;
}

export async function fetchGroupChatRooms() {
  const { data } = await api.get("/chat/group/rooms");
  return data;
}

export async function fetchGroupMessages(groupId, subject) {
  const { data } = await api.get("/chat/group/messages", {
    params: {
      group_id: groupId,
      subject,
    },
  });
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

export async function sendMessage({ receiver_id, message, attachmentAsset, reply_to_id }) {
  const formData = new FormData();
  formData.append("receiver_id", String(receiver_id));
  if (String(message || "").trim()) {
    formData.append("message", String(message).trim());
  }
  if (reply_to_id !== undefined && reply_to_id !== null && String(reply_to_id).trim()) {
    formData.append("reply_to_id", String(reply_to_id).trim());
  }

  const hasAttachment = appendAttachment(formData, attachmentAsset);
  if (hasAttachment) {
    const { data } = await api.post("/chat/send", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data;
  }

  const { data } = await api.post("/chat/send", {
    receiver_id,
    message,
    reply_to_id,
  });
  return data;
}

export async function sendGroupMessage({ group_id, subject, message, attachmentAsset }) {
  const formData = new FormData();
  formData.append("group_id", String(group_id));
  formData.append("subject", String(subject));
  if (String(message || "").trim()) {
    formData.append("message", String(message).trim());
  }

  const hasAttachment = appendAttachment(formData, attachmentAsset);
  if (hasAttachment) {
    const { data } = await api.post("/chat/group/send", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data;
  }

  const { data } = await api.post("/chat/group/send", {
    group_id,
    subject,
    message,
  });
  return data;
}

export async function deleteMessageForMe(messageId) {
  const { data } = await api.delete(`/chat/messages/${messageId}`);
  return data;
}

export async function clearChatForMe(withUserId) {
  const { data } = await api.post("/chat/messages/clear", { with_user_id: withUserId });
  return data;
}
