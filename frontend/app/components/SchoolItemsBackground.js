/**
 * Module: app/components/SchoolItemsBackground.js
 *
 * Purpose:
 * - Reusable UI component module: SchoolItemsBackground.
 *
 * Module notes:
 * - Imports count: 2.
 * - This header is written for beginners: read purpose first, then function map below.
 *
 * Function map:
 * - SchoolItemsBackground: Main React component or UI container exported by this file.
 * - randomInRange: Helper function used by this module business logic.
 * - createConfig: Creates a new entity or submits creation request.
 * - FloatingItem: Main React component or UI container exported by this file.
 * - items: Helper function used by this module business logic.
 */

import React, { useEffect, useMemo, useRef } from "react";
import { Animated, Easing, StyleSheet, Text, useWindowDimensions, View } from "react-native";

const SCHOOL_ITEMS = [
  "📚\uFE0E",
  "📓\uFE0E",
  "📔\uFE0E",
  "📰\uFE0E",
  "🖊\uFE0E",
  "✏\uFE0E",
  "📐\uFE0E",
  "🗂\uFE0E",
  "📄\uFE0E",
];
const ITEMS_COUNT = 14;

function randomInRange(min, max) {
  return min + Math.random() * (max - min);
}

function createConfig(width, height, index) {
  const travelX0 = randomInRange(-width * 0.15, width * 1.05);
  const travelX1 = randomInRange(-width * 0.15, width * 1.05);
  const travelX2 = randomInRange(-width * 0.15, width * 1.05);

  const travelY0 = randomInRange(-height * 0.15, height * 1.05);
  const travelY1 = randomInRange(-height * 0.15, height * 1.05);
  const travelY2 = randomInRange(-height * 0.15, height * 1.05);

  return {
    id: index,
    icon: SCHOOL_ITEMS[index % SCHOOL_ITEMS.length],
    fontSize: Math.round(randomInRange(20, 40)),
    duration: Math.round(randomInRange(18000, 32000)),
    initialDelay: Math.round(randomInRange(0, 6000)),
    rotateStart: randomInRange(-30, 30),
    rotateEnd: randomInRange(220, 460),
    xPath: [travelX0, travelX1, travelX2],
    yPath: [travelY0, travelY1, travelY2],
  };
}

function FloatingItem({ item }) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let timeoutId = null;
    const animation = Animated.loop(
      Animated.timing(progress, {
        toValue: 1,
        duration: item.duration,
        easing: Easing.inOut(Easing.linear),
        useNativeDriver: true,
      }),
      { resetBeforeIteration: true }
    );

    timeoutId = setTimeout(() => {
      animation.start();
    }, item.initialDelay);

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      animation.stop();
    };
  }, [item.duration, item.initialDelay, progress]);

  const translateX = progress.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: item.xPath,
  });

  const translateY = progress.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: item.yPath,
  });

  const rotate = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [`${item.rotateStart}deg`, `${item.rotateEnd}deg`],
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.floatingItem,
        {
          opacity: 1,
          transform: [{ translateX }, { translateY }, { rotate }],
        },
      ]}
    >
      <Text style={[styles.itemText, { fontSize: item.fontSize }]}>{item.icon}</Text>
    </Animated.View>
  );
}

export default function SchoolItemsBackground() {
  const { width, height } = useWindowDimensions();

  const items = useMemo(() => {
    const safeWidth = Math.max(width || 0, 320);
    const safeHeight = Math.max(height || 0, 640);
    return Array.from({ length: ITEMS_COUNT }, (_, idx) => createConfig(safeWidth, safeHeight, idx));
  }, [width, height]);

  return (
    <View pointerEvents="none" style={styles.container}>
      {items.map((item) => (
        <FloatingItem key={`${item.id}-${item.fontSize}`} item={item} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
  },
  floatingItem: {
    position: "absolute",
    left: 0,
    top: 0,
  },
  itemText: {
    color: "#000000",
  },
});
