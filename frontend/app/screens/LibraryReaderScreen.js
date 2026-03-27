import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Linking, Platform, StyleSheet, Text, View } from "react-native";
import { WebView } from "react-native-webview";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import AppButton from "../components/AppButton";
import ScreenLayout from "../components/ScreenLayout";
import { useAuth } from "../hooks/AuthContext";
import { useI18n } from "../hooks/I18nContext";
import { useThemeMode } from "../hooks/ThemeContext";
import { upsertBookShelfItem } from "../services/contentService";

function normalizeUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;
  return `https://${raw}`;
}

function buildReaderUrl(url, format, source) {
  const normalized = normalizeUrl(url);
  if (!normalized) return "";

  const normalizedSource = String(source || "").trim().toLowerCase();
  if (normalizedSource === "local") {
    return normalized;
  }

  const normalizedFormat = String(format || "").trim().toLowerCase();
  if (["pdf", "doc", "docx", "rtf", "epub", "fb2"].includes(normalizedFormat)) {
    return `https://docs.google.com/gview?embedded=1&url=${encodeURIComponent(normalized)}`;
  }

  return normalized;
}

export default function LibraryReaderScreen({ navigation, route }) {
  const { t } = useI18n();
  const { theme } = useThemeMode();
  const { token } = useAuth();
  const insets = useSafeAreaInsets();

  const book = route?.params?.book || {};
  const title = String(book?.title || t("library")).trim();
  const source = String(book?.source || "openlibrary").trim();
  const bookKey = String(book?.book_key || "").trim();
  const readerUrl = useMemo(
    () => buildReaderUrl(book?.reader_url || book?.file || book?.details_url, book?.format, book?.source),
    [book]
  );
  const sourceUrl = useMemo(() => normalizeUrl(book?.reader_url || book?.file || book?.details_url), [book]);
  const webViewSource = useMemo(() => {
    if (!readerUrl) return null;
    if (source === "local" && token) {
      return { uri: readerUrl, headers: { Authorization: `Bearer ${token}` } };
    }
    return { uri: readerUrl };
  }, [readerUrl, source, token]);

  const [isFavorite, setIsFavorite] = useState(Boolean(book?.is_favorite || book?.shelf?.is_favorite));
  const [isRead, setIsRead] = useState(Boolean(book?.is_read || book?.shelf?.is_read));
  const [hasBookmark, setHasBookmark] = useState(Boolean(book?.bookmark_url || book?.shelf?.bookmark_url));
  const [savingAction, setSavingAction] = useState("");
  const [webBlobReaderUrl, setWebBlobReaderUrl] = useState("");
  const [webReaderLoading, setWebReaderLoading] = useState(false);
  const [webReaderError, setWebReaderError] = useState("");

  const saveShelf = useCallback(
    async (patch) => {
      if (!bookKey) return;
      setSavingAction(String(patch?.action || "saving"));
      try {
        await upsertBookShelfItem({
          source,
          book_key: bookKey,
          title: String(book?.title || "").trim(),
          author: String(book?.author || "").trim(),
          description: String(book?.description || "").trim(),
          cover_url: String(book?.cover_url || "").trim(),
          reader_url: sourceUrl,
          genre: String(book?.genre || "").trim(),
          ...patch,
        });
      } finally {
        setSavingAction("");
      }
    },
    [book, bookKey, source, sourceUrl]
  );

  useEffect(() => {
    if (!bookKey) return;
    saveShelf({ opened: true, action: "opened" });
  }, [bookKey, saveShelf]);

  const onToggleFavorite = async () => {
    const next = !isFavorite;
    setIsFavorite(next);
    await saveShelf({ is_favorite: next, action: "favorite" });
  };

  const onToggleRead = async () => {
    const next = !isRead;
    setIsRead(next);
    await saveShelf({ is_read: next, action: "read" });
  };

  const onToggleBookmark = async () => {
    const next = !hasBookmark;
    setHasBookmark(next);
    await saveShelf({
      bookmark_url: next ? sourceUrl : "",
      bookmark_note: next ? new Date().toISOString() : "",
      action: "bookmark",
    });
  };

  useEffect(() => {
    if (Platform.OS !== "web") return undefined;
    if (source !== "local") {
      setWebBlobReaderUrl("");
      setWebReaderLoading(false);
      setWebReaderError("");
      return undefined;
    }

    const targetUrl = sourceUrl || readerUrl;
    if (!targetUrl || !token) {
      setWebBlobReaderUrl("");
      setWebReaderLoading(false);
      setWebReaderError(t("libraryReaderUnavailable"));
      return undefined;
    }

    let isCancelled = false;
    let objectUrl = "";

    const run = async () => {
      setWebReaderLoading(true);
      setWebReaderError("");
      try {
        const response = await fetch(targetUrl, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        if (!response.ok) {
          throw new Error(`HTTP_${response.status}`);
        }
        const fileBlob = await response.blob();
        objectUrl = URL.createObjectURL(fileBlob);
        if (isCancelled) {
          URL.revokeObjectURL(objectUrl);
          return;
        }
        setWebBlobReaderUrl(objectUrl);
      } catch {
        if (!isCancelled) {
          setWebBlobReaderUrl("");
          setWebReaderError(t("libraryReaderUnavailable"));
        }
      } finally {
        if (!isCancelled) {
          setWebReaderLoading(false);
        }
      }
    };

    void run();

    return () => {
      isCancelled = true;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [readerUrl, source, sourceUrl, t, token]);

  if (!readerUrl) {
    return (
      <ScreenLayout>
        <Text style={[styles.emptyText, { color: theme.colors.textMuted, fontFamily: theme.fonts.regular }]}>
          {t("libraryReaderUnavailable")}
        </Text>
      </ScreenLayout>
    );
  }

  if (Platform.OS === "web") {
    const webReaderUrl = source === "local" ? webBlobReaderUrl : readerUrl;

    return (
      <View style={[styles.fullScreen, { backgroundColor: theme.colors.background }]}>
        {webReaderLoading ? (
          <View style={styles.webLoadingWrap}>
            <ActivityIndicator size="small" color={theme.colors.text} />
          </View>
        ) : webReaderUrl ? (
          <WebView source={{ uri: webReaderUrl }} style={styles.webview} startInLoadingState />
        ) : (
          <View style={styles.webLoadingWrap}>
            <Text style={[styles.emptyText, { color: theme.colors.textMuted, fontFamily: theme.fonts.regular }]}>
              {webReaderError || t("libraryReaderUnavailable")}
            </Text>
          </View>
        )}

        <View
          style={[
            styles.webOverlayControls,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
            },
          ]}
        >
          <AppButton title={t("libraryBack")} onPress={() => navigation.goBack()} variant="ghost" style={styles.webOverlayButton} />
          <AppButton
            title={isFavorite ? t("libraryUnfavoriteShort") : t("libraryFavoriteShort")}
            onPress={onToggleFavorite}
            variant={isFavorite ? "primary" : "ghost"}
            loading={savingAction === "favorite"}
            style={styles.webOverlayButton}
          />
          <AppButton
            title={hasBookmark ? t("libraryUnbookmarkShort") : t("libraryBookmarkShort")}
            onPress={onToggleBookmark}
            variant={hasBookmark ? "primary" : "ghost"}
            loading={savingAction === "bookmark"}
            style={styles.webOverlayButton}
          />
          <AppButton
            title={isRead ? t("libraryUnreadShort") : t("libraryReadShort")}
            onPress={onToggleRead}
            variant={isRead ? "primary" : "ghost"}
            loading={savingAction === "read"}
            style={styles.webOverlayButton}
          />
          <AppButton
            title={t("libraryOpenExternal")}
            onPress={() => Linking.openURL(sourceUrl || readerUrl)}
            variant="ghost"
            style={styles.webOverlayButtonWide}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.fullScreen, { backgroundColor: theme.colors.background }]}>
      <View
        style={[
          styles.topBar,
          {
            borderBottomColor: theme.colors.border,
            backgroundColor: theme.colors.surface,
            paddingTop: Math.max(insets.top, 8),
          },
        ]}
      >
        <AppButton title={t("libraryBack")} onPress={() => navigation.goBack()} variant="ghost" style={styles.backButton} />
        <Text style={[styles.title, { color: theme.colors.text, fontFamily: theme.fonts.bold }]} numberOfLines={1}>
          {title}
        </Text>
      </View>

      <View style={[styles.actionsRow, { borderBottomColor: theme.colors.border, backgroundColor: theme.colors.surface }]}>
        <AppButton
          title={isFavorite ? t("libraryRemoveFavorite") : t("libraryAddFavorite")}
          onPress={onToggleFavorite}
          variant={isFavorite ? "primary" : "ghost"}
          loading={savingAction === "favorite"}
          style={styles.actionButton}
        />
        <AppButton
          title={hasBookmark ? t("libraryRemoveBookmark") : t("libraryAddBookmark")}
          onPress={onToggleBookmark}
          variant={hasBookmark ? "primary" : "ghost"}
          loading={savingAction === "bookmark"}
          style={styles.actionButton}
        />
        <AppButton
          title={isRead ? t("libraryUnmarkRead") : t("libraryMarkRead")}
          onPress={onToggleRead}
          variant={isRead ? "primary" : "ghost"}
          loading={savingAction === "read"}
          style={styles.actionButton}
        />
      </View>
      <WebView source={webViewSource || { uri: readerUrl }} style={styles.webview} startInLoadingState />
    </View>
  );
}

const styles = StyleSheet.create({
  fullScreen: {
    flex: 1,
  },
  topBar: {
    borderBottomWidth: 1,
    paddingHorizontal: 10,
    paddingBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  backButton: {
    minHeight: 34,
    minWidth: 72,
    paddingHorizontal: 8,
  },
  title: {
    flex: 1,
    fontSize: 15,
  },
  webview: {
    flex: 1,
  },
  actionsRow: {
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  actionButton: {
    flex: 1,
    minHeight: 36,
    paddingHorizontal: 8,
  },
  webLoadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  webOverlayControls: {
    position: "absolute",
    top: 10,
    left: 10,
    right: 10,
    borderWidth: 1,
    borderRadius: 12,
    padding: 6,
    flexDirection: "row",
    gap: 6,
    flexWrap: "wrap",
    alignItems: "center",
  },
  webOverlayButton: {
    minHeight: 32,
    paddingHorizontal: 10,
  },
  webOverlayButtonWide: {
    minHeight: 32,
    paddingHorizontal: 10,
  },
  emptyText: {
    fontSize: 14,
  },
});
