/**
 * Module: app/services/usersService.js
 *
 * Purpose:
 * - API service module: usersService. Contains HTTP calls and payload shaping.
 *
 * Module notes:
 * - Imports count: 1.
 * - This header is written for beginners: read purpose first, then function map below.
 *
 * Function map:
 * - fetchUsers: Loads remote/local data and updates screen/component state.
 * - createUser: Creates a new entity or submits creation request.
 * - removeUser: Deletes data or removes an item from current context.
 * - buildImagePart: Builds derived values and resolves runtime decisions.
 * - fetchMyProfile: Loads remote/local data and updates screen/component state.
 * - fetchMyDetails: Loads remote/local data and updates screen/component state.
 * - updateMyDetails: Updates existing data or state values.
 * - uploadMyAvatar: Helper function used by this module business logic.
 */

import api from "./api";

export async function fetchUsers() {
  const { data } = await api.get("/users");
  return data;
}

export async function createUser(payload) {
  const { data } = await api.post("/users", payload);
  return data;
}

export async function removeUser(userId) {
  const { data } = await api.delete(`/users/${userId}`);
  return data;
}

function buildImagePart(imageAsset) {
  if (!imageAsset?.uri) return null;
  return {
    uri: imageAsset.uri,
    name: imageAsset.fileName || imageAsset.name || `avatar_${Date.now()}.jpg`,
    type: imageAsset.mimeType || "image/jpeg",
  };
}

export async function fetchMyProfile() {
  const { data } = await api.get("/users/me");
  return data;
}

export async function fetchMyDetails() {
  const { data } = await api.get("/users/me/details");
  return data;
}

export async function updateMyDetails(payload) {
  const { data } = await api.put("/users/me/details", payload);
  return data;
}

export async function uploadMyAvatar(imageAsset) {
  const imagePart = buildImagePart(imageAsset);
  if (!imagePart) {
    throw new Error("image is required");
  }

  const formData = new FormData();
  formData.append("image", imagePart);

  const { data } = await api.post("/users/avatar", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}
