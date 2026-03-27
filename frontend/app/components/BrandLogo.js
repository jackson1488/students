/**
 * Module: app/components/BrandLogo.js
 *
 * Purpose:
 * - Reusable UI component module: BrandLogo.
 *
 * Module notes:
 * - Imports count: 4.
 * - This header is written for beginners: read purpose first, then function map below.
 *
 * Function map:
 * - BrandLogo: Main React component or UI container exported by this file.
 */

import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { useI18n } from "../hooks/I18nContext";
import { useThemeMode } from "../hooks/ThemeContext";

export default function BrandLogo({
  size = 48,
  showText = true,
  showSubtitle = false,
  style,
  titleStyle,
  subtitleStyle,
}) {
  const { t } = useI18n();
  const { theme } = useThemeMode();

  const strokeColor = theme.isDark ? "#FFFFFF" : "#111111";
  const fillColor = theme.isDark ? "#0F0F0F" : "#FFFFFF";
  const borderSize = Math.max(2, Math.round(size * 0.06));
  const round = Math.round(size * 0.22);

  return (
    <View style={[styles.row, style]}>
      <View
        style={[
          styles.mark,
          {
            width: size,
            height: size,
            borderRadius: round,
            borderWidth: borderSize,
            borderColor: strokeColor,
            backgroundColor: fillColor,
          },
        ]}
      >
        <View style={[styles.eStem, { backgroundColor: strokeColor }]} />
        <View style={[styles.eTop, { backgroundColor: strokeColor }]} />
        <View style={[styles.eMid, { backgroundColor: strokeColor }]} />
        <View style={[styles.eBottom, { backgroundColor: strokeColor }]} />

        <View style={[styles.kStem, { backgroundColor: strokeColor }]} />
        <View
          style={[
            styles.kDiagTop,
            {
              backgroundColor: strokeColor,
              transform: [{ rotate: "-36deg" }],
            },
          ]}
        />
        <View
          style={[
            styles.kDiagBottom,
            {
              backgroundColor: strokeColor,
              transform: [{ rotate: "36deg" }],
            },
          ]}
        />
      </View>

      {showText ? (
        <View style={styles.textWrap}>
          <Text style={[styles.title, { color: theme.colors.text, fontFamily: theme.fonts.bold }, titleStyle]}>
            {t("appTitle")}
          </Text>
          {showSubtitle ? (
            <Text style={[styles.subtitle, { color: theme.colors.textMuted, fontFamily: theme.fonts.regular }, subtitleStyle]}>
              Education Kernel
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  mark: {
    position: "relative",
    overflow: "hidden",
  },
  textWrap: {
    justifyContent: "center",
  },
  title: {
    fontSize: 20,
    letterSpacing: 0.4,
  },
  subtitle: {
    marginTop: 1,
    fontSize: 11,
    letterSpacing: 0.2,
  },
  eStem: {
    position: "absolute",
    left: "18%",
    top: "18%",
    width: "8%",
    height: "64%",
    borderRadius: 2,
  },
  eTop: {
    position: "absolute",
    left: "18%",
    top: "18%",
    width: "30%",
    height: "8%",
    borderRadius: 2,
  },
  eMid: {
    position: "absolute",
    left: "18%",
    top: "46%",
    width: "26%",
    height: "8%",
    borderRadius: 2,
  },
  eBottom: {
    position: "absolute",
    left: "18%",
    top: "74%",
    width: "30%",
    height: "8%",
    borderRadius: 2,
  },
  kStem: {
    position: "absolute",
    right: "35%",
    top: "18%",
    width: "8%",
    height: "64%",
    borderRadius: 2,
  },
  kDiagTop: {
    position: "absolute",
    right: "16%",
    top: "24%",
    width: "7%",
    height: "34%",
    borderRadius: 2,
  },
  kDiagBottom: {
    position: "absolute",
    right: "16%",
    top: "45%",
    width: "7%",
    height: "34%",
    borderRadius: 2,
  },
});
