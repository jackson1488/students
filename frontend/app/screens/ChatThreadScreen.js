/**
 * Module: app/screens/ChatThreadScreen.js
 *
 * Purpose:
 * - Screen module for ChatThreadScreen. Handles state, data loading, and UI for this route.
 *
 * Module notes:
 * - Imports count: 14.
 * - This header is written for beginners: read purpose first, then function map below.
 *
 * Function map:
 * - ChatThreadScreen: Main React component or UI container exported by this file.
 * - resolveMediaUrl: Builds derived values and resolves runtime decisions.
 * - formatTime: Transforms input/output values to stable display or API format.
 * - dayKey: Helper function used by this module business logic.
 * - formatDayLabel: Transforms input/output values to stable display or API format.
 * - mergeMessages: Helper function used by this module business logic.
 * - normalizeMessages: Transforms input/output values to stable display or API format.
 * - hasRowChanges: Helper function used by this module business logic.
 * - initialsFromName: Helper function used by this module business logic.
 * - splitTextWithLinks: Helper function used by this module business logic.
 * - buildThreadItems: Builds derived values and resolves runtime decisions.
 * - isImageAttachment: Helper function used by this module business logic.
 * - getAttachmentName: Returns computed or fetched data for caller usage.
 * - shortPreview: Helper function used by this module business logic.
 * - pickAttachment: Helper function used by this module business logic.
 * - onSend: Callback function invoked by UI or navigation events.
 * - onDeleteForMe: Callback function invoked by UI or navigation events.
 * - openAttachment: Controls modal/sheet/screen visibility or navigation transition.
 * - confirmDeleteForMe: Helper function used by this module business logic.
 * - openWebView: Controls modal/sheet/screen visibility or navigation transition.
 * - renderAvatar: Builds and returns a UI fragment for rendering.
 * - renderMessageText: Builds and returns a UI fragment for rendering.
 * - renderRow: Builds and returns a UI fragment for rendering.
 * - leftAction: Helper function used by this module business logic.
 * - ownAvatar: Helper function used by this module business logic.
 * - chatTitle: Helper function used by this module business logic.
 * - loadConversation: Loads remote/local data and updates screen/component state.
 * - loadPartnerMeta: Loads remote/local data and updates screen/component state.
 * - matched: Helper function used by this module business logic.
 * - onShow: Callback function invoked by UI or navigation events.
 * - onHide: Callback function invoked by UI or navigation events.
 * - rowMap: Helper function used by this module business logic.
 * - threadItems: Helper function used by this module business logic.
 * - timer: Helper function used by this module business logic.
 * - canSend: Helper function used by this module business logic.
 * - onClearChat: Callback function invoked by UI or navigation events.
 */

import * as DocumentPicker from "expo-document-picker";
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
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
import { Swipeable } from "react-native-gesture-handler";
import { useHeaderHeight } from "@react-navigation/elements";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import OverflowMenu from "../components/OverflowMenu";
import ScreenLayout from "../components/ScreenLayout";
import usePolling from "../hooks/usePolling";
import { useAuth } from "../hooks/AuthContext";
import { useI18n } from "../hooks/I18nContext";
import { useThemeMode } from "../hooks/ThemeContext";
import { API_BASE_URL } from "../services/api";
import {
  clearChatForMe,
  deleteMessageForMe,
  fetchChatContacts,
  fetchGroupMessages,
  fetchMessages,
  sendGroupMessage,
  sendMessage,
} from "../services/chatService";

const LINK_REGEX = /(https?:\/\/[^\s]+)/gi;
const GROUP_GENERAL_SUBJECT = "__general__";

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

function hasRowChanges(prevRows, nextRows) {
  if (!Array.isArray(prevRows) || !Array.isArray(nextRows)) return true;
  if (prevRows.length !== nextRows.length) return true;

  for (let i = 0; i < prevRows.length; i += 1) {
    const prev = prevRows[i];
    const next = nextRows[i];
    if (!prev || !next) return true;
    if (Number(prev.id) !== Number(next.id)) return true;
    if (String(prev.message || "") !== String(next.message || "")) return true;
    if (String(prev.attachment_url || "") !== String(next.attachment_url || "")) return true;
    if (String(prev.attachment_type || "") !== String(next.attachment_type || "")) return true;
    if (Number(prev.reply_to_id || 0) !== Number(next.reply_to_id || 0)) return true;
    if (String(prev.deleted_marker || "") !== String(next.deleted_marker || "")) return true;
    if (Boolean(prev.is_deleted_any) !== Boolean(next.is_deleted_any)) return true;
  }

  return false;
}

function initialsFromName(value) {
  const src = String(value || "").trim();
  return src ? src.slice(0, 1).toUpperCase() : "U";
}

function splitTextWithLinks(text) {
  const source = String(text || "");
  if (!source) return [];

  const segments = [];
  let lastIndex = 0;

  source.replace(LINK_REGEX, (match, _unused, offset) => {
    if (offset > lastIndex) {
      segments.push({ type: "text", value: source.slice(lastIndex, offset) });
    }
    segments.push({ type: "link", value: match });
    lastIndex = offset + match.length;
    return match;
  });

  if (lastIndex < source.length) {
    segments.push({ type: "text", value: source.slice(lastIndex) });
  }

  return segments.length ? segments : [{ type: "text", value: source }];
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
  const existing = String(message?.attachment_name || "").trim();
  if (existing) return existing;

  const raw = String(message?.attachment_url || "").trim();
  if (!raw) return "file";

  const pathValue = raw.split("?")[0];
  const chunk = pathValue.split("/").pop() || "file";
  const decoded = decodeURIComponent(chunk);
  return decoded.includes("_") ? decoded.split("_").slice(1).join("_") : decoded;
}

function shortPreview(value) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (!text) return "";
  return text.length > 60 ? `${text.slice(0, 60)}...` : text;
}

export default function ChatThreadScreen({ navigation, route }) {
  const { t } = useI18n();
  const { theme } = useThemeMode();
  const { userId, role, avatarUrl } = useAuth();

  const partner = route?.params?.partner || null;
  const room = route?.params?.room || null;
  const isGroupChat = Boolean(room?.group_id && room?.subject);
  const partnerId = isGroupChat ? 0 : Number(partner?.id || 0);
  const roomGroupId = isGroupChat ? String(room?.group_id || "").trim() : "";
  const roomSubject = isGroupChat ? String(room?.subject || "").trim() : "";

  const [rows, setRows] = useState([]);
  const [partnerMeta, setPartnerMeta] = useState(partner || null);
  const [loading, setLoading] = useState(false);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [sending, setSending] = useState(false);
  const [messageText, setMessageText] = useState("");
  const [pendingAttachment, setPendingAttachment] = useState(null);
  const [replyTo, setReplyTo] = useState(null);
  const [viewerImageUrl, setViewerImageUrl] = useState("");
  const [androidKeyboardHeight, setAndroidKeyboardHeight] = useState(0);

  const listRef = useRef(null);
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();
  const keyboardBehavior = Platform.OS === "ios" ? "padding" : undefined;

  const ownAvatar = useMemo(() => resolveMediaUrl(avatarUrl), [avatarUrl]);
  const activePartner = partnerMeta || partner;
  const androidKeyboardOffset = Platform.OS === "android" ? androidKeyboardHeight : 0;

  const chatTitle = useMemo(() => {
    if (isGroupChat) {
      const explicitTitle = String(room?.title || "").trim();
      if (explicitTitle) return explicitTitle;
      if (String(roomSubject).toLowerCase() === GROUP_GENERAL_SUBJECT) {
        return `${roomGroupId} • ${t("groupChats")}`;
      }
      return `${roomGroupId} • ${roomSubject}`;
    }
    return String(activePartner?.name || "").trim() || t("conversation");
  }, [activePartner?.name, isGroupChat, room?.title, roomGroupId, roomSubject, t]);

  const loadConversation = useCallback(async () => {
    if (isGroupChat && (!roomGroupId || !roomSubject)) {
      setRows([]);
      return;
    }
    if (!isGroupChat && !partnerId) {
      setRows([]);
      return;
    }

    const shouldShowLoader = rows.length === 0 && !hasLoadedOnce;

    try {
      if (shouldShowLoader) {
        setLoading(true);
      }

      const data = isGroupChat
        ? await fetchGroupMessages(roomGroupId, roomSubject)
        : await fetchMessages(partnerId);
      const normalized = normalizeMessages(data);
      setRows((prev) => {
        return hasRowChanges(prev, normalized) ? normalized : prev;
      });
      setHasLoadedOnce(true);
    } catch {
      setHasLoadedOnce(true);
    } finally {
      if (shouldShowLoader) {
        setLoading(false);
      }
    }
  }, [hasLoadedOnce, isGroupChat, partnerId, roomGroupId, roomSubject, rows.length]);

  usePolling(loadConversation, 1000, [partnerId, roomGroupId, roomSubject, isGroupChat]);

  const loadPartnerMeta = useCallback(async () => {
    if (isGroupChat || !partnerId) return;

    try {
      const contacts = await fetchChatContacts();
      const rows = Array.isArray(contacts) ? contacts : [];
      const matched = rows.find((item) => Number(item.id) === Number(partnerId));
      if (!matched) return;

      setPartnerMeta((prev) => {
        const prevName = String(prev?.name || "");
        const prevAvatar = String(prev?.avatar_url || "");
        const prevGroup = String(prev?.group_id || "");
        const nextName = String(matched?.name || "");
        const nextAvatar = String(matched?.avatar_url || "");
        const nextGroup = String(matched?.group_id || "");

        if (prevName === nextName && prevAvatar === nextAvatar && prevGroup === nextGroup) {
          return prev || matched;
        }
        return { ...(prev || {}), ...matched };
      });
    } catch {
      // ignore polling errors
    }
  }, [isGroupChat, partnerId]);

  usePolling(loadPartnerMeta, 1000, [isGroupChat, partnerId]);

  useEffect(() => {
    setRows([]);
    setHasLoadedOnce(false);
    setMessageText("");
    setPendingAttachment(null);
    setReplyTo(null);
    setPartnerMeta(partner || null);
  }, [isGroupChat, partner, partnerId, roomGroupId, roomSubject]);

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

  const rowMap = useMemo(() => {
    const map = new Map();
    rows.forEach((row) => {
      map.set(Number(row.id), row);
    });
    return map;
  }, [rows]);

  const threadItems = useMemo(() => buildThreadItems(rows, t), [rows, t]);

  useEffect(() => {
    if (!threadItems.length) return;

    const timer = setTimeout(() => {
      listRef.current?.scrollToEnd?.({ animated: true });
    }, 30);

    return () => clearTimeout(timer);
  }, [threadItems.length]);

  const canSend = useMemo(() => {
    if (role === "admin") return false;
    if (isGroupChat) return Boolean(roomGroupId && roomSubject);
    return Boolean(partnerId);
  }, [isGroupChat, partnerId, role, roomGroupId, roomSubject]);

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
      const row = isGroupChat
        ? await sendGroupMessage({
            group_id: roomGroupId,
            subject: roomSubject,
            message: cleanMessage,
            attachmentAsset: pendingAttachment,
          })
        : await sendMessage({
            receiver_id: partnerId,
            message: cleanMessage,
            attachmentAsset: pendingAttachment,
            reply_to_id: replyTo?.id,
          });

      if (row) {
        setRows((prev) => mergeMessages(prev, [row]));
        setMessageText("");
        setPendingAttachment(null);
        if (!isGroupChat) {
          setReplyTo(null);
        }
      }
    } catch (error) {
      Alert.alert(t("chat"), error?.response?.data?.error || t("unknownError"));
    } finally {
      setSending(false);
    }
  };

  const onDeleteForMe = async (messageId) => {
    if (isGroupChat) return;

    try {
      await deleteMessageForMe(messageId);
      setRows((prev) => prev.filter((row) => Number(row.id) !== Number(messageId)));
      if (Number(replyTo?.id) === Number(messageId)) {
        setReplyTo(null);
      }
    } catch (error) {
      Alert.alert(t("chat"), error?.response?.data?.error || t("unknownError"));
    }
  };

  const confirmDeleteForMe = (messageId) => {
    if (role === "admin" || isGroupChat) {
      return;
    }

    Alert.alert(t("chat"), t("deleteForMe"), [
      { text: t("cancel"), style: "cancel" },
      { text: t("delete"), style: "destructive", onPress: () => onDeleteForMe(messageId) },
    ]);
  };

  const onClearChat = useCallback(async () => {
    if (role === "admin" || isGroupChat) {
      return;
    }
    if (!partnerId) {
      return;
    }

    try {
      await clearChatForMe(partnerId);
      setRows([]);
      setReplyTo(null);
    } catch (error) {
      Alert.alert(t("chat"), error?.response?.data?.error || t("unknownError"));
    }
  }, [isGroupChat, partnerId, role, t]);

  const clearChatDisabled = role === "admin" || !partnerId || isGroupChat;

  useLayoutEffect(() => {
    navigation.setOptions({
      title: chatTitle,
      headerRight: () => (
        clearChatDisabled ? null : (
          <OverflowMenu
            buttonHint={t("actions")}
            options={[{ key: "clear-chat", label: t("clearChat"), onPress: onClearChat }]}
          />
        )
      ),
    });
  }, [chatTitle, clearChatDisabled, navigation, onClearChat, t]);

  const openWebView = (url) => {
    navigation.navigate("ChatWebView", {
      url,
      title: t("chatLink"),
    });
  };

  const openAttachment = async (url) => {
    if (!url) return;

    if (Platform.OS === "web" && typeof window !== "undefined") {
      window.open(url, "_blank", "noopener,noreferrer");
      return;
    }

    const canOpen = await Linking.canOpenURL(url);
    if (!canOpen) {
      Alert.alert(t("chat"), t("fileOpenUnavailable"));
      return;
    }

    await Linking.openURL(url);
  };

  const renderAvatar = (uri, fallbackName) => {
    if (uri) {
      return <Image source={{ uri }} style={styles.avatarImage} resizeMode="cover" />;
    }

    return (
      <View style={[styles.avatarFallback, { borderColor: theme.colors.border, backgroundColor: theme.colors.rowAlt }]}> 
        <Text style={{ color: theme.colors.text, fontFamily: theme.fonts.bold }}>{initialsFromName(fallbackName)}</Text>
      </View>
    );
  };

  const renderMessageText = (text) => {
    const segments = splitTextWithLinks(text);
    if (!segments.length) return null;

    return (
      <Text style={[styles.messageText, { color: theme.colors.text, fontFamily: theme.fonts.regular }]}> 
        {segments.map((segment, index) => {
          if (segment.type === "link") {
            return (
              <Text
                key={`link-${index}`}
                onPress={() => openWebView(segment.value)}
                style={[styles.linkText, { color: theme.colors.text }]}
              >
                {segment.value}
              </Text>
            );
          }
          return <Text key={`text-${index}`}>{segment.value}</Text>;
        })}
      </Text>
    );
  };

  const renderRow = ({ item }) => {
    if (item.type === "divider") {
      return (
        <View style={styles.dividerWrap}>
          <Text style={[styles.dividerText, { color: theme.colors.textMuted, fontFamily: theme.fonts.medium }]}>{item.label}</Text>
        </View>
      );
    }

    const message = item.payload;
    const own = Number(message.sender_id) === Number(userId);
    const mediaUrl = resolveMediaUrl(message.attachment_url);
    const imageAttachment = isImageAttachment(message.attachment_type, mediaUrl);
    const attachmentName = getAttachmentName(message);

    const partnerName = activePartner?.name || "-";
    const partnerAvatar = resolveMediaUrl(activePartner?.avatar_url);
    const senderName = isGroupChat ? String(message.sender_name || message.sender_login || "").trim() || "-" : partnerName;
    const senderAvatar = isGroupChat ? resolveMediaUrl(message.sender_avatar_url) : partnerAvatar;

    const repliedRow = !isGroupChat && message.reply_to_id ? rowMap.get(Number(message.reply_to_id)) : null;

    let swipeRef = null;
    const leftAction = () => (
      <View style={styles.replyAction}>
        <Text style={[styles.replyActionText, { color: theme.colors.text, fontFamily: theme.fonts.medium }]}>↩</Text>
      </View>
    );

    return (
      <Swipeable
        ref={(instance) => {
          swipeRef = instance;
        }}
        enabled={canSend && !isGroupChat}
        renderLeftActions={leftAction}
        onSwipeableOpen={(direction) => {
          if (direction === "left") {
            setReplyTo(message);
            swipeRef?.close();
          }
        }}
    >
        <View style={[styles.messageRow, own ? styles.right : styles.left]}>
          {!own ? <View style={styles.avatarWrap}>{renderAvatar(senderAvatar, senderName)}</View> : null}

          <Pressable
            onLongPress={() => confirmDeleteForMe(message.id)}
            delayLongPress={650}
            disabled={role === "admin" || isGroupChat}
            style={[
              styles.messageBubble,
              {
                borderColor: theme.colors.border,
                backgroundColor: own ? theme.colors.rowAlt : theme.colors.surface,
              },
            ]}
          >
            {role === "admin" && message.is_deleted_any ? (
              <Text style={[styles.deletedMark, { color: theme.colors.textMuted, fontFamily: theme.fonts.medium }]}> 
                {t("deletedMessage")}
              </Text>
            ) : null}

            {isGroupChat && !own ? (
              <Text style={[styles.senderName, { color: theme.colors.textMuted, fontFamily: theme.fonts.medium }]}>
                {senderName}
              </Text>
            ) : null}

            {repliedRow ? (
              <View style={[styles.replyMini, { borderColor: theme.colors.border, backgroundColor: theme.colors.rowAlt }]}> 
                <Text style={[styles.replyMiniText, { color: theme.colors.textMuted, fontFamily: theme.fonts.regular }]} numberOfLines={1}>
                  {shortPreview(repliedRow.message || getAttachmentName(repliedRow))}
                </Text>
              </View>
            ) : null}

            {mediaUrl && imageAttachment ? (
              <Pressable onPress={() => setViewerImageUrl(mediaUrl)} style={styles.imageWrap}>
                <Image source={{ uri: mediaUrl }} style={styles.image} resizeMode="cover" />
              </Pressable>
            ) : null}

            {mediaUrl && !imageAttachment ? (
              <Pressable
                onPress={() => openAttachment(mediaUrl)}
                style={[styles.fileBubble, { borderColor: theme.colors.border, backgroundColor: theme.colors.rowAlt }]}
              >
                <Text style={[styles.fileLabel, { color: theme.colors.text, fontFamily: theme.fonts.medium }]} numberOfLines={1}>
                  {attachmentName}
                </Text>
                <Text style={[styles.fileHint, { color: theme.colors.textMuted, fontFamily: theme.fonts.regular }]}> 
                  {t("openFile")}
                </Text>
              </Pressable>
            ) : null}

            {message.message ? renderMessageText(message.message) : null}

            <Text style={[styles.timeText, { color: theme.colors.textMuted, fontFamily: theme.fonts.regular }]}> 
              {formatTime(message.created_at)}
            </Text>
          </Pressable>

          {own ? <View style={styles.avatarWrap}>{renderAvatar(ownAvatar, t("profile"))}</View> : null}
        </View>
      </Swipeable>
    );
  };

  return (
    <ScreenLayout scroll={false} contentContainerStyle={styles.screen} avoidKeyboard={false}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={keyboardBehavior}
        keyboardVerticalOffset={Platform.OS === "ios" ? headerHeight : 0}
      >
        <FlatList
          ref={listRef}
          data={threadItems}
          keyExtractor={(row) => row.id}
          renderItem={renderRow}
          style={styles.list}
          contentContainerStyle={[styles.listContent, { paddingBottom: 10 + Math.max(insets.bottom, 6) }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
          ListEmptyComponent={
            hasLoadedOnce && !loading ? (
              <Text style={[styles.emptyText, { color: theme.colors.textMuted, fontFamily: theme.fonts.regular }]}> 
                {t("noData")}
              </Text>
            ) : null
          }
        />

        {canSend ? (
          <View
            style={[
              styles.composerWrap,
              {
                paddingBottom: Math.max(insets.bottom, 8),
                marginBottom: androidKeyboardOffset,
              },
            ]}
          >
          {replyTo ? (
            <View style={[styles.replyBox, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}> 
              <View style={styles.replyContent}>
                <Text style={[styles.replyLabel, { color: theme.colors.textMuted, fontFamily: theme.fonts.medium }]}> 
                  {t("replyTo")}
                </Text>
                <Text style={[styles.replyText, { color: theme.colors.text, fontFamily: theme.fonts.regular }]} numberOfLines={1}>
                  {shortPreview(replyTo.message || getAttachmentName(replyTo))}
                </Text>
              </View>
              <Pressable onPress={() => setReplyTo(null)} style={styles.replyClose}>
                <Text style={[styles.replyCloseText, { color: theme.colors.text, fontFamily: theme.fonts.bold }]}>×</Text>
              </Pressable>
            </View>
          ) : null}

          {pendingAttachment?.uri ? (
            <View style={[styles.pendingBox, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}> 
              {String(pendingAttachment?.mimeType || "").startsWith("image/") ? (
                <Pressable onPress={() => setViewerImageUrl(pendingAttachment.uri)} style={styles.pendingImageWrap}>
                  <Image source={{ uri: pendingAttachment.uri }} style={styles.pendingImage} resizeMode="cover" />
                </Pressable>
              ) : (
                <View style={[styles.pendingFileWrap, { borderColor: theme.colors.border }]}> 
                  <Text style={[styles.pendingFileName, { color: theme.colors.text, fontFamily: theme.fonts.medium }]} numberOfLines={1}>
                    {pendingAttachment?.name || pendingAttachment?.fileName || "file"}
                  </Text>
                </View>
              )}

              <Pressable onPress={() => setPendingAttachment(null)} style={styles.removeBtn}>
                <Text style={[styles.removeText, { color: theme.colors.text, fontFamily: theme.fonts.medium }]}>×</Text>
              </Pressable>
            </View>
          ) : null}

          <View style={[styles.composerRow, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}> 
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
              <Text style={[styles.actionIcon, { color: theme.colors.text, fontFamily: theme.fonts.bold }]}>+</Text>
            </Pressable>

            <TextInput
              value={messageText}
              onChangeText={setMessageText}
              placeholder={t("typeMessage")}
              placeholderTextColor={theme.colors.textMuted}
              multiline
              onFocus={() => {
                setTimeout(() => listRef.current?.scrollToEnd?.({ animated: true }), 60);
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
                  opacity: sending || !canSend || (!messageText.trim() && !pendingAttachment) ? 0.45 : pressed ? 0.82 : 1,
                },
              ]}
            >
              <Text style={[styles.sendIcon, { color: theme.colors.onPrimary, fontFamily: theme.fonts.bold }]}>➤</Text>
            </Pressable>
          </View>
          </View>
        ) : (
          <View
            style={[
              styles.readonlyWrap,
              {
                paddingBottom: Math.max(insets.bottom, 8),
                marginBottom: androidKeyboardOffset,
              },
            ]}
          >
            <Text style={[styles.readonlyText, { color: theme.colors.textMuted, fontFamily: theme.fonts.regular }]}>
              {t("adminDirectChatReadonly")}
            </Text>
          </View>
        )}
      </KeyboardAvoidingView>

      <Modal visible={Boolean(viewerImageUrl)} transparent animationType="fade" onRequestClose={() => setViewerImageUrl("")}> 
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
  list: {
    flex: 1,
    paddingHorizontal: 12,
  },
  listContent: {
    paddingTop: 6,
    paddingBottom: 8,
  },
  emptyText: {
    fontSize: 13,
    textAlign: "center",
    marginTop: 20,
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
    maxWidth: "78%",
  },
  deletedMark: {
    fontSize: 11,
    marginBottom: 4,
  },
  senderName: {
    fontSize: 11,
    marginBottom: 4,
  },
  replyMini: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
    marginBottom: 6,
  },
  replyMiniText: {
    fontSize: 11,
  },
  imageWrap: {
    width: 200,
    height: 200,
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
    maxWidth: 220,
  },
  fileLabel: {
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
  linkText: {
    textDecorationLine: "underline",
  },
  timeText: {
    marginTop: 4,
    fontSize: 11,
    textAlign: "right",
  },
  replyAction: {
    width: 52,
    alignItems: "center",
    justifyContent: "center",
  },
  replyActionText: {
    fontSize: 22,
  },
  composerWrap: {
    paddingHorizontal: 10,
    paddingTop: 6,
    paddingBottom: 8,
  },
  readonlyWrap: {
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  readonlyText: {
    fontSize: 12,
  },
  replyBox: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  replyContent: {
    flex: 1,
  },
  replyLabel: {
    fontSize: 11,
    marginBottom: 2,
  },
  replyText: {
    fontSize: 12,
  },
  replyClose: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  replyCloseText: {
    fontSize: 20,
    lineHeight: 20,
  },
  pendingBox: {
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
