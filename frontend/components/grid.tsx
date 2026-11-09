"use client";

import {
  CellStyleModule,
  ClientSideRowModelModule,
  enableDevValidations,
  NumberEditorModule,
  PinnedRowModule,
  RowAutoHeightModule,
  SelectEditorModule,
  themeQuartz,
} from "ag-grid-community";
import { AgGridProvider, AgGridReact, type AgGridReactProps } from "ag-grid-react";

if (process.env.NODE_ENV !== "production") {
  enableDevValidations();
}

// Only the features Flick's grids use: editing amounts and days, totals pinned to the bottom,
// rows that grow to fit wrapped text.
const modules = [
  ClientSideRowModelModule,
  NumberEditorModule,
  SelectEditorModule,
  PinnedRowModule,
  RowAutoHeightModule,
  CellStyleModule,
];

// AG Grid as an iOS grouped list: a white card, no frame, hairline rows, small grey headers and
// ink as the accent. Same tokens as the rest of the page (app/globals.css).
export const gridTheme = themeQuartz.withParams({
  fontFamily: "inherit",
  browserColorScheme: "inherit",
  fontSize: 14,
  foregroundColor: "var(--color-ink)",
  backgroundColor: "var(--color-card)",
  accentColor: "var(--color-ink)",
  borderColor: "color-mix(in srgb, var(--color-separator) 50%, transparent)",
  wrapperBorder: false,
  wrapperBorderRadius: 16,
  headerBackgroundColor: "var(--color-card)",
  headerTextColor: "var(--color-secondary)",
  headerFontSize: 12,
  headerFontWeight: 400,
  headerHeight: 36,
  headerColumnBorder: false,
  columnBorder: false,
  rowHeight: 52,
  cellHorizontalPadding: 12,
  rowHoverColor: "color-mix(in srgb, var(--color-fill) 35%, transparent)",
  pinnedRowBackgroundColor: "var(--color-grouped)",
  focusShadow: "none",
  inputFocusBorder: { color: "var(--color-ink)" },
});

/** A Flick-themed AG Grid that grows to fit its rows. */
export function Grid<T>(props: AgGridReactProps<T>) {
  return (
    <AgGridProvider modules={modules}>
      <AgGridReact<T> theme={gridTheme} domLayout="autoHeight" suppressMovableColumns {...props} />
    </AgGridProvider>
  );
}
