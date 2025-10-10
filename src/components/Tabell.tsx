// Tabell.tsx – RevoGrid debug v0.3.2
// Mål: få gridet synlig. Håndterer høyde, sen registrering av web component,
// imperativ binding av columns/source og viser en debug-strip i UI.

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

  const [dbg, setDbg] = useState<string>("init");

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

  // Høyde på container – kritisk for at gridet skal synes
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.style.height = `${Math.max(200, height)}px`;
      containerRef.current.style.minHeight = "200px";
    }
  }, [height]);

  // Debug helper
  function report(msg: string) {
    setDbg((prev) => `${msg}`);
    // console.log(`[RevoGrid] ${msg}`);
  }

  // Imperativ init: vent til web component er registrert
  useEffect(() => {
    let cancelled = false;

    async function applyProps(el: any) {
      if (!el || cancelled) return;
      try {
        // columns / source
        el.columns = columns;
        const data =
          rows && rows.length
            ? rows
            : [{ navn: "Test-rad 1 (sanity)", start: "2025-10-01", varighet: 5 }];
        el.source = data;

        const totalW =
          Array.isArray(columns) && columns.length
            ? columns.reduce((acc: number, col: any) => acc + (col.size ?? 120), 0)
            : 0;
        onTotalWidthChange?.(totalW);

        report(`ready • rows=${rows?.length ?? 0} • cols=${columns.length}`);
      } catch (err: any) {
        report(`error@applyProps: ${err?.message || err}`);
      }
    }

    const el = gridRef.current as any;
    if (!el) {
      report("no element");
      return;
    }

    // Vent til custom element er definert
    const defined = !!customElements.get("revo-grid");
    if (!defined && (customElements as any).whenDefined) {
      report("waiting for customElements.whenDefined('revo-grid')");
      (customElements as any)
        .whenDefined("revo-grid")
        .then(() => !cancelled && applyProps(el));
    } else {
      report("component defined, applying props");
      // rAF + microtask for å sikre at shadowRoot er klar
      requestAnimationFrame(() => Promise.resolve().then(() => applyProps(el)));
    }

    return () => {
      cancelled = true;
    };
  }, [columns, rows, onTotalWidthChange]);

  // Hold grid i sync ved senere rows-endringer
  useEffect(() => {
    const el = gridRef.current as any;
    if (!el) return;
    try {
      el.source = rows && rows.length
        ? rows
        : [{ navn: "Test-rad 1 (sanity)", start: "2025-10-01", varighet: 5 }];
      report(`update rows → ${rows?.length ?? 0}`);
    } catch {}
  }, [rows]);

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
        background: "#fff",
        borderRight: "1px solid #e5e7eb",
      }}
    >
      {/* Debug-strip – fjern når gridet synes */}
      <div
        style={{
          position: "absolute",
          inset: "0 auto auto 0",
          background: "#f3f4f6",
          color: "#6b7280",
          fontSize: 11,
          padding: "2px 6px",
          borderBottomRightRadius: 6,
          zIndex: 2,
        }}
      >
        grid: {dbg}
      </div>

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
