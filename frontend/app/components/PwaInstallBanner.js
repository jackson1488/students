/**
 * Module: app/components/PwaInstallBanner.js
 *
 * Purpose:
 * - Reusable UI component module: PwaInstallBanner.
 *
 * Module notes:
 * - Imports count: 4.
 * - This header is written for beginners: read purpose first, then function map below.
 *
 * Function map:
 * - PwaInstallBanner: Main React component or UI container exported by this file.
 * - isStandaloneMode: Helper function used by this module business logic.
 * - isIosSafari: Helper function used by this module business logic.
 * - readDismissedFlag: Helper function used by this module business logic.
 * - writeDismissedFlag: Helper function used by this module business logic.
 * - onInstall: Callback function invoked by UI or navigation events.
 * - onBeforeInstallPrompt: Callback function invoked by UI or navigation events.
 * - onInstalled: Callback function invoked by UI or navigation events.
 * - onClose: Callback function invoked by UI or navigation events.
 * - iosSafari: Helper function used by this module business logic.
 */

import React, { useEffect, useMemo, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";

import { useI18n } from "../hooks/I18nContext";
import { useThemeMode } from "../hooks/ThemeContext";

const DISMISS_KEY = "edu_kernel_pwa_install_dismissed_v1";

function isStandaloneMode() {
  if (typeof window === "undefined") return false;
  const webStandalone = window.matchMedia?.("(display-mode: standalone)")?.matches;
  const iosStandalone = Boolean(window.navigator?.standalone);
  return Boolean(webStandalone || iosStandalone);
}

function isIosSafari() {
  if (typeof window === "undefined") return false;
  const ua = window.navigator?.userAgent || "";
  const isIOS = /iPad|iPhone|iPod/.test(ua);
  const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
  return isIOS && isSafari;
}

function readDismissedFlag() {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage?.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

function writeDismissedFlag() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage?.setItem(DISMISS_KEY, "1");
  } catch {
    // Ignore storage write failures in restricted webviews/private mode.
  }
}

export default function PwaInstallBanner() {
  const { t } = useI18n();
  const { theme } = useThemeMode();
  const [visible, setVisible] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const iosSafari = useMemo(() => (Platform.OS === "web" ? isIosSafari() : false), []);

  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") return undefined;
    if (isStandaloneMode()) return undefined;
    if (readDismissedFlag()) return undefined;

    const onBeforeInstallPrompt = (event) => {
      event.preventDefault();
      setDeferredPrompt(event);
      setVisible(true);
    };
    const onInstalled = () => {
      setVisible(false);
      setDeferredPrompt(null);
      writeDismissedFlag();
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);

    if (iosSafari) {
      setVisible(true);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, [iosSafari]);

  const onClose = () => {
    setVisible(false);
    writeDismissedFlag();
  };

  const onInstall = async () => {
    if (!deferredPrompt) {
      return;
    }
    try {
      await deferredPrompt.prompt();
      await deferredPrompt.userChoice;
    } catch {
      // Ignore prompt errors: banner can still be closed manually.
    } finally {
      setDeferredPrompt(null);
      onClose();
    }
  };

  if (Platform.OS !== "web" || !visible || isStandaloneMode()) {
    return null;
  }

  return (
    <View pointerEvents="box-none" style={styles.overlay}>
      <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
        <Text style={[styles.title, { color: theme.colors.text, fontFamily: theme.fonts.bold }]}>{t("installAppTitle")}</Text>
        <Text style={[styles.text, { color: theme.colors.textMuted, fontFamily: theme.fonts.regular }]}>
          {deferredPrompt ? t("installAppText") : t("iosInstallGuide")}
        </Text>
        <View style={styles.actions}>
          {deferredPrompt ? (
            <Pressable
              style={[styles.installBtn, { backgroundColor: theme.colors.primary }]}
              onPress={onInstall}
            >
              <Text style={[styles.installBtnText, { color: theme.colors.onPrimary, fontFamily: theme.fonts.medium }]}>
                {t("installApp")}
              </Text>
            </Pressable>
          ) : null}
          <Pressable style={[styles.laterBtn, { borderColor: theme.colors.border }]} onPress={onClose}>
            <Text style={[styles.laterBtnText, { color: theme.colors.text, fontFamily: theme.fonts.medium }]}>{t("maybeLater")}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    top: 8,
    left: 10,
    right: 10,
    zIndex: 999,
  },
  card: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    shadowColor: "#000",
    shadowOpacity: 0.14,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 5,
  },
  title: {
    fontSize: 14,
    marginBottom: 4,
  },
  text: {
    fontSize: 12,
    lineHeight: 17,
  },
  actions: {
    flexDirection: "row",
    marginTop: 10,
    gap: 8,
  },
  installBtn: {
    minHeight: 34,
    borderRadius: 9,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 12,
  },
  installBtnText: {
    fontSize: 13,
  },
  laterBtn: {
    minHeight: 34,
    borderRadius: 9,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 12,
  },
  laterBtnText: {
    fontSize: 13,
  },
});
