/**
 * Module: App.js
 *
 * Purpose:
 * - Application entry point. Wires providers and root navigation.
 *
 * Module notes:
 * - Imports count: 10.
 * - This header is written for beginners: read purpose first, then function map below.
 *
 * Function map:
 * - App: Main React component or UI container exported by this file.
 * - AppShell: Main React component or UI container exported by this file.
 */

import "react-native-gesture-handler";
import React from "react";
import { StatusBar } from "expo-status-bar";
import { NavigationContainer } from "@react-navigation/native";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import PwaInstallBanner from "./app/components/PwaInstallBanner";
import RootNavigator from "./app/navigation/RootNavigator";
import { AuthProvider } from "./app/hooks/AuthContext";
import { ThemeProvider, useThemeMode } from "./app/hooks/ThemeContext";
import { I18nProvider } from "./app/hooks/I18nContext";

function AppShell() {
  const { navigationTheme, isDark } = useThemeMode();

  return (
    <NavigationContainer theme={navigationTheme}>
      <StatusBar style={isDark ? "light" : "dark"} />
      <RootNavigator />
      <PwaInstallBanner />
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <I18nProvider>
          <AuthProvider>
            <AppShell />
          </AuthProvider>
        </I18nProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
