// Tabell.tsx – Minimal RevoGrid sanity test med kompatibelt API mot Fremdriftsplan
// Formål: få vekk build-feil og verifisere at RevoGrid faktisk rendrer i din stack.

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

  // disse brukes av Fremdriftsplan; vi trenger ikke alle i testen, men de må finnes
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
    // height,
    scrollX,
    onScrollXChange,
    onTotalWidthChange,
    // onSelectionChange,
    onViewportWidthChange,
    onTopRowChange,
  },
  ref
) {
  const gridRef = useRef<any | null>(null);

  // Map kolonner fra TABLE_COLS -> RevoGrid-format
  const columns = useMemo(
    () =>
      TABLE_COLS.map((c) => ({
        name: c.name,
        prop: c.key,
        size: c.width,
        // enkel typehint
        type:
          c.key === "varighet" || c.key === "ap" || c.key === "pp"
            ? "number"
            : "text",
      })),
    []
  );

  // Sett columns + source imperativt (viktig for React 18 + web components)
  useEffect(() => {
    const el = gridRef.current as any;
    if (!el) return;

    el.columns = columns;
    el.source =
      rows && rows.length
        ? rows
        : [{ navn: "Test-rad 1 (sanity)", start: "2025-10-01", varighet: 5 }];

    // Rapportér total bredde om ønsket
    const totalW =
      Array.isArray(columns) && columns.length
        ? columns.reduce((acc: number, col: any) => acc + (col.size ?? 120), 0)
        : 0;
    onTotalWidthChange?.(totalW);
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

    // viewport info (bredde/topprad)
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
    <div className="hide-native-scrollbars tabell-grid" style={{ position: "relative", overflow: "hidden" }}>
      <revo-grid
        ref={gridRef}
        theme="material"
        resize
        canFocus
        range
        clipboard
        readonly={false}
        row-size={ROW_H}
      ></revo-grid>
    </div>
  );
});
/* ==== [BLOCK: komponent] END ==== */

export default Tabell;
