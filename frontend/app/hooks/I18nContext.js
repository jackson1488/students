/**
 * Module: app/hooks/I18nContext.js
 *
 * Purpose:
 * - Hook/context module: I18nContext. Encapsulates shared stateful behavior.
 *
 * Module notes:
 * - Imports count: 3.
 * - This header is written for beginners: read purpose first, then function map below.
 *
 * Function map:
 * - I18nProvider: Main React component or UI container exported by this file.
 * - useI18n: Custom hook that encapsulates reusable stateful behavior.
 * - setLanguage: Applies value updates to state/configuration.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

import i18n, { SUPPORTED_LANGUAGES } from "../i18n";

const STORAGE_KEY = "@student_system_lang";
const I18nContext = createContext(null);

export function I18nProvider({ children }) {
  const [language, setLanguageState] = useState(i18n.locale || "ru");
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored && SUPPORTED_LANGUAGES.includes(stored)) {
          i18n.locale = stored;
          setLanguageState(stored);
        }
      } finally {
        setIsReady(true);
      }
    })();
  }, []);

  const setLanguage = async (nextLanguage) => {
    if (!SUPPORTED_LANGUAGES.includes(nextLanguage)) return;
    i18n.locale = nextLanguage;
    setLanguageState(nextLanguage);
    await AsyncStorage.setItem(STORAGE_KEY, nextLanguage);
  };

  const value = useMemo(
    () => ({
      language,
      isReady,
      availableLanguages: SUPPORTED_LANGUAGES,
      setLanguage,
      t: (key, options) => i18n.t(key, options),
    }),
    [language, isReady]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used within I18nProvider");
  }
  return context;
}
