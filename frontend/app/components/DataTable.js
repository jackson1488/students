/**
 * Module: app/components/DataTable.js
 *
 * Purpose:
 * - Reusable UI component module: DataTable.
 *
 * Module notes:
 * - Imports count: 4.
 * - This header is written for beginners: read purpose first, then function map below.
 *
 * Function map:
 * - DataTable: Main React component or UI container exported by this file.
 * - getCellSizeStyle: Returns computed or fetched data for caller usage.
 * - tableView: Helper function used by this module business logic.
 */

import React from "react";
import { Platform, ScrollView, StyleSheet, Text, View } from "react-native";

import { useThemeMode } from "../hooks/ThemeContext";
import AppCard from "./AppCard";

function getCellSizeStyle(column) {
  if (!column || typeof column.width !== "number" || column.width <= 0) {
    return styles.flexCell;
  }
  return { width: column.width, flexGrow: 0, flexShrink: 0 };
}

export default function DataTable({
  columns,
  rows,
  keyField = "id",
  emptyText,
  tableOnMobile = false,
  horizontal = false,
  minWidth = 560,
}) {
  const { theme } = useThemeMode();

  if (!rows?.length) {
    return null;
  }

  if (Platform.OS !== "web" && !tableOnMobile) {
    return (
      <View>
        {rows.map((row, index) => (
          <AppCard key={String(row[keyField] ?? index)}>
            {columns.map((column) => {
              const value = column.render ? column.render(row) : row[column.key];
              return (
                <View key={column.key} style={styles.mobileRow}>
                  <Text style={[styles.mobileLabel, { color: theme.colors.textMuted }]}>
                    {column.title}
                  </Text>
                  {typeof value === "string" || typeof value === "number" ? (
                    <Text style={[styles.mobileValue, { color: theme.colors.text }]}>{String(value)}</Text>
                  ) : (
                    value
                  )}
                </View>
              );
            })}
          </AppCard>
        ))}
      </View>
    );
  }

  const tableView = (
    <View
      style={[
        styles.table,
        {
          borderColor: theme.colors.border,
          backgroundColor: theme.colors.surface,
        },
        horizontal ? { minWidth } : null,
      ]}
    >
      <View style={[styles.headerRow, { borderColor: theme.colors.border, backgroundColor: theme.colors.rowAlt }]}>
        {columns.map((column, columnIndex) => (
          <Text
            key={column.key}
            style={[
              styles.headerCell,
              getCellSizeStyle(column),
              columnIndex !== columns.length - 1 ? styles.headerCellDivider : null,
              {
                color: theme.colors.text,
                fontFamily: theme.fonts.medium,
                borderColor: theme.colors.border,
                textAlign: column.align === "center" ? "center" : "left",
              },
            ]}
          >
            {column.title}
          </Text>
        ))}
      </View>

      {rows.map((row, rowIndex) => (
        <View
          key={String(row[keyField] ?? rowIndex)}
          style={[
            styles.dataRow,
            {
              borderColor: theme.colors.border,
              backgroundColor: rowIndex % 2 ? theme.colors.rowAlt : theme.colors.surface,
            },
          ]}
        >
          {columns.map((column, columnIndex) => {
            const value = column.render ? column.render(row) : row[column.key];
            return (
              <View
                key={column.key}
                style={[
                  styles.dataCellWrap,
                  getCellSizeStyle(column),
                  column.noPadding ? styles.noPaddingCell : null,
                  columnIndex !== columns.length - 1 ? styles.dataCellDivider : null,
                  { borderColor: theme.colors.border },
                ]}
              >
                {typeof value === "string" || typeof value === "number" ? (
                  <Text
                    style={[
                      styles.dataCell,
                      {
                        color: theme.colors.text,
                        fontFamily: theme.fonts.regular,
                        textAlign: column.align === "center" ? "center" : "left",
                      },
                    ]}
                  >
                    {String(value)}
                  </Text>
                ) : (
                  value
                )}
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );

  if (horizontal) {
    return (
      <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={styles.scrollContent}>
        {tableView}
      </ScrollView>
    );
  }

  return tableView;
}

const styles = StyleSheet.create({
  table: {
    borderWidth: 1,
    borderRadius: 12,
    overflow: "hidden",
    width: "100%",
  },
  flexCell: {
    flex: 1,
  },
  headerRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
  },
  headerCell: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
  },
  headerCellDivider: {
    borderRightWidth: 1,
  },
  dataRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
  },
  dataCellWrap: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    justifyContent: "center",
  },
  noPaddingCell: {
    paddingHorizontal: 4,
    paddingVertical: 6,
  },
  dataCellDivider: {
    borderRightWidth: 1,
  },
  dataCell: {
    fontSize: 13,
  },
  mobileRow: {
    marginBottom: 8,
  },
  mobileLabel: {
    fontSize: 12,
    marginBottom: 2,
    fontFamily: "serif",
  },
  mobileValue: {
    fontSize: 14,
    fontFamily: "serif",
  },
  scrollContent: {
    paddingBottom: 2,
  },
});
