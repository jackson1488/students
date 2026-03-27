/**
 * Module: app/screens/LoginScreen.js
 *
 * Purpose:
 * - Screen module for LoginScreen. Handles state, data loading, and UI for this route.
 *
 * Module notes:
 * - Imports count: 12.
 * - This header is written for beginners: read purpose first, then function map below.
 *
 * Function map:
 * - LoginScreen: Main React component or UI container exported by this file.
 * - handleLogin: Event handler for user actions and interactive flows.
 * - animateButton: Runs animation sequence for smoother UX feedback.
 * - animateError: Runs animation sequence for smoother UX feedback.
 */

import React, { useRef, useState } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Pressable } from "react-native";

import AppButton from "../components/AppButton";
import AppInput from "../components/AppInput";
import BrandLogo from "../components/BrandLogo";
import SchoolItemsBackground from "../components/SchoolItemsBackground";
import ScreenLayout from "../components/ScreenLayout";
import { useAuth } from "../hooks/AuthContext";
import { useI18n } from "../hooks/I18nContext";
import { useThemeMode } from "../hooks/ThemeContext";

export default function LoginScreen() {
  const { signIn } = useAuth();
  const { t } = useI18n();
  const { theme } = useThemeMode();

  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({
    login: false,
    password: false,
  });

  const shakeX = useRef(new Animated.Value(0)).current;
  const buttonScale = useRef(new Animated.Value(1)).current;

  const animateButton = () => {
    Animated.sequence([
      Animated.timing(buttonScale, {
        toValue: 0.98,
        duration: 90,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(buttonScale, {
        toValue: 1,
        duration: 120,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();
  };

  const animateError = () => {
    shakeX.setValue(0);
    Animated.sequence([
      Animated.timing(shakeX, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeX, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeX, { toValue: 8, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeX, { toValue: -8, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeX, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  };

  const handleLogin = async () => {
    const loginHasError = !login.trim();
    const passwordHasError = !password.trim();

    if (loginHasError || passwordHasError) {
      setFieldErrors({
        login: loginHasError,
        password: passwordHasError,
      });
      setErrorMessage("");
      animateError();
      return;
    }

    setFieldErrors({
      login: false,
      password: false,
    });
    setErrorMessage("");
    animateButton();
    setLoading(true);
    try {
      await signIn({ login: login.trim(), password });
    } catch (error) {
      const rawMessage = error?.response?.data?.error;
      const message =
        rawMessage === "Invalid credentials" ? t("invalidCredentials") : rawMessage || t("networkError");
      setErrorMessage(message);
      setFieldErrors({
        login: true,
        password: true,
      });
      animateError();
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenLayout scroll={false} contentContainerStyle={styles.layoutContent}>
      <View style={styles.page}>
        <SchoolItemsBackground />

        <Animated.View
          style={[
            styles.card,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
              transform: [{ translateX: shakeX }],
            },
          ]}
        >
          <View style={styles.logoWrap}>
            <BrandLogo size={56} showSubtitle />
          </View>

          <View style={styles.formBlock}>
            <AppInput
              style={styles.inputSpacing}
              value={login}
              onChangeText={(value) => {
                setLogin(value);
                setFieldErrors((prev) => ({ ...prev, login: false }));
                if (errorMessage) setErrorMessage("");
              }}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder={t("loginLabel")}
              hasError={fieldErrors.login}
            />

            <AppInput
              style={styles.inputSpacing}
              value={password}
              onChangeText={(value) => {
                setPassword(value);
                setFieldErrors((prev) => ({ ...prev, password: false }));
                if (errorMessage) setErrorMessage("");
              }}
              secureTextEntry={!isPasswordVisible}
              placeholder={t("password")}
              hasError={fieldErrors.password}
              rightElement={
                <Pressable
                  onPress={() => setIsPasswordVisible((prev) => !prev)}
                  hitSlop={10}
                  style={styles.eyeButton}
                >
                  <Ionicons
                    name={isPasswordVisible ? "eye-off-outline" : "eye-outline"}
                    size={18}
                    color={theme.colors.textMuted}
                  />
                </Pressable>
              }
            />

            {errorMessage ? (
              <Text style={[styles.errorText, { color: theme.colors.text }]}>{errorMessage}</Text>
            ) : null}

            <Animated.View style={[styles.buttonWrap, { transform: [{ scale: buttonScale }] }]}>
              <AppButton
                title={loading ? t("signingIn") : t("signIn")}
                onPress={handleLogin}
                loading={loading}
              />
            </Animated.View>
          </View>
        </Animated.View>
      </View>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  layoutContent: {
    flex: 1,
    padding: 0,
  },
  page: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 16,
    backgroundColor: "#f5f5f0",
  },
  card: {
    width: "100%",
    maxWidth: 380,
    minHeight: 340,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 28,
  },
  logoWrap: {
    alignItems: "center",
    marginBottom: 24,
  },
  formBlock: {
    marginTop: 12,
    paddingHorizontal: 8,
  },
  inputSpacing: {
    marginBottom: 14,
  },
  errorText: {
    fontSize: 13,
    marginBottom: 10,
    fontFamily: "serif",
  },
  buttonWrap: {
    marginTop: 8,
  },
  eyeButton: {
    minWidth: 28,
    alignItems: "center",
    justifyContent: "center",
  },
});
