/**
 * Module: app/components/OverflowMenu.js
 *
 * Purpose:
 * - Reusable UI component module: OverflowMenu.
 *
 * Module notes:
 * - Imports count: 3.
 * - This header is written for beginners: read purpose first, then function map below.
 *
 * Function map:
 * - OverflowMenu: Main React component or UI container exported by this file.
 * - close: Controls modal/sheet/screen visibility or navigation transition.
 * - onOptionPress: Callback function invoked by UI or navigation events.
 */

import React, { useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

import { useThemeMode } from "../hooks/ThemeContext";

export default function OverflowMenu({
  options = [],
  disabled = false,
  buttonLabel = "⋮",
  buttonHint,
  style,
}) {
  const { theme } = useThemeMode();
  const [visible, setVisible] = useState(false);

  const close = () => setVisible(false);

  const onOptionPress = (handler) => {
    close();
    if (typeof handler === "function") {
      handler();
    }
  };

  return (
    <>
      <Pressable
        onPress={() => setVisible(true)}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={buttonHint}
        style={({ pressed }) => [
          styles.trigger,
          {
            borderColor: theme.colors.border,
            backgroundColor: theme.colors.surface,
            opacity: disabled ? 0.45 : pressed ? 0.85 : 1,
          },
          style,
        ]}
      >
        <Text style={[styles.triggerLabel, { color: theme.colors.text, fontFamily: theme.fonts.bold }]}>
          {buttonLabel}
        </Text>
      </Pressable>

      <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
        <Pressable style={styles.overlay} onPress={close}>
          <View
            style={[
              styles.menu,
              {
                borderColor: theme.colors.border,
                backgroundColor: theme.colors.surface,
                shadowColor: theme.colors.text,
              },
            ]}
          >
            {options.map((item, index) => (
              <Pressable
                key={String(item.key)}
                onPress={() => onOptionPress(item.onPress)}
                style={({ pressed }) => [
                  styles.option,
                  {
                    borderBottomColor: theme.colors.border,
                    borderBottomWidth: index === options.length - 1 ? 0 : StyleSheet.hairlineWidth,
                  },
                  pressed ? { backgroundColor: theme.colors.background } : null,
                ]}
              >
                <Text style={[styles.optionText, { color: theme.colors.text, fontFamily: theme.fonts.medium }]}>
                  {item.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    borderWidth: 1,
    width: 38,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  triggerLabel: {
    fontSize: 21,
    lineHeight: 21,
    marginTop: 0,
  },
  overlay: {
    flex: 1,
    justifyContent: "flex-start",
    alignItems: "flex-end",
    paddingTop: 92,
    paddingRight: 18,
  },
  menu: {
    minWidth: 170,
    borderWidth: 1,
    borderRadius: 12,
    overflow: "hidden",
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 4,
  },
  option: {
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  optionText: {
    fontSize: 14,
  },
});
