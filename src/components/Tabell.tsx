// Tabell.tsx – Minimal RevoGrid sanity test (med korrekt høyde)
// Formål: få gridet synlig i venstrepanelet. Setter container-høyde = props.height.

/* ==== [BLOCK: imports] BEGIN ==== */
import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from "react";
import "@revolist/revogrid";

import type { Rad } from "../core/types";
import { TABLE_COLS, ROW_H } from "../core/layout";
/* ==== [BLOCK: imports] END ==== */

/* ==== [BLOCK: JSX shim] BEGIN ==== */
declare global {
  namespace JSX {
    interface IntrinsicElements {
      "revo-grid": any;
    }
  }
}
/* ==== [BLOCK: JSX shim] END ==== */

/* ==== [BLOCK: typer] BEGIN ==== */
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
/* ==== [BLOCK: typer] END ==== */

/* ==== [BLOCK: komponent] BEGIN ==== */
const Tabell = forwardRef<TabellHandle, Props>(function Tabell(
  {
    rows,
    // setCell, // ikke brukt i minimaltest
    height,
    scrollX,
    onScrollXChange,
    onTotalWidthChange,
    onViewportWidthChange,
    onTopRowChange,
  },
  ref
) {
  const gridRef = useRef<any | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Map kolonner fra TABLE_COLS -> RevoGrid-format
  const columns = useMemo(
    () =>
      TABLE_COLS.map((c) => ({
        name: c.name,
        prop: c.key,
        size: c.width,
        type:
          c.key === "varighet" || c.key === "ap" || c.key === "pp"
            ? "number"
            : "text",
      })),
    []
  );

  // Sett høyde på containeren slik at gridet faktisk synes
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.style.height = `${Math.max(120, height)}px`;
    }
  }, [height]);

  // Sett columns + source imperativt (React 18 + web components)
  useEffect(() => {
    const el = gridRef.current as any;
    if (!el) return;

    // Vent til elementet er i DOM og shadow er klar
    const apply = () => {
      el.columns = columns;
      el.source =
        rows && rows.length
          ? rows
          : [{ navn: "Test-rad 1 (sanity)", start: "2025-10-01", varighet: 5 }];
      const totalW =
        Array.isArray(columns) && columns.length
          ? columns.reduce((acc: number, col: any) => acc + (col.size ?? 120), 0)
          : 0;
      onTotalWidthChange?.(totalW);
    };

    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(() => {
        // microtask i tilfelle
        Promise.resolve().then(apply);
      });
    } else {
      apply();
    }
  }, [columns, rows, onTotalWidthChange]);

  // Best-effort horisontal scroll sync
  useEffect(() => {
    const el = gridRef.current as any;
    if (!el) return;
    try {
      const vp = el.shadowRoot?.querySelector(".rgViewport") as HTMLElement | null;
      if (vp) vp.scrollLeft = scrollX;
    } catch {}
  }, [scrollX]);

  useEffect(() => {
    const el = gridRef.current as any;
    if (!el) return;

    const onScroll = () => {
      try {
        const vp = el.shadowRoot?.querySelector(".rgViewport") as HTMLElement | null;
        if (vp) onScrollXChange?.(vp.scrollLeft || 0);
      } catch {}
    };

    const onViewportScroll = (e: CustomEvent) => {
      const st: any = e.detail || {};
      if (typeof st?.visibleWidth === "number")
        onViewportWidthChange?.(st.visibleWidth);
      if (typeof st?.firstItem === "number") onTopRowChange?.(st.firstItem);
    };

    el.addEventListener("scroll", onScroll as any, { passive: true } as any);
    el.addEventListener("viewportScroll", onViewportScroll as any);

    return () => {
      el.removeEventListener("scroll", onScroll as any);
      el.removeEventListener("viewportScroll", onViewportScroll as any);
    };
  }, [onScrollXChange, onViewportWidthChange, onTopRowChange]);

  // Imperative handle
  useImperativeHandle(ref, () => ({
    scrollToX: (x: number) => {
      try {
        const el = gridRef.current as any;
        const vp = el?.shadowRoot?.querySelector(".rgViewport") as HTMLElement | null;
        if (vp) vp.scrollLeft = x;
      } catch {}
    },
    copySelectionToClipboard: () => {
      try {
        document.execCommand?.("copy");
        return true;
      } catch {
        return false;
      }
    },
  }));

  return (
    <div
      ref={containerRef}
      className="hide-native-scrollbars tabell-grid"
      style={{
        position: "relative",
        overflow: "hidden",
        width: "100%",
        // height settes i effect → `${height}px`
        background: "#fff",
      }}
    >
      <revo-grid
        ref={gridRef}
        theme="material"
        resize
        canFocus
        range
        clipboard
        readonly={false}
        row-size={ROW_H}
        style={{ width: "100%", height: "100%", display: "block" }}
      ></revo-grid>
    </div>
  );
});
/* ==== [BLOCK: komponent] END ==== */

export default Tabell;
