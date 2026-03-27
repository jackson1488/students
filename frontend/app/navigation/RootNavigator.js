/**
 * Module: app/navigation/RootNavigator.js
 *
 * Purpose:
 * - Defines main navigation structure and route tree.
 *
 * Module notes:
 * - Imports count: 35.
 * - This header is written for beginners: read purpose first, then function map below.
 *
 * Function map:
 * - RootNavigator: Main React component or UI container exported by this file.
 * - buildRoleScreens: Builds derived values and resolves runtime decisions.
 * - DrawerShell: Main React component or UI container exported by this file.
 * - screens: Helper function used by this module business logic.
 */

import React, { useMemo } from "react";
import { Platform, View, useWindowDimensions } from "react-native";
import { createDrawerNavigator } from "@react-navigation/drawer";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import BrandLogo from "../components/BrandLogo";
import LoadingView from "../components/LoadingView";
import { useAuth } from "../hooks/AuthContext";
import { useI18n } from "../hooks/I18nContext";
import { useThemeMode } from "../hooks/ThemeContext";

import LoginScreen from "../screens/LoginScreen";
import DashboardScreen from "../screens/DashboardScreen";
import UsersScreen from "../screens/UsersScreen";
import SwitchUserScreen from "../screens/SwitchUserScreen";
import TestsScreen from "../screens/TestsScreen";
import LibraryScreen from "../screens/LibraryScreen";
import LibraryReaderScreen from "../screens/LibraryReaderScreen";
import NewsScreen from "../screens/NewsScreen.js";
import NewsDetailScreen from "../screens/NewsDetailScreen.js";
import ScheduleScreen from "../screens/ScheduleScreen.js";
import GradesScreen from "../screens/GradesScreen.js";
import ModuleDetailsScreen from "../screens/ModuleDetailsScreen.js";
import AttendanceScreen from "../screens/AttendanceScreen.js";
import ChatScreen from "../screens/ChatScreen.js";
import ChatThreadScreen from "../screens/ChatThreadScreen.js";
import ChatWebViewScreen from "../screens/ChatWebViewScreen.js";
import HomeworkScreen from "../screens/HomeworkScreen.js";
import HomeworkDetailScreen from "../screens/HomeworkDetailScreen.js";
import HomeworkSubmitScreen from "../screens/HomeworkSubmitScreen.js";
import ChangePasswordScreen from "../screens/ChangePasswordScreen.js";
import SettingsScreen from "../screens/SettingsScreen.js";
import SupportScreen from "../screens/SupportScreen.js";
import ProfileDetailsScreen from "../screens/ProfileDetailsScreen.js";
import TeacherProfileAdminScreen from "../screens/TeacherProfileAdminScreen.js";
import StudentProfileAdminScreen from "../screens/StudentProfileAdminScreen.js";

import AppDrawerContent from "./AppDrawerContent";

const Stack = createNativeStackNavigator();
const Drawer = createDrawerNavigator();

function buildRoleScreens(role, t) {
  if (role === "admin") {
    return [
      { name: "Dashboard", title: t("profile"), component: DashboardScreen },
      { name: "SwitchUser", title: t("switchUser"), component: SwitchUserScreen },
      { name: "Users", title: t("users"), component: UsersScreen },
      { name: "Grades", title: t("grades"), component: GradesScreen },
      { name: "Attendance", title: t("attendance"), component: AttendanceScreen },
      { name: "Homework", title: t("homework"), component: HomeworkScreen },
      { name: "Tests", title: t("tests"), component: TestsScreen },
      { name: "Library", title: t("library"), component: LibraryScreen },
      { name: "News", title: t("news"), component: NewsScreen },
      { name: "Schedule", title: t("schedule"), component: ScheduleScreen },
      { name: "Chat", title: t("chat"), component: ChatScreen },
    ];
  }

  if (role === "teacher") {
    return [
      { name: "Dashboard", title: t("profile"), component: DashboardScreen },
      { name: "Grades", title: t("grades"), component: GradesScreen },
      { name: "Attendance", title: t("attendance"), component: AttendanceScreen },
      { name: "Homework", title: t("homework"), component: HomeworkScreen },
      { name: "Tests", title: t("tests"), component: TestsScreen },
      { name: "Schedule", title: t("schedule"), component: ScheduleScreen },
      { name: "Library", title: t("library"), component: LibraryScreen },
      { name: "News", title: t("news"), component: NewsScreen },
      { name: "Chat", title: t("chat"), component: ChatScreen },
    ];
  }

  if (role === "scheduler" || role === "rector") {
    return [
      { name: "Dashboard", title: t("profile"), component: DashboardScreen },
      { name: "Schedule", title: t("schedule"), component: ScheduleScreen },
      { name: "News", title: t("news"), component: NewsScreen },
      { name: "Library", title: t("library"), component: LibraryScreen },
    ];
  }

  return [
    { name: "Dashboard", title: t("profile"), component: DashboardScreen },
    { name: "MyGrades", title: t("myGrades"), component: GradesScreen },
    { name: "MyTests", title: t("myTests"), component: TestsScreen },
    { name: "Homework", title: t("homework"), component: HomeworkScreen },
    { name: "Library", title: t("library"), component: LibraryScreen },
    { name: "News", title: t("news"), component: NewsScreen },
    { name: "Schedule", title: t("schedule"), component: ScheduleScreen },
    { name: "Chat", title: t("chat"), component: ChatScreen },
  ];
}

function DrawerShell() {
  const { theme } = useThemeMode();
  const { t } = useI18n();
  const { role } = useAuth();
  const { width } = useWindowDimensions();

  const screens = useMemo(() => buildRoleScreens(role, t), [role, t]);
  const compactWeb = Platform.OS === "web" && width < 1100;

  return (
    <Drawer.Navigator
      initialRouteName={screens[0]?.name}
      drawerContent={(props) => <AppDrawerContent {...props} />}
      screenOptions={{
        drawerType: Platform.OS === "web" ? (compactWeb ? "front" : "permanent") : "front",
        swipeEnabled: Platform.OS !== "web" || compactWeb,
        drawerStyle: {
          width: Platform.OS === "web" && !compactWeb ? 300 : 280,
          backgroundColor: theme.colors.sidebar,
          borderRightWidth: 1,
          borderRightColor: theme.colors.border,
        },
        sceneStyle: {
          backgroundColor: theme.colors.background,
        },
        drawerLabelStyle: {
          color: theme.colors.text,
          fontFamily: theme.fonts.medium,
          fontSize: 14,
        },
        headerStyle: {
          backgroundColor: theme.colors.surface,
        },
        headerTintColor: theme.colors.text,
        headerTitleStyle: {
          fontFamily: theme.fonts.bold,
        },
        headerRight:
          Platform.OS !== "web" || compactWeb
            ? () => (
                <View style={{ paddingRight: 10 }}>
                  <BrandLogo size={22} showText={false} />
                </View>
              )
            : undefined,
        headerShown: Platform.OS !== "web" || compactWeb,
      }}
    >
      {screens.map((screen) => (
        <Drawer.Screen
          key={screen.name}
          name={screen.name}
          component={screen.component}
          options={{
            title: screen.title,
            drawerLabel: screen.title,
          }}
        />
      ))}
    </Drawer.Navigator>
  );
}

export default function RootNavigator() {
  const { isLoading, isAuthenticated } = useAuth();
  const { isReady: i18nReady, t } = useI18n();
  const { isReady: themeReady, theme } = useThemeMode();

  if (isLoading || !i18nReady || !themeReady) {
    return <LoadingView />;
  }

  const detailOptions = {
    headerShown: true,
    headerStyle: {
      backgroundColor: theme.colors.surface,
    },
    headerTintColor: theme.colors.text,
    headerTitleStyle: {
      fontFamily: theme.fonts.bold,
    },
    headerRight:
      Platform.OS !== "web"
        ? () => (
            <View style={{ paddingRight: 10 }}>
              <BrandLogo size={22} showText={false} />
            </View>
          )
        : undefined,
    gestureEnabled: Platform.OS !== "web",
  };

  return (
    <Stack.Navigator screenOptions={{ headerShown: false, gestureEnabled: Platform.OS !== "web" }}>
      {isAuthenticated ? (
        <>
          <Stack.Screen name="App" component={DrawerShell} />
          <Stack.Screen name="NewsDetail" component={NewsDetailScreen} options={{ ...detailOptions, title: t("newsDetail") }} />
          <Stack.Screen
            name="LibraryReader"
            component={LibraryReaderScreen}
            options={{
              headerShown: false,
              gestureEnabled: Platform.OS !== "web",
            }}
          />
          <Stack.Screen name="ChatThread" component={ChatThreadScreen} options={{ ...detailOptions, title: t("conversation") }} />
          <Stack.Screen name="ChatWebView" component={ChatWebViewScreen} options={{ ...detailOptions, title: t("chatLink") }} />
          <Stack.Screen name="HomeworkDetail" component={HomeworkDetailScreen} options={{ ...detailOptions, title: t("homeworkDetail") }} />
          <Stack.Screen name="HomeworkSubmit" component={HomeworkSubmitScreen} options={{ ...detailOptions, title: t("submitHomeworkAction") }} />
          <Stack.Screen name="ModuleDetails" component={ModuleDetailsScreen} options={{ ...detailOptions, title: t("moduleDetails") }} />
          <Stack.Screen name="ProfileDetails" component={ProfileDetailsScreen} options={{ ...detailOptions, title: t("myData") }} />
          <Stack.Screen
            name="TeacherProfileAdmin"
            component={TeacherProfileAdminScreen}
            options={{ ...detailOptions, title: t("teacherProfile") }}
          />
          <Stack.Screen
            name="StudentProfileAdmin"
            component={StudentProfileAdminScreen}
            options={{ ...detailOptions, title: t("studentProfile") }}
          />
          <Stack.Screen name="Settings" component={SettingsScreen} options={{ ...detailOptions, title: t("settings") }} />
          <Stack.Screen
            name="ChangePassword"
            component={ChangePasswordScreen}
            options={{ ...detailOptions, title: t("changePassword") }}
          />
          <Stack.Screen name="Support" component={SupportScreen} options={{ ...detailOptions, title: t("support") }} />
        </>
      ) : (
        <Stack.Screen name="Login" component={LoginScreen} />
      )}
    </Stack.Navigator>
  );
}
