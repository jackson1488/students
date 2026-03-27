/**
 * Module: app/services/contentService.js
 *
 * Purpose:
 * - API service module: contentService. Contains HTTP calls and payload shaping.
 *
 * Module notes:
 * - Imports count: 2.
 * - This header is written for beginners: read purpose first, then function map below.
 *
 * Function map:
 * - fetchBooks: Loads remote/local data and updates screen/component state.
 * - fetchBookCatalog: Loads remote/local data and updates screen/component state.
 * - fetchBookShelf: Loads remote/local data and updates screen/component state.
 * - upsertBookShelfItem: Helper function used by this module business logic.
 * - deleteBookShelfItem: Deletes data or removes an item from current context.
 * - fetchNews: Loads remote/local data and updates screen/component state.
 * - buildImagePart: Builds derived values and resolves runtime decisions.
 * - isWebFile: Helper function used by this module business logic.
 * - createNews: Creates a new entity or submits creation request.
 * - updateNews: Updates existing data or state values.
 * - updateNewsStatus: Updates existing data or state values.
 * - createBook: Creates a new entity or submits creation request.
 */

import { Platform } from "react-native";

import api from "./api";

export async function fetchBooks() {
  const { data } = await api.get("/books");
  return data;
}

export async function fetchLibraryMode() {
  const { data } = await api.get("/books/mode");
  return data;
}

export async function updateLibraryMode(mode) {
  const { data } = await api.patch("/books/mode", { mode });
  return data;
}

export async function fetchBookCatalog(params = {}) {
  const { data } = await api.get("/books/catalog", { params });
  return data;
}

export async function fetchBookShelf() {
  const { data } = await api.get("/books/shelf");
  return data;
}

export async function upsertBookShelfItem(payload) {
  const { data } = await api.put("/books/shelf", payload || {});
  return data;
}

export async function deleteBookShelfItem(source, bookKey) {
  const { data } = await api.delete("/books/shelf", { params: { source, book_key: bookKey } });
  return data;
}

export async function fetchNews(params = {}) {
  const { data } = await api.get("/news", { params });
  return data;
}

function buildImagePart(imageAsset) {
  if (!imageAsset) return null;

  if (Platform.OS === "web" && imageAsset.file) {
    return imageAsset.file;
  }

  if (!imageAsset?.uri) return null;

  return {
    uri: imageAsset.uri,
    name: imageAsset.fileName || imageAsset.name || `news_${Date.now()}.jpg`,
    type: imageAsset.mimeType || "image/jpeg",
  };
}

function isWebFile(value) {
  return Platform.OS === "web" && typeof File !== "undefined" && value instanceof File;
}

export async function createNews(payload) {
  const body = payload || {};
  const imagePart = buildImagePart(body.imageAsset);

  if (imagePart) {
    const formData = new FormData();
    Object.entries(body).forEach(([key, value]) => {
      if (key === "imageAsset") return;
      if (value === undefined || value === null || value === "") return;
      formData.append(key, String(value));
    });
    if (isWebFile(imagePart)) {
      formData.append("image", imagePart, imagePart.name || `news_${Date.now()}.jpg`);
    } else {
      formData.append("image", imagePart);
    }

    const requestConfig = isWebFile(imagePart) ? undefined : { headers: { "Content-Type": "multipart/form-data" } };
    const { data } = await api.post("/news", formData, requestConfig);
    return data;
  }

  const normalized = {};
  Object.entries(body).forEach(([key, value]) => {
    if (key === "imageAsset") return;
    if (value === undefined || value === null || value === "") return;
    normalized[key] = value;
  });

  const { data } = await api.post("/news", normalized);
  return data;
}

export async function updateNews(newsId, payload) {
  const body = payload || {};
  const imagePart = buildImagePart(body.imageAsset);

  if (imagePart) {
    const formData = new FormData();
    Object.entries(body).forEach(([key, value]) => {
      if (key === "imageAsset") return;
      if (value === undefined || value === null || value === "") return;
      if (Array.isArray(value)) {
        formData.append(key, JSON.stringify(value));
        return;
      }
      formData.append(key, String(value));
    });

    if (isWebFile(imagePart)) {
      formData.append("image", imagePart, imagePart.name || `news_${Date.now()}.jpg`);
    } else {
      formData.append("image", imagePart);
    }

    const requestConfig = isWebFile(imagePart) ? undefined : { headers: { "Content-Type": "multipart/form-data" } };
    const { data } = await api.put(`/news/${newsId}`, formData, requestConfig);
    return data;
  }

  const normalized = {};
  Object.entries(body).forEach(([key, value]) => {
    if (key === "imageAsset") return;
    if (value === undefined || value === null || value === "") return;
    normalized[key] = value;
  });

  const { data } = await api.put(`/news/${newsId}`, normalized);
  return data;
}

export async function updateNewsStatus(newsId, isActive) {
  const { data } = await api.patch(`/news/${newsId}/status`, { is_active: Boolean(isActive) });
  return data;
}

function buildFilePart(fileAsset, fallbackPrefix = "file") {
  if (!fileAsset) return null;

  if (isWebFile(fileAsset)) {
    return fileAsset;
  }

  if (Platform.OS === "web" && fileAsset.file) {
    return fileAsset.file;
  }

  if (!fileAsset?.uri) return null;

  return {
    uri: fileAsset.uri,
    name: fileAsset.fileName || fileAsset.name || `${fallbackPrefix}_${Date.now()}`,
    type: fileAsset.mimeType || fileAsset.type || "application/octet-stream",
  };
}

export async function createBook(payload) {
  const body = payload || {};
  const filePart = buildFilePart(body.fileAsset || body.file_upload, "book");
  const coverPart = buildFilePart(body.coverAsset || body.cover_upload, "cover");

  if (filePart || coverPart) {
    const formData = new FormData();
    const textEntries = [
      ["title", body.title],
      ["author", body.author],
      ["description", body.description],
      ["cover_url", body.cover_url || body.coverUrl],
    ];

    textEntries.forEach(([key, value]) => {
      if (value === undefined || value === null || value === "") return;
      formData.append(key, String(value));
    });

    if (filePart) {
      if (isWebFile(filePart)) {
        formData.append("file", filePart, filePart.name || `book_${Date.now()}`);
      } else {
        formData.append("file", filePart);
      }
    }

    if (coverPart) {
      if (isWebFile(coverPart)) {
        formData.append("cover", coverPart, coverPart.name || `cover_${Date.now()}`);
      } else {
        formData.append("cover", coverPart);
      }
    }

    const isBrowserFile = isWebFile(filePart) || isWebFile(coverPart);
    const requestConfig = isBrowserFile ? undefined : { headers: { "Content-Type": "multipart/form-data" } };
    const { data } = await api.post("/books", formData, requestConfig);
    return data;
  }

  const normalized = {};
  Object.entries(body).forEach(([key, value]) => {
    if (["fileAsset", "file_upload", "coverAsset", "cover_upload"].includes(key)) return;
    if (value === undefined || value === null || value === "") return;
    normalized[key] = value;
  });

  const { data } = await api.post("/books", normalized);
  return data;
}
