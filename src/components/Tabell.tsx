// Tabell.tsx – RevoGrid-variant
// v0.3.2: Fix "blankt lerret": eksplisitt høyde, whenDefined + rAF for columns/source, refresh etter set
//         Beholder dato-normalisering, regler/prompt, kalender (dblklikk/Alt+↓).

/* ==== [BLOCK: imports] BEGIN ==== */
import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import "@revolist/revogrid";
import type { Rad } from "../core/types";
import { HEADER_H, ROW_H, TABLE_COLS } from "../core/layout";
import { toDate, canonicalizeDateInput } from "../core/date";
import { planAfterEdit, resolvePrompt, type RecalcPromptMeta } from "../core/recalc";
/* ==== [BLOCK: imports] END ==== */

/* ==== [BLOCK: types & handles] BEGIN ==== */
export type KolonneKey = (typeof TABLE_COLS)[number]["key"];

export type TabellHandle = {
  scrollToX: (x: number) => void;
  copySelectionToClipboard: () => boolean;
};

type Props = {
  rows: Rad[];
  setCell: (rowIndex: number, key: keyof Rad, value: Rad[keyof Rad]) => void;
  height: number;
  scrollX: number;
  onScrollXChange: (x: number) => void;
  onTotalWidthChange?: (w: number) => void;
  onSelectionChange?: (cells: { r: number; c: KolonneKey }[]) => void;
  onViewportWidthChange?: (w: number) => void;
  onTopRowChange?: (top: number) => void;
};
/* ==== [BLOCK: types & handles] END ==== */

/* ==== [BLOCK: JSX shim] BEGIN ==== */
declare global {
  namespace JSX {
    interface IntrinsicElements {
      "revo-grid": any;
    }
  }
}
/* ==== [BLOCK: JSX shim] END ==== */

/* ==== [BLOCK: component] BEGIN ==== */
const Tabell = forwardRef<TabellHandle, Props>(function Tabell(
  {
    rows,
    setCell,
    height,
    scrollX,
    onScrollXChange,
    onTotalWidthChange,
    onSelectionChange,
    onViewportWidthChange,
    onTopRowChange,
  },
  ref
) {
  /* ==== [BLOCK: refs] BEGIN ==== */
  const gridRef = useRef<any | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const focusRef = use
