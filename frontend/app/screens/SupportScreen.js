/**
 * Module: app/screens/SupportScreen.js
 *
 * Purpose:
 * - Screen module for SupportScreen. Handles state, data loading, and UI for this route.
 *
 * Module notes:
 * - Imports count: 12.
 * - This header is written for beginners: read purpose first, then function map below.
 *
 * Function map:
 * - SupportScreen: Main React component or UI container exported by this file.
 * - resolveMediaUrl: Builds derived values and resolves runtime decisions.
 * - initialsFromName: Helper function used by this module business logic.
 * - formatTime: Transforms input/output values to stable display or API format.
 * - dayKey: Helper function used by this module business logic.
 * - formatDayLabel: Transforms input/output values to stable display or API format.
 * - mergeMessages: Helper function used by this module business logic.
 * - normalizeMessages: Transforms input/output values to stable display or API format.
 * - hasMessageRowsChanges: Helper function used by this module business logic.
 * - buildThreadItems: Builds derived values and resolves runtime decisions.
 * - isImageAttachment: Helper function used by this module business logic.
 * - getAttachmentName: Returns computed or fetched data for caller usage.
 * - pickAttachment: Helper function used by this module business logic.
 * - onSend: Callback function invoked by UI or navigation events.
 * - openAttachment: Controls modal/sheet/screen visibility or navigation transition.
 * - renderAvatar: Builds and returns a UI fragment for rendering.
 * - renderMessageRow: Builds and returns a UI fragment for rendering.
 * - ownAvatar: Helper function used by this module business logic.
 * - loadContacts: Loads remote/local data and updates screen/component state.
 * - loadMessages: Loads remote/local data and updates screen/component state.
 * - onShow: Callback function invoked by UI or navigation events.
 * - onHide: Callback function invoked by UI or navigation events.
 * - threadItems: Helper function used by this module business logic.
 * - timer: Helper function used by this module business logic.
 */

import * as DocumentPicker from "expo-document-picker";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  FlatList,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useHeaderHeight } from "@react-navigation/elements";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import ScreenLayout from "../components/ScreenLayout";
import usePolling from "../hooks/usePolling";
import { useAuth } from "../hooks/AuthContext";
import { useI18n } from "../hooks/I18nContext";
import { useThemeMode } from "../hooks/ThemeContext";
import { API_BASE_URL } from "../services/api";
import {
  fetchSupportContacts,
  fetchSupportMessages,
  sendSupportMessage,
} from "../services/supportService";

function resolveMediaUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (raw.startsWith("data:")) return raw;
  if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;
  if (raw.startsWith("/")) return `${API_BASE_URL}${raw}`;
  if (/^(users|chat|support|uploads)\//i.test(raw)) {
    return `${API_BASE_URL}/${raw.replace(/^\/+/, "")}`;
  }
  return raw;
}

function initialsFromName(value) {
  const src = String(value || "").trim();
  return src ? src.slice(0, 1).toUpperCase() : "U";
}

function formatTime(value) {
  const date = new Date(value || Date.now());
  if (Number.isNaN(date.getTime())) return "--:--";
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function dayKey(value) {
  const date = new Date(value || Date.now());
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function formatDayLabel(value, t) {
  const date = new Date(value || Date.now());
  if (Number.isNaN(date.getTime())) return "-";

  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startValue = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const diffDays = Math.floor((startToday - startValue) / 86400000);

  if (diffDays === 0) return t("today");
  if (diffDays === 1) return t("yesterday");
  return date.toLocaleDateString();
}

function mergeMessages(currentRows, incomingRows) {
  const map = new Map();
  [...currentRows, ...incomingRows].forEach((row) => {
    if (row && row.id) {
      map.set(Number(row.id), row);
    }
  });

  return Array.from(map.values()).sort((a, b) => {
    const aTime = new Date(a.created_at || 0).getTime();
    const bTime = new Date(b.created_at || 0).getTime();
    return aTime - bTime;
  });
}

function normalizeMessages(rows) {
  return (Array.isArray(rows) ? rows : []).slice().sort((a, b) => {
    const aTime = new Date(a?.created_at || 0).getTime();
    const bTime = new Date(b?.created_at || 0).getTime();
    return aTime - bTime;
  });
}

function hasMessageRowsChanges(prevRows, nextRows) {
  if (!Array.isArray(prevRows) || !Array.isArray(nextRows)) return true;
  if (prevRows.length !== nextRows.length) return true;

  for (let idx = 0; idx < prevRows.length; idx += 1) {
    const prev = prevRows[idx];
    const next = nextRows[idx];
    if (!prev || !next) return true;
    if (Number(prev.id) !== Number(next.id)) return true;
    if (String(prev.message || "") !== String(next.message || "")) return true;
    if (String(prev.attachment_url || "") !== String(next.attachment_url || "")) return true;
    if (String(prev.attachment_type || "") !== String(next.attachment_type || "")) return true;
  }

  return false;
}

function buildThreadItems(messages, t) {
  const rows = [];
  let lastDate = "";

  messages.forEach((message) => {
    const key = dayKey(message.created_at);
    if (key !== lastDate) {
      rows.push({
        type: "divider",
        id: `divider-${key}`,
        label: formatDayLabel(message.created_at, t),
      });
      lastDate = key;
    }

    rows.push({
      type: "message",
      id: `message-${message.id}`,
      payload: message,
    });
  });

  return rows;
}

function isImageAttachment(attachmentType, attachmentUrl) {
  const type = String(attachmentType || "").toLowerCase();
  if (type === "image") return true;

  const value = String(attachmentUrl || "").toLowerCase();
  return [".jpg", ".jpeg", ".png", ".webp", ".gif"].some((ext) => value.includes(ext));
}

function getAttachmentName(message) {
  const raw = String(message?.attachment_url || "").trim();
  if (!raw) return "file";

  const pathValue = raw.split("?")[0];
  const chunk = pathValue.split("/").pop() || "file";
  const decoded = decodeURIComponent(chunk);
  return decoded.includes("_") ? decoded.split("_").slice(1).join("_") : decoded;
}

export default function SupportScreen() {
  const { t } = useI18n();
  const { theme } = useThemeMode();
  const { role, userId, avatarUrl } = useAuth();
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();
  const keyboardBehavior = Platform.OS === "ios" ? "padding" : undefined;

  const isAdmin = role === "admin";
  const listRef = useRef(null);

  const [contacts, setContacts] = useState([]);
  const [selectedPartnerId, setSelectedPartnerId] = useState("");
  const [allMessages, setAllMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [sending, setSending] = useState(false);
  const [messageText, setMessageText] = useState("");
  const [pendingAttachment, setPendingAttachment] = useState(null);
  const [viewerImageUrl, setViewerImageUrl] = useState("");
  const [androidKeyboardHeight, setAndroidKeyboardHeight] = useState(0);

  const selectedPartner = useMemo(
    () => contacts.find((item) => Number(item.id) === Number(selectedPartnerId)) || null,
    [contacts, selectedPartnerId]
  );

  const ownAvatar = useMemo(() => resolveMediaUrl(avatarUrl), [avatarUrl]);
  const partnerAvatar = useMemo(
    () => resolveMediaUrl(selectedPartner?.avatar_url),
    [selectedPartner?.avatar_url]
  );
  const androidKeyboardOffset = Platform.OS === "android" ? androidKeyboardHeight : 0;

  const loadContacts = useCallback(async () => {
    try {
      const data = await fetchSupportContacts();
      const rows = Array.isArray(data) ? data : [];
      setContacts(rows);

      if (!selectedPartnerId && rows.length) {
        setSelectedPartnerId(String(rows[0].id));
      } else if (
        selectedPartnerId &&
        !rows.some((item) => Number(item.id) === Number(selectedPartnerId))
      ) {
        setSelectedPartnerId(rows[0] ? String(rows[0].id) : "");
      }
    } catch {
      // keep previous data
    }
  }, [selectedPartnerId]);

  const loadMessages = useCallback(async () => {
    if (!selectedPartnerId) {
      setAllMessages([]);
      setHasLoadedOnce(true);
      return;
    }

    const showLoader = allMessages.length === 0 && !hasLoadedOnce;
    try {
      if (showLoader) {
        setLoading(true);
      }

      const data = await fetchSupportMessages(Number(selectedPartnerId));
      const normalized = normalizeMessages(data);
      setAllMessages((prev) => (hasMessageRowsChanges(prev, normalized) ? normalized : prev));
      setHasLoadedOnce(true);
    } catch {
      setHasLoadedOnce(true);
    } finally {
      if (showLoader) {
        setLoading(false);
      }
    }
  }, [allMessages.length, hasLoadedOnce, selectedPartnerId]);

  usePolling(loadContacts, 1000, []);
  usePolling(loadMessages, 1000, [selectedPartnerId]);

  useEffect(() => {
    if (!isAdmin && contacts.length && !selectedPartnerId) {
      setSelectedPartnerId(String(contacts[0].id));
    }
  }, [contacts, isAdmin, selectedPartnerId]);

  useEffect(() => {
    setAllMessages([]);
    setHasLoadedOnce(false);
    setMessageText("");
    setPendingAttachment(null);
  }, [selectedPartnerId]);

  useEffect(() => {
    if (Platform.OS !== "android") return undefined;

    const onShow = Keyboard.addListener("keyboardDidShow", (event) => {
      setAndroidKeyboardHeight(Number(event?.endCoordinates?.height || 0));
      requestAnimationFrame(() => {
        listRef.current?.scrollToEnd?.({ animated: true });
      });
    });

    const onHide = Keyboard.addListener("keyboardDidHide", () => {
      setAndroidKeyboardHeight(0);
    });

    return () => {
      onShow.remove();
      onHide.remove();
    };
  }, []);

  const threadItems = useMemo(() => buildThreadItems(allMessages, t), [allMessages, t]);

  useEffect(() => {
    if (!threadItems.length) return;
    const timer = setTimeout(() => {
      listRef.current?.scrollToEnd?.({ animated: true });
    }, 40);
    return () => clearTimeout(timer);
  }, [threadItems.length]);

  const canSend = Boolean(selectedPartnerId);

  const pickAttachment = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ["*/*"],
      copyToCacheDirectory: true,
      multiple: false,
    });

    if (result.canceled || !result.assets?.length) return;
    setPendingAttachment(result.assets[0]);
  };

  const onSend = async () => {
    const cleanMessage = messageText.trim();
    if ((!cleanMessage && !pendingAttachment) || !canSend) return;

    setSending(true);
    try {
      const row = await sendSupportMessage({
        message: cleanMessage,
        receiver_id: Number(selectedPartnerId),
        attachmentAsset: pendingAttachment,
      });

      if (row) {
        setAllMessages((prev) => mergeMessages(prev, [row]));
      }
      setMessageText("");
      setPendingAttachment(null);
    } catch (error) {
      Alert.alert(t("support"), error?.response?.data?.error || t("unknownError"));
    } finally {
      setSending(false);
    }
  };

  const openAttachment = async (url) => {
    if (!url) return;

    if (Platform.OS === "web" && typeof window !== "undefined") {
      window.open(url, "_blank", "noopener,noreferrer");
      return;
    }

    const canOpen = await Linking.canOpenURL(url);
    if (!canOpen) {
      Alert.alert(t("support"), t("fileOpenUnavailable"));
      return;
    }
    await Linking.openURL(url);
  };

  const renderAvatar = (uri, fallbackName) => {
    if (uri) {
      return <Image source={{ uri }} style={styles.avatarImage} resizeMode="cover" />;
    }

    return (
      <View
        style={[
          styles.avatarFallback,
          { borderColor: theme.colors.border, backgroundColor: theme.colors.rowAlt },
        ]}
      >
        <Text style={{ color: theme.colors.text, fontFamily: theme.fonts.bold }}>
          {initialsFromName(fallbackName)}
        </Text>
      </View>
    );
  };

  const renderMessageRow = ({ item }) => {
    if (item.type === "divider") {
      return (
        <View style={styles.dividerWrap}>
          <Text
            style={[
              styles.dividerText,
              { color: theme.colors.textMuted, fontFamily: theme.fonts.medium },
            ]}
          >
            {item.label}
          </Text>
        </View>
      );
    }

    const row = item.payload;
    const own = Number(row.sender_id) === Number(userId);
    const mediaUrl = resolveMediaUrl(row.attachment_url);
    const imageAttachment = isImageAttachment(row.attachment_type, mediaUrl);

    return (
      <View style={[styles.messageRow, own ? styles.right : styles.left]}>
        {!own ? (
          <View style={styles.avatarWrap}>
            {renderAvatar(partnerAvatar, selectedPartner?.name || t("support"))}
          </View>
        ) : null}

        <View
          style={[
            styles.messageBubble,
            {
              borderColor: theme.colors.border,
              backgroundColor: own ? theme.colors.rowAlt : theme.colors.surface,
            },
          ]}
        >
          {mediaUrl && imageAttachment ? (
            <Pressable onPress={() => setViewerImageUrl(mediaUrl)} style={styles.imageWrap}>
              <Image source={{ uri: mediaUrl }} style={styles.image} resizeMode="cover" />
            </Pressable>
          ) : null}

          {mediaUrl && !imageAttachment ? (
            <Pressable
              onPress={() => openAttachment(mediaUrl)}
              style={[
                styles.fileBubble,
                {
                  borderColor: theme.colors.border,
                  backgroundColor: theme.colors.rowAlt,
                },
              ]}
            >
              <Text
                style={[
                  styles.fileName,
                  { color: theme.colors.text, fontFamily: theme.fonts.medium },
                ]}
                numberOfLines={1}
              >
                {getAttachmentName(row)}
              </Text>
              <Text
                style={[
                  styles.fileHint,
                  { color: theme.colors.textMuted, fontFamily: theme.fonts.regular },
                ]}
              >
                {t("openFile")}
              </Text>
            </Pressable>
          ) : null}

          {row.message ? (
            <Text
              style={[
                styles.messageText,
                { color: theme.colors.text, fontFamily: theme.fonts.regular },
              ]}
            >
              {row.message}
            </Text>
          ) : null}

          <Text
            style={[styles.timeText, { color: theme.colors.textMuted, fontFamily: theme.fonts.regular }]}
          >
            {formatTime(row.created_at)}
          </Text>
        </View>

        {own ? <View style={styles.avatarWrap}>{renderAvatar(ownAvatar, t("profile"))}</View> : null}
      </View>
    );
  };

  return (
    <ScreenLayout scroll={false} contentContainerStyle={styles.screen} avoidKeyboard={false}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={keyboardBehavior}
        keyboardVerticalOffset={Platform.OS === "ios" ? headerHeight : 0}
      >
        {isAdmin ? (
          <View style={styles.contactsStripWrap}>
            <FlatList
              data={contacts}
              keyExtractor={(item) => `support-contact-${item.id}`}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.contactsStrip}
              renderItem={({ item: contact }) => {
                const active = Number(selectedPartnerId) === Number(contact.id);
                const avatar = resolveMediaUrl(contact.avatar_url);
                return (
                  <Pressable
                    onPress={() => setSelectedPartnerId(String(contact.id))}
                    style={[
                      styles.contactChip,
                      {
                        borderColor: active ? theme.colors.primary : theme.colors.border,
                        backgroundColor: active ? theme.colors.rowAlt : theme.colors.surface,
                      },
                    ]}
                  >
                    <View style={styles.contactAvatarWrap}>
                      {renderAvatar(avatar, contact.name)}
                    </View>
                    <Text
                      style={[
                        styles.contactChipText,
                        { color: theme.colors.text, fontFamily: theme.fonts.medium },
                      ]}
                      numberOfLines={1}
                    >
                      {contact.name}
                    </Text>
                  </Pressable>
                );
              }}
            />
          </View>
        ) : null}

        <FlatList
          ref={listRef}
          data={canSend ? threadItems : []}
          keyExtractor={(item) => item.id}
          renderItem={renderMessageRow}
          style={styles.list}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: 8 + Math.max(insets.bottom, 6) },
          ]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
          ListEmptyComponent={
            hasLoadedOnce && !loading ? (
              <Text
                style={[
                  styles.emptyText,
                  { color: theme.colors.textMuted, fontFamily: theme.fonts.regular },
                ]}
              >
                {canSend ? t("noData") : t("selectConversation")}
              </Text>
            ) : null
          }
        />

        <View
          style={[
            styles.composerWrap,
            {
              paddingBottom: Math.max(insets.bottom, 8),
              marginBottom: androidKeyboardOffset,
            },
          ]}
        >
          {pendingAttachment?.uri ? (
            <View
              style={[
                styles.pendingWrap,
                { borderColor: theme.colors.border, backgroundColor: theme.colors.surface },
              ]}
            >
              {String(pendingAttachment?.mimeType || "").startsWith("image/") ? (
                <Pressable onPress={() => setViewerImageUrl(pendingAttachment.uri)} style={styles.pendingImageWrap}>
                  <Image source={{ uri: pendingAttachment.uri }} style={styles.pendingImage} resizeMode="cover" />
                </Pressable>
              ) : (
                <View style={[styles.pendingFileWrap, { borderColor: theme.colors.border }]}>
                  <Text
                    style={[
                      styles.pendingFileName,
                      { color: theme.colors.text, fontFamily: theme.fonts.medium },
                    ]}
                    numberOfLines={1}
                  >
                    {pendingAttachment?.name || pendingAttachment?.fileName || "file"}
                  </Text>
                </View>
              )}

              <Pressable onPress={() => setPendingAttachment(null)} style={styles.removeBtn}>
                <Text style={[styles.removeText, { color: theme.colors.text, fontFamily: theme.fonts.bold }]}>
                  ×
                </Text>
              </Pressable>
            </View>
          ) : null}

          <View
            style={[
              styles.composerRow,
              { borderColor: theme.colors.border, backgroundColor: theme.colors.surface },
            ]}
          >
            <Pressable
              onPress={pickAttachment}
              disabled={!canSend}
              style={({ pressed }) => [
                styles.actionBtn,
                {
                  borderColor: theme.colors.border,
                  backgroundColor: theme.colors.rowAlt,
                  opacity: !canSend ? 0.4 : pressed ? 0.82 : 1,
                },
              ]}
            >
              <Text style={[styles.actionIcon, { color: theme.colors.text, fontFamily: theme.fonts.bold }]}>
                +
              </Text>
            </Pressable>

            <TextInput
              value={messageText}
              onChangeText={setMessageText}
              placeholder={t("typeMessage")}
              placeholderTextColor={theme.colors.textMuted}
              multiline
              onFocus={() => {
                setTimeout(() => listRef.current?.scrollToEnd?.({ animated: true }), 70);
              }}
              style={[styles.input, { color: theme.colors.text, fontFamily: theme.fonts.regular }]}
            />

            <Pressable
              onPress={onSend}
              disabled={sending || !canSend || (!messageText.trim() && !pendingAttachment)}
              style={({ pressed }) => [
                styles.sendBtn,
                {
                  backgroundColor: theme.colors.primary,
                  opacity:
                    sending || !canSend || (!messageText.trim() && !pendingAttachment)
                      ? 0.45
                      : pressed
                      ? 0.82
                      : 1,
                },
              ]}
            >
              <Text
                style={[styles.sendIcon, { color: theme.colors.onPrimary, fontFamily: theme.fonts.bold }]}
              >
                ➤
              </Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>

      <Modal
        visible={Boolean(viewerImageUrl)}
        transparent
        animationType="fade"
        onRequestClose={() => setViewerImageUrl("")}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setViewerImageUrl("")}>
          <Image source={{ uri: viewerImageUrl }} style={styles.modalImage} resizeMode="contain" />
        </Pressable>
      </Modal>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    padding: 0,
  },
  container: {
    flex: 1,
  },
  contactsStripWrap: {
    paddingTop: 6,
    paddingBottom: 4,
  },
  contactsStrip: {
    paddingHorizontal: 10,
    gap: 8,
  },
  contactChip: {
    borderWidth: 1,
    borderRadius: 14,
    minHeight: 46,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    maxWidth: 250,
  },
  contactAvatarWrap: {
    marginRight: 8,
  },
  contactChipText: {
    fontSize: 13,
    flexShrink: 1,
  },
  list: {
    flex: 1,
    paddingHorizontal: 12,
  },
  listContent: {
    paddingTop: 8,
  },
  emptyText: {
    marginTop: 24,
    textAlign: "center",
    fontSize: 13,
  },
  dividerWrap: {
    alignItems: "center",
    marginVertical: 6,
  },
  dividerText: {
    fontSize: 12,
  },
  messageRow: {
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "flex-end",
  },
  left: {
    justifyContent: "flex-start",
  },
  right: {
    justifyContent: "flex-end",
  },
  avatarWrap: {
    width: 30,
    height: 30,
    marginHorizontal: 6,
  },
  avatarImage: {
    width: 30,
    height: 30,
    borderRadius: 15,
  },
  avatarFallback: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  messageBubble: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 8,
    maxWidth: "80%",
  },
  imageWrap: {
    width: 220,
    height: 220,
    borderRadius: 10,
    overflow: "hidden",
    marginBottom: 6,
  },
  image: {
    width: "100%",
    height: "100%",
  },
  fileBubble: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 6,
    maxWidth: 230,
  },
  fileName: {
    fontSize: 13,
    marginBottom: 2,
  },
  fileHint: {
    fontSize: 11,
  },
  messageText: {
    fontSize: 14,
    lineHeight: 20,
  },
  timeText: {
    marginTop: 4,
    fontSize: 11,
    textAlign: "right",
  },
  composerWrap: {
    paddingHorizontal: 10,
    paddingTop: 6,
    paddingBottom: 8,
  },
  pendingWrap: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 6,
    marginBottom: 8,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  pendingImageWrap: {
    width: 56,
    height: 56,
    borderRadius: 8,
    overflow: "hidden",
  },
  pendingImage: {
    width: "100%",
    height: "100%",
  },
  pendingFileWrap: {
    minWidth: 130,
    maxWidth: 210,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    justifyContent: "center",
  },
  pendingFileName: {
    fontSize: 12,
  },
  removeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  removeText: {
    fontSize: 24,
    lineHeight: 24,
  },
  composerRow: {
    borderWidth: 1,
    borderRadius: 24,
    paddingHorizontal: 8,
    paddingVertical: 6,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 6,
  },
  actionBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
  actionIcon: {
    fontSize: 20,
    lineHeight: 20,
  },
  input: {
    flex: 1,
    minHeight: 34,
    maxHeight: 120,
    paddingHorizontal: 4,
    paddingVertical: 6,
    fontSize: 15,
    textAlignVertical: "center",
  },
  sendBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
  sendIcon: {
    fontSize: 16,
    lineHeight: 16,
    marginLeft: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.88)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  modalImage: {
    width: "100%",
    height: "100%",
  },
});
