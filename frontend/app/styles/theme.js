/**
 * Module: app/styles/theme.js
 *
 * Purpose:
 * - Defines global design tokens (colors, spacing, typography).
 *
 * Module notes:
 * - Imports count: 1.
 * - This header is written for beginners: read purpose first, then function map below.
 *
 * Function map:
 * - buildNavigationTheme: Builds derived values and resolves runtime decisions.
 */

import { DarkTheme, DefaultTheme } from "@react-navigation/native";

const palette = {
  black: "#121212",
  white: "#FFFFFF",
  gray50: "#FAFAFA",
  gray100: "#F2F2F2",
  gray200: "#E6E6E6",
  gray400: "#B1B1B1",
  gray600: "#6A6A6A",
  gray800: "#303030",
};

export const themes = {
  light: {
    mode: "light",
    isDark: false,
    colors: {
      background: palette.gray50,
      surface: palette.white,
      text: palette.black,
      textMuted: palette.gray600,
      border: palette.gray200,
      primary: palette.black,
      onPrimary: palette.white,
      danger: "#1E1E1E",
      sidebar: palette.white,
      rowAlt: palette.gray100,
    },
    spacing: { xs: 6, sm: 10, md: 14, lg: 20, xl: 28 },
    radius: { sm: 8, md: 12, lg: 18 },
    fonts: {
      regular: "serif",
      medium: "serif",
      bold: "serif",
    },
  },
  dark: {
    mode: "dark",
    isDark: true,
    colors: {
      background: "#0B0B0B",
      surface: "#141414",
      text: palette.white,
      textMuted: palette.gray400,
      border: palette.gray800,
      primary: palette.white,
      onPrimary: palette.black,
      danger: "#FFFFFF",
      sidebar: "#101010",
      rowAlt: "#1A1A1A",
    },
    spacing: { xs: 6, sm: 10, md: 14, lg: 20, xl: 28 },
    radius: { sm: 8, md: 12, lg: 18 },
    fonts: {
      regular: "serif",
      medium: "serif",
      bold: "serif",
    },
  },
};

export function buildNavigationTheme(theme) {
  const base = theme.isDark ? DarkTheme : DefaultTheme;
  return {
    ...base,
    colors: {
      ...base.colors,
      background: theme.colors.background,
      card: theme.colors.surface,
      text: theme.colors.text,
      border: theme.colors.border,
      primary: theme.colors.primary,
      notification: theme.colors.text,
    },
    fonts: {
      regular: { fontFamily: "serif", fontWeight: "400" },
      medium: { fontFamily: "serif", fontWeight: "500" },
      bold: { fontFamily: "serif", fontWeight: "700" },
      heavy: { fontFamily: "serif", fontWeight: "700" },
    },
  };
}
