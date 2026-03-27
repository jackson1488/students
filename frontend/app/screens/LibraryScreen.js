import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  BackHandler,
  FlatList,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import * as DocumentPicker from "expo-document-picker";

import AppButton from "../components/AppButton";
import AppCard from "../components/AppCard";
import AppInput from "../components/AppInput";
import ScreenLayout from "../components/ScreenLayout";
import { useAuth } from "../hooks/AuthContext";
import { useI18n } from "../hooks/I18nContext";
import { useThemeMode } from "../hooks/ThemeContext";
import {
  createBook,
  fetchBookCatalog,
  fetchBooks,
  fetchBookShelf,
  fetchLibraryMode,
  updateLibraryMode,
  upsertBookShelfItem,
} from "../services/contentService";

const DEFAULT_QUERY = "программирование";
const DEFAULT_LIMIT = 15;
const LIBRARY_MODE_CATALOG = "catalog";
const LIBRARY_MODE_CUSTOM = "custom";

function normalizeBookKey(item) {
  const source = String(item?.source || "openlibrary").trim();
  const key = String(item?.book_key || item?.id || "").trim();
  return `${source}:${key}`;
}

function normalizeBook(item) {
  return {
    source: String(item?.source || "openlibrary").trim(),
    book_key: String(item?.book_key || "").trim(),
    title: String(item?.title || "").trim(),
    author: String(item?.author || "").trim(),
    description: String(item?.description || "").trim(),
    cover_url: String(item?.cover_url || "").trim() || null,
    reader_url: String(item?.reader_url || item?.file || "").trim() || null,
    details_url: String(item?.details_url || "").trim() || null,
    genre: String(item?.genre || "").trim() || null,
    subjects: Array.isArray(item?.subjects) ? item.subjects.map((row) => String(row || "").trim()).filter(Boolean) : [],
    format: String(item?.format || "web").trim().toLowerCase(),
    publish_year: item?.publish_year || null,
    local_book_id: item?.local_book_id || item?.id || null,
    created_at: item?.created_at || null,
    is_favorite: Boolean(item?.is_favorite),
    is_read: Boolean(item?.is_read),
    bookmark_url: String(item?.bookmark_url || "").trim() || null,
  };
}

function normalizeShelfToBook(item) {
  return normalizeBook({
    source: item?.source,
    book_key: item?.book_key,
    title: item?.title,
    author: item?.author,
    description: item?.description,
    cover_url: item?.cover_url,
    reader_url: item?.reader_url,
    genre: item?.genre,
    format: "web",
    is_favorite: item?.is_favorite,
    is_read: item?.is_read,
    bookmark_url: item?.bookmark_url,
  });
}

function filterLocalByQuery(list, query, genre) {
  const normalizedQuery = String(query || "").trim().toLowerCase();
  const normalizedGenre = String(genre || "").trim().toLowerCase();

  return (Array.isArray(list) ? list : []).filter((item) => {
    if (normalizedGenre) {
      const itemGenre = String(item?.genre || "").trim().toLowerCase();
      const subjectMatch = (item?.subjects || []).some((row) => String(row || "").trim().toLowerCase() === normalizedGenre);
      if (itemGenre !== normalizedGenre && !subjectMatch) {
        return false;
      }
    }

    if (!normalizedQuery) {
      return true;
    }

    const haystack = `${item?.title || ""} ${item?.author || ""} ${item?.description || ""}`.toLowerCase();
    return haystack.includes(normalizedQuery);
  });
}

function normalizeLibraryMode(value) {
  return String(value || "").trim().toLowerCase() === LIBRARY_MODE_CATALOG
    ? LIBRARY_MODE_CATALOG
    : LIBRARY_MODE_CUSTOM;
}

function buildPageTokens(page, totalPages) {
  const currentPage = Number(page) || 1;
  const total = Number(totalPages) || 1;

  if (total <= 7) {
    return Array.from({ length: total }, (_, index) => index + 1);
  }

  const tokens = [1];
  const start = Math.max(2, currentPage - 1);
  const end = Math.min(total - 1, currentPage + 1);

  if (start > 2) tokens.push("left-gap");
  for (let value = start; value <= end; value += 1) {
    tokens.push(value);
  }
  if (end < total - 1) tokens.push("right-gap");

  tokens.push(total);
  return tokens;
}

export default function LibraryScreen({ navigation }) {
  const { t } = useI18n();
  const { theme } = useThemeMode();
  const { role } = useAuth();
  const { width } = useWindowDimensions();

  const canCreate = role === "scheduler" || role === "admin";
  const canToggleMode = role === "admin";
  const numColumns = width >= 920 ? 3 : width >= 600 ? 2 : 1;

  const [catalogItems, setCatalogItems] = useState([]);
  const [catalogTotal, setCatalogTotal] = useState(0);
  const [localItems, setLocalItems] = useState([]);
  const [shelfItems, setShelfItems] = useState([]);
  const [genres, setGenres] = useState([]);
  const [loading, setLoading] = useState(false);
  const [queryInput, setQueryInput] = useState(DEFAULT_QUERY);
  const [queryValue, setQueryValue] = useState(DEFAULT_QUERY);
  const [selectedGenre, setSelectedGenre] = useState("");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [activeSection, setActiveSection] = useState("all");
  const [savingBookKey, setSavingBookKey] = useState("");
  const [libraryMode, setLibraryMode] = useState(LIBRARY_MODE_CUSTOM);
  const [modeSavingTo, setModeSavingTo] = useState("");

  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [description, setDescription] = useState("");
  const [fileUrl, setFileUrl] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [bookFileAsset, setBookFileAsset] = useState(null);
  const [coverAsset, setCoverAsset] = useState(null);

  const pageHistoryRef = useRef([]);

  const loadCatalog = useCallback(
    async (overrides = {}) => {
      const nextQuery =
        overrides.query !== undefined ? String(overrides.query || "").trim() : String(queryValue || "").trim();
      const nextGenre =
        overrides.genre !== undefined ? String(overrides.genre || "").trim() : String(selectedGenre || "").trim();
      const nextPage = Number(overrides.page !== undefined ? overrides.page : page) || 1;

      setLoading(true);
      try {
        const data = await fetchBookCatalog({
          q: nextQuery || DEFAULT_QUERY,
          subject: nextGenre || undefined,
          page: nextPage,
          limit: DEFAULT_LIMIT,
        });

        const normalizedItems = (Array.isArray(data?.items) ? data.items : []).map((item) => normalizeBook(item));
        setCatalogItems(normalizedItems);
        setGenres(Array.isArray(data?.genres) ? data.genres.slice(0, 18) : []);
        setHasMore(Boolean(data?.has_more));
        setCatalogTotal(Number(data?.total) || 0);
      } catch (error) {
        setCatalogItems([]);
        setGenres([]);
        setHasMore(false);
        setCatalogTotal(0);
        if (!overrides.silent) {
          const userMessage = error?.response?.data?.error || t("unknownError");
          Alert.alert(t("library"), userMessage);
        }
      } finally {
        setLoading(false);
      }
    },
    [page, queryValue, selectedGenre, t]
  );

  const applyLibraryModeState = useCallback(
    async (nextMode, options = {}) => {
      const normalizedMode = normalizeLibraryMode(nextMode);
      const keepCurrentQuery = Boolean(options.keepCurrentQuery);

      setLibraryMode(normalizedMode);
      setPage(1);
      pageHistoryRef.current = [];

      if (normalizedMode === LIBRARY_MODE_CATALOG) {
        const nextQuery =
          keepCurrentQuery && String(queryValue || "").trim()
            ? String(queryValue || "").trim()
            : DEFAULT_QUERY;
        setQueryInput(nextQuery);
        setQueryValue(nextQuery);
        setSelectedGenre("");
        await loadCatalog({
          query: nextQuery,
          genre: "",
          page: 1,
          silent: true,
        });
      } else {
        setCatalogItems([]);
        setHasMore(false);
        setCatalogTotal(0);
      }
    },
    [loadCatalog, queryValue]
  );

  const syncLibraryModeFromServer = useCallback(
    async (options = {}) => {
      const silent = options.silent !== false;
      try {
        const modePayload = await fetchLibraryMode();
        const serverMode = normalizeLibraryMode(modePayload?.mode);
        if (serverMode !== libraryMode) {
          await applyLibraryModeState(serverMode, { keepCurrentQuery: false });
        }
        return serverMode;
      } catch (error) {
        if (!silent) {
          const userMessage = error?.response?.data?.error || t("unknownError");
          Alert.alert(t("library"), userMessage);
        }
        return libraryMode;
      }
    },
    [applyLibraryModeState, libraryMode, t]
  );

  const loadLocalBooks = useCallback(async () => {
    try {
      const rows = await fetchBooks();
      const normalized = (Array.isArray(rows) ? rows : [])
        .map((item) => normalizeBook(item))
        .map((item) => ({
          ...item,
          source: item.source || "local",
          format: item.format || "file",
        }));
      setLocalItems(normalized);
    } catch {
      setLocalItems([]);
    }
  }, []);

  const loadShelf = useCallback(async () => {
    try {
      const rows = await fetchBookShelf();
      setShelfItems(Array.isArray(rows) ? rows : []);
    } catch {
      setShelfItems([]);
    }
  }, []);

  const bootstrap = useCallback(async () => {
    await Promise.all([loadLocalBooks(), loadShelf()]);
    await syncLibraryModeFromServer({ silent: true });
  }, [loadLocalBooks, loadShelf, syncLibraryModeFromServer]);

  useEffect(() => {
    void bootstrap();
  }, []);

  useFocusEffect(
    useCallback(() => {
      void Promise.all([loadShelf(), syncLibraryModeFromServer({ silent: true })]);
    }, [loadShelf, syncLibraryModeFromServer])
  );

  const stepBackCatalogPage = useCallback(() => {
    if (libraryMode !== LIBRARY_MODE_CATALOG || activeSection !== "all") {
      return false;
    }

    const previousPage = pageHistoryRef.current.pop();
    if (!previousPage || previousPage === page) {
      return false;
    }

    setPage(previousPage);
    void loadCatalog({
      query: queryValue,
      genre: selectedGenre,
      page: previousPage,
      silent: true,
    });
    return true;
  }, [activeSection, libraryMode, loadCatalog, page, queryValue, selectedGenre]);

  useFocusEffect(
    useCallback(() => {
      if (Platform.OS === "web") return undefined;

      const subscription = BackHandler.addEventListener("hardwareBackPress", () => stepBackCatalogPage());
      return () => subscription.remove();
    }, [stepBackCatalogPage])
  );

  useEffect(() => {
    if (typeof navigation?.addListener !== "function") return undefined;

    const unsubscribe = navigation.addListener("beforeRemove", (event) => {
      if (!stepBackCatalogPage()) return;
      event.preventDefault();
    });

    return unsubscribe;
  }, [navigation, stepBackCatalogPage]);

  const shelfByKey = useMemo(() => {
    const map = new Map();
    (Array.isArray(shelfItems) ? shelfItems : []).forEach((item) => {
      const key = `${String(item?.source || "").trim()}:${String(item?.book_key || "").trim()}`;
      if (!key || key === ":") return;
      map.set(key, item);
    });
    return map;
  }, [shelfItems]);

  const localBooksWithShelf = useMemo(() => {
    return (Array.isArray(localItems) ? localItems : []).map((item) => {
      const normalized = normalizeBook(item);
      const key = normalizeBookKey(normalized);
      const shelfState = shelfByKey.get(key);
      return {
        ...normalized,
        is_favorite: Boolean(shelfState?.is_favorite),
        is_read: Boolean(shelfState?.is_read),
        bookmark_url: String(shelfState?.bookmark_url || "").trim() || null,
        shelf: shelfState || null,
      };
    });
  }, [localItems, shelfByKey]);

  const allCatalogBooks = useMemo(() => {
    const filteredLocal = filterLocalByQuery(localItems, queryValue, selectedGenre);
    const merged = [...filteredLocal, ...catalogItems];
    const seen = new Set();
    const result = [];
    merged.forEach((item) => {
      const normalized = normalizeBook(item);
      const key = normalizeBookKey(normalized);
      if (seen.has(key)) return;
      seen.add(key);
      const shelfState = shelfByKey.get(key);
      result.push({
        ...normalized,
        is_favorite: Boolean(shelfState?.is_favorite),
        is_read: Boolean(shelfState?.is_read),
        bookmark_url: String(shelfState?.bookmark_url || "").trim() || null,
        shelf: shelfState || null,
      });
    });
    return result;
  }, [catalogItems, localItems, queryValue, selectedGenre, shelfByKey]);

  const allSectionItems = useMemo(() => {
    if (libraryMode === LIBRARY_MODE_CUSTOM) {
      return localBooksWithShelf;
    }
    return allCatalogBooks;
  }, [allCatalogBooks, libraryMode, localBooksWithShelf]);

  const filteredSectionItems = useMemo(() => {
    if (activeSection === "all") {
      return allSectionItems;
    }

    const shelfBooks = (Array.isArray(shelfItems) ? shelfItems : [])
      .filter((item) => {
        if (activeSection === "favorites") return Boolean(item?.is_favorite);
        if (activeSection === "bookmarks") return Boolean(String(item?.bookmark_url || "").trim());
        if (activeSection === "read") return Boolean(item?.is_read);
        return false;
      })
      .map((item) => {
        const normalized = normalizeShelfToBook(item);
        return {
          ...normalized,
          is_favorite: Boolean(item?.is_favorite),
          is_read: Boolean(item?.is_read),
          bookmark_url: String(item?.bookmark_url || "").trim() || null,
          shelf: item,
        };
      });

    const seen = new Set();
    const result = [];
    shelfBooks.forEach((item) => {
      const key = normalizeBookKey(item);
      if (seen.has(key)) return;
      seen.add(key);
      result.push(item);
    });
    return result;
  }, [activeSection, allSectionItems, shelfItems]);

  const totalPages = useMemo(() => {
    if (libraryMode !== LIBRARY_MODE_CATALOG) return 1;
    if (catalogTotal > 0) return Math.max(1, Math.ceil(catalogTotal / DEFAULT_LIMIT));
    if (hasMore) return page + 1;
    return Math.max(1, page);
  }, [catalogTotal, hasMore, libraryMode, page]);

  const pageTokens = useMemo(() => buildPageTokens(page, totalPages), [page, totalPages]);

  const upsertShelf = useCallback(
    async (book, patch) => {
      const key = normalizeBookKey(book);
      setSavingBookKey(key);
      try {
        await upsertBookShelfItem({
          source: book.source,
          book_key: book.book_key,
          title: book.title,
          author: book.author,
          description: book.description,
          cover_url: book.cover_url,
          reader_url: book.reader_url || book.details_url,
          genre: book.genre,
          ...patch,
        });
        await loadShelf();
      } finally {
        setSavingBookKey("");
      }
    },
    [loadShelf]
  );

  const onToggleFavorite = async (book) => {
    const key = normalizeBookKey(book);
    const shelf = shelfByKey.get(key);
    await upsertShelf(book, { is_favorite: !Boolean(shelf?.is_favorite) });
  };

  const onToggleRead = async (book) => {
    const key = normalizeBookKey(book);
    const shelf = shelfByKey.get(key);
    await upsertShelf(book, { is_read: !Boolean(shelf?.is_read) });
  };

  const onToggleBookmark = async (book) => {
    const key = normalizeBookKey(book);
    const shelf = shelfByKey.get(key);
    const hasBookmark = Boolean(String(shelf?.bookmark_url || "").trim());
    await upsertShelf(book, {
      bookmark_url: hasBookmark ? "" : book.reader_url || book.details_url || "",
      bookmark_note: hasBookmark ? "" : new Date().toISOString(),
    });
  };

  const onOpenBook = (book) => {
    navigation.navigate("LibraryReader", {
      book: {
        ...book,
        shelf: shelfByKey.get(normalizeBookKey(book)) || null,
      },
    });
  };

  const goToCatalogPage = useCallback(
    async (nextPage, options = {}) => {
      if (libraryMode !== LIBRARY_MODE_CATALOG || activeSection !== "all") return;

      const trackHistory = options.trackHistory !== false;
      const targetPage = Math.max(1, Number(nextPage) || 1);
      if (targetPage === page) return;

      if (trackHistory) {
        pageHistoryRef.current.push(page);
      }

      setPage(targetPage);
      await loadCatalog({
        query: queryValue,
        genre: selectedGenre,
        page: targetPage,
      });
    },
    [activeSection, libraryMode, loadCatalog, page, queryValue, selectedGenre]
  );

  const onSubmitSearch = async () => {
    if (libraryMode !== LIBRARY_MODE_CATALOG) return;
    const nextQuery = String(queryInput || "").trim() || DEFAULT_QUERY;
    setQueryValue(nextQuery);
    setPage(1);
    pageHistoryRef.current = [];
    await loadCatalog({ query: nextQuery, genre: selectedGenre, page: 1 });
  };

  const onChangeGenre = async (genre) => {
    if (libraryMode !== LIBRARY_MODE_CATALOG) return;
    const nextGenre = String(genre || "").trim();
    setSelectedGenre(nextGenre);
    setPage(1);
    pageHistoryRef.current = [];
    await loadCatalog({ query: queryValue, genre: nextGenre, page: 1 });
  };

  const onChangeLibraryMode = async (nextMode) => {
    const normalizedMode = normalizeLibraryMode(nextMode);
    if (normalizedMode === libraryMode) return;

    const previousMode = libraryMode;
    setModeSavingTo(normalizedMode);
    try {
      await applyLibraryModeState(normalizedMode, { keepCurrentQuery: false });
      await updateLibraryMode(normalizedMode);
    } catch (error) {
      await applyLibraryModeState(previousMode, { keepCurrentQuery: true });
      const userMessage = error?.response?.data?.error || t("unknownError");
      Alert.alert(t("library"), userMessage);
    } finally {
      setModeSavingTo("");
    }
  };

  const pickBookFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "*/*",
        multiple: false,
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      const asset = result.assets?.[0];
      if (!asset) return;
      setBookFileAsset(asset);
      if (!String(fileUrl || "").trim()) {
        setFileUrl(asset.uri || "");
      }
    } catch {
      Alert.alert(t("library"), t("unknownError"));
    }
  };

  const pickCoverFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "image/*",
        multiple: false,
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      const asset = result.assets?.[0];
      if (!asset) return;
      setCoverAsset(asset);
      if (!String(coverUrl || "").trim()) {
        setCoverUrl(asset.uri || "");
      }
    } catch {
      Alert.alert(t("library"), t("unknownError"));
    }
  };

  const onCreateBook = async () => {
    const normalizedTitle = String(title || "").trim();
    const normalizedAuthor = String(author || "").trim();
    const normalizedFileUrl = String(fileUrl || "").trim();
    const normalizedDescription = String(description || "").trim();
    const normalizedCoverUrl = String(coverUrl || "").trim();

    if (!bookFileAsset && !normalizedFileUrl) {
      Alert.alert(t("library"), t("fillRequiredFields"));
      return;
    }

    try {
      await createBook({
        title: normalizedTitle,
        author: normalizedAuthor,
        description: normalizedDescription,
        file: normalizedFileUrl,
        cover_url: normalizedCoverUrl,
        fileAsset: bookFileAsset,
        coverAsset,
      });
      setTitle("");
      setAuthor("");
      setDescription("");
      setFileUrl("");
      setCoverUrl("");
      setBookFileAsset(null);
      setCoverAsset(null);
      await loadLocalBooks();
      await loadShelf();
    } catch (error) {
      const userMessage = error?.response?.data?.error || t("unknownError");
      Alert.alert(t("library"), userMessage);
    }
  };

  const onRefreshList = useCallback(async () => {
    await Promise.all([loadLocalBooks(), loadShelf()]);
    const currentMode = await syncLibraryModeFromServer({ silent: true });
    if (currentMode === LIBRARY_MODE_CATALOG && activeSection === "all") {
      await loadCatalog({ query: queryValue, genre: selectedGenre, page, silent: true });
    }
  }, [
    activeSection,
    loadCatalog,
    loadLocalBooks,
    loadShelf,
    page,
    queryValue,
    selectedGenre,
    syncLibraryModeFromServer,
  ]);

  const sectionButtons = [
    { key: "all", label: t("librarySectionAll") },
    { key: "favorites", label: t("librarySectionFavorites") },
    { key: "bookmarks", label: t("librarySectionBookmarks") },
    { key: "read", label: t("librarySectionRead") },
  ];

  const renderBookCard = ({ item }) => {
    const key = normalizeBookKey(item);
    const isSaving = savingBookKey === key;
    const isFavorite = Boolean(item?.is_favorite);
    const isRead = Boolean(item?.is_read);
    const hasBookmark = Boolean(String(item?.bookmark_url || "").trim());

    return (
      <View style={[styles.cardWrap, numColumns > 1 ? styles.cardWrapGrid : null]}>
        <Pressable
          onPress={() => onOpenBook(item)}
          style={[styles.bookCard, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}
        >
          <View style={styles.coverWrap}>
            {item?.cover_url ? (
              <Image source={{ uri: item.cover_url }} style={styles.coverImage} resizeMode="cover" />
            ) : (
              <View style={[styles.coverPlaceholder, { borderColor: theme.colors.border, backgroundColor: theme.colors.rowAlt }]}>
                <Text style={[styles.coverPlaceholderText, { color: theme.colors.textMuted, fontFamily: theme.fonts.medium }]}>
                  {t("libraryNoCover")}
                </Text>
              </View>
            )}
          </View>

          <Text style={[styles.bookTitle, { color: theme.colors.text, fontFamily: theme.fonts.bold }]} numberOfLines={2}>
            {item?.title || "-"}
          </Text>
          <Text style={[styles.bookAuthor, { color: theme.colors.textMuted, fontFamily: theme.fonts.regular }]} numberOfLines={1}>
            {item?.author || t("bookAuthor")}
          </Text>
          <Text style={[styles.bookDescription, { color: theme.colors.textMuted, fontFamily: theme.fonts.regular }]} numberOfLines={3}>
            {item?.description || t("libraryDescriptionFallback")}
          </Text>

          {item?.genre ? (
            <Text style={[styles.genreText, { color: theme.colors.text, fontFamily: theme.fonts.medium }]} numberOfLines={1}>
              #{item.genre}
            </Text>
          ) : null}

          <View style={styles.cardActions}>
            <AppButton
              title={isFavorite ? t("libraryUnfavoriteShort") : t("libraryFavoriteShort")}
              variant={isFavorite ? "primary" : "ghost"}
              onPress={() => onToggleFavorite(item)}
              loading={isSaving}
              style={styles.cardActionButton}
            />
            <AppButton
              title={hasBookmark ? t("libraryUnbookmarkShort") : t("libraryBookmarkShort")}
              variant={hasBookmark ? "primary" : "ghost"}
              onPress={() => onToggleBookmark(item)}
              loading={isSaving}
              style={styles.cardActionButton}
            />
            <AppButton
              title={isRead ? t("libraryUnreadShort") : t("libraryReadShort")}
              variant={isRead ? "primary" : "ghost"}
              onPress={() => onToggleRead(item)}
              loading={isSaving}
              style={styles.cardActionButton}
            />
          </View>
        </Pressable>
      </View>
    );
  };

  const renderListHeader = () => (
    <View style={styles.headerBlock}>
      <AppCard style={styles.topCard}>
        {canToggleMode ? (
          <View style={styles.modeRow}>
            <AppButton
              title={t("libraryModeCustom")}
              variant={libraryMode === LIBRARY_MODE_CUSTOM ? "primary" : "ghost"}
              onPress={() => onChangeLibraryMode(LIBRARY_MODE_CUSTOM)}
              loading={modeSavingTo === LIBRARY_MODE_CUSTOM}
              style={styles.modeButton}
            />
            <AppButton
              title={t("libraryModeCatalog")}
              variant={libraryMode === LIBRARY_MODE_CATALOG ? "primary" : "ghost"}
              onPress={() => onChangeLibraryMode(LIBRARY_MODE_CATALOG)}
              loading={modeSavingTo === LIBRARY_MODE_CATALOG}
              style={styles.modeButton}
            />
          </View>
        ) : null}

        <View style={styles.sectionTabsRow}>
          {sectionButtons.map((tab) => (
            <AppButton
              key={tab.key}
              title={tab.label}
              variant={activeSection === tab.key ? "primary" : "ghost"}
              onPress={() => setActiveSection(tab.key)}
              style={styles.sectionTabButton}
            />
          ))}
        </View>

        {libraryMode === LIBRARY_MODE_CATALOG ? (
          <>
            <View style={styles.searchRow}>
              <AppInput
                label={t("librarySearch")}
                value={queryInput}
                onChangeText={setQueryInput}
                placeholder={t("librarySearchPlaceholder")}
                style={styles.searchInput}
              />
              <AppButton title={t("search")} onPress={onSubmitSearch} style={styles.searchButton} />
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.genreRow}>
              <AppButton
                title={t("libraryGenreAll")}
                variant={!selectedGenre ? "primary" : "ghost"}
                onPress={() => onChangeGenre("")}
                style={styles.genreButton}
              />
              {(genres || []).map((genre) => (
                <AppButton
                  key={`genre-${genre}`}
                  title={genre}
                  variant={selectedGenre === genre ? "primary" : "ghost"}
                  onPress={() => onChangeGenre(genre)}
                  style={styles.genreButton}
                />
              ))}
            </ScrollView>
          </>
        ) : null}
      </AppCard>

      {canCreate ? (
        <AppCard style={styles.createCard}>
          <Text style={[styles.createTitle, { color: theme.colors.text, fontFamily: theme.fonts.bold }]}>{t("createBook")}</Text>
          <AppInput label={t("title")} value={title} onChangeText={setTitle} />
          <AppInput label={t("bookAuthor")} value={author} onChangeText={setAuthor} />
          <AppInput label={t("description")} value={description} onChangeText={setDescription} multiline style={styles.descriptionInput} />
          <AppInput
            label={t("bookFileUrl")}
            value={fileUrl}
            onChangeText={setFileUrl}
            placeholder="https://example.com/book.pdf"
          />
          <AppInput
            label={t("libraryCoverUrl")}
            value={coverUrl}
            onChangeText={setCoverUrl}
            placeholder="https://example.com/cover.jpg"
          />
          <View style={styles.fileButtonsRow}>
            <AppButton title={t("libraryPickBookFile")} onPress={pickBookFile} variant="ghost" style={styles.fileButton} />
            <AppButton title={t("libraryPickCoverFile")} onPress={pickCoverFile} variant="ghost" style={styles.fileButton} />
          </View>
          {bookFileAsset?.name ? (
            <Text style={[styles.fileHintText, { color: theme.colors.textMuted, fontFamily: theme.fonts.regular }]}>
              {`${t("librarySelectedBookFile")}: ${bookFileAsset.name}`}
            </Text>
          ) : null}
          {coverAsset?.name ? (
            <Text style={[styles.fileHintText, { color: theme.colors.textMuted, fontFamily: theme.fonts.regular }]}>
              {`${t("librarySelectedCoverFile")}: ${coverAsset.name}`}
            </Text>
          ) : null}
          <AppButton title={t("create")} onPress={onCreateBook} />
        </AppCard>
      ) : null}
    </View>
  );

  const renderListFooter = () => {
    if (libraryMode !== LIBRARY_MODE_CATALOG || activeSection !== "all") {
      return null;
    }

    return (
      <View style={styles.footerWrap}>
        <Text style={[styles.pageText, { color: theme.colors.textMuted, fontFamily: theme.fonts.medium }]}>
          {`${t("libraryPage")} ${page}`}
        </Text>
        <View style={styles.pagerRow}>
          <AppButton
            title="‹"
            variant="ghost"
            onPress={() => goToCatalogPage(page - 1)}
            disabled={page <= 1}
            style={styles.pageButton}
          />
          {pageTokens.map((token, index) => {
            if (typeof token !== "number") {
              return (
                <Text
                  key={`gap-${index}`}
                  style={[styles.pageGap, { color: theme.colors.textMuted, fontFamily: theme.fonts.medium }]}
                >
                  ...
                </Text>
              );
            }

            const active = token === page;
            return (
              <AppButton
                key={`page-${token}`}
                title={`${token}`}
                variant={active ? "primary" : "ghost"}
                onPress={() => goToCatalogPage(token)}
                style={styles.pageNumberButton}
              />
            );
          })}
          <AppButton
            title="›"
            variant="ghost"
            onPress={() => goToCatalogPage(page + 1)}
            disabled={!hasMore && page >= totalPages}
            style={styles.pageButton}
          />
        </View>
      </View>
    );
  };

  return (
    <ScreenLayout scroll={false} contentContainerStyle={styles.screenNoPadding}>
      <View style={styles.container}>
        <FlatList
          data={filteredSectionItems}
          key={`${numColumns}`}
          keyExtractor={(item, index) => `${normalizeBookKey(item)}-${index}`}
          numColumns={numColumns}
          renderItem={renderBookCard}
          refreshing={loading}
          onRefresh={onRefreshList}
          ListHeaderComponent={renderListHeader()}
          ListFooterComponent={renderListFooter()}
          contentContainerStyle={styles.listContent}
          columnWrapperStyle={numColumns > 1 ? styles.columnWrapper : null}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Text style={[styles.emptyText, { color: theme.colors.textMuted, fontFamily: theme.fonts.regular }]}>
                {t("libraryEmpty")}
              </Text>
            </View>
          }
          showsVerticalScrollIndicator={false}
        />
      </View>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  screenNoPadding: {
    flex: 1,
    padding: 0,
  },
  container: {
    flex: 1,
    paddingHorizontal: 12,
    paddingTop: 6,
    paddingBottom: 12,
  },
  headerBlock: {
    gap: 8,
  },
  topCard: {
    marginBottom: 2,
  },
  modeRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 8,
  },
  modeButton: {
    flex: 1,
    minHeight: 34,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
  },
  searchInput: {
    flex: 1,
    marginBottom: 0,
  },
  searchButton: {
    minHeight: 42,
    minWidth: 96,
  },
  genreRow: {
    gap: 8,
    marginTop: 10,
    paddingBottom: 2,
  },
  genreButton: {
    minHeight: 34,
    paddingHorizontal: 10,
  },
  sectionTabsRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 2,
    flexWrap: "wrap",
  },
  sectionTabButton: {
    minHeight: 34,
    paddingHorizontal: 10,
  },
  createCard: {
    marginBottom: 4,
  },
  createTitle: {
    fontSize: 16,
    marginBottom: 8,
  },
  descriptionInput: {
    minHeight: 84,
  },
  fileButtonsRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 8,
  },
  fileButton: {
    flex: 1,
    minHeight: 36,
  },
  fileHintText: {
    fontSize: 12,
    marginBottom: 6,
  },
  listContent: {
    paddingBottom: 16,
    gap: 8,
  },
  columnWrapper: {
    gap: 8,
  },
  cardWrap: {
    marginBottom: 8,
  },
  cardWrapGrid: {
    flex: 1,
  },
  bookCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 10,
    minHeight: 334,
  },
  coverWrap: {
    width: "100%",
    height: 120,
    marginBottom: 8,
  },
  coverImage: {
    width: "100%",
    height: "100%",
    borderRadius: 10,
  },
  coverPlaceholder: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 8,
  },
  coverPlaceholderText: {
    fontSize: 12,
    textAlign: "center",
  },
  bookTitle: {
    fontSize: 16,
    marginBottom: 4,
  },
  bookAuthor: {
    fontSize: 12,
    marginBottom: 6,
  },
  bookDescription: {
    fontSize: 12,
    lineHeight: 16,
    minHeight: 48,
    marginBottom: 6,
  },
  genreText: {
    fontSize: 11,
    marginBottom: 8,
  },
  cardActions: {
    marginTop: "auto",
    gap: 6,
  },
  cardActionButton: {
    minHeight: 32,
    paddingHorizontal: 8,
  },
  footerWrap: {
    paddingTop: 4,
    paddingBottom: 10,
    alignItems: "center",
    gap: 8,
  },
  pagerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    flexWrap: "wrap",
  },
  pageButton: {
    minHeight: 34,
    minWidth: 44,
    paddingHorizontal: 8,
  },
  pageNumberButton: {
    minHeight: 34,
    minWidth: 40,
    paddingHorizontal: 8,
  },
  pageGap: {
    fontSize: 14,
    paddingHorizontal: 4,
  },
  pageText: {
    fontSize: 13,
  },
  emptyWrap: {
    paddingVertical: 32,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 14,
  },
});
