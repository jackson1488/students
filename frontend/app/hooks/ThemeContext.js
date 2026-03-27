/**
 * Module: app/hooks/ThemeContext.js
 *
 * Purpose:
 * - Hook/context module: ThemeContext. Encapsulates shared stateful behavior.
 *
 * Module notes:
 * - Imports count: 3.
 * - This header is written for beginners: read purpose first, then function map below.
 *
 * Function map:
 * - ThemeProvider: Main React component or UI container exported by this file.
 * - useThemeMode: Custom hook that encapsulates reusable stateful behavior.
 * - setThemeMode: Applies value updates to state/configuration.
 * - toggleTheme: Toggles boolean state or switches between two modes.
 * - value: Helper function used by this module business logic.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

import { buildNavigationTheme, themes } from "../styles/theme";

const STORAGE_KEY = "@student_system_theme";
const ThemeContext = createContext(null);
const ALLOWED_MODES = ["light", "dark", "aurora"];

export function ThemeProvider({ children }) {
  const [mode, setMode] = useState("light");
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEY);
        if (ALLOWED_MODES.includes(saved)) {
          setMode(saved);
        }
      } finally {
        setIsReady(true);
      }
    })();
  }, []);

  const setThemeMode = async (nextMode) => {
    if (!ALLOWED_MODES.includes(nextMode)) return;
    setMode(nextMode);
    await AsyncStorage.setItem(STORAGE_KEY, nextMode);
  };

  const toggleTheme = async () => {
    const modeIndex = ALLOWED_MODES.indexOf(mode);
    const nextMode = ALLOWED_MODES[(modeIndex + 1) % ALLOWED_MODES.length];
    await setThemeMode(nextMode);
  };

  const value = useMemo(() => {
    const theme = themes[mode];
    return {
      theme,
      mode,
      isDark: theme.isDark,
      isReady,
      navigationTheme: buildNavigationTheme(theme),
      setThemeMode,
      toggleTheme,
    };
  }, [mode, isReady]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useThemeMode() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useThemeMode must be used within ThemeProvider");
  }
  return context;
}
