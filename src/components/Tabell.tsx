// /src/components/Tabell.tsx
// RevoGrid – v0.5.2 (manuell commit-on-blur + full regler/kalender)

/* ==== [BLOCK: imports] BEGIN ==== */
import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import type { Rad } from "../core/types";
import { HEADER_H, ROW_H, TABLE_COLS } from "../core/layout";
import { toDate, canonicalizeDateInput } from "../core/date";
import {
  planAfterEdit,
  resolvePrompt,
  type RecalcPromptMeta,
} from "../core/recalc";
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
  const focusRef = useRef<{ rowIndex: number; colKey: KolonneKey } | null>(null);
  const lastClickPos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  /* ==== [BLOCK: refs] END ==== */

  /* ==== [BLOCK: prompt state] BEGIN ==== */
  const [prompt, setPrompt] = useState<(RecalcPromptMeta & { row: number }) | null>(null);
  /* ==== [BLOCK: prompt state] END ==== */

  /* ==== [BLOCK: date popover state] BEGIN ==== */
  const [datePop, setDatePop] = useState<{
    open: boolean;
    row: number;
    key: "start" | "slutt";
    value: string;
    x: number;
    y: number;
  } | null>(null);
  /* ==== [BLOCK: date popover state] END ==== */

  /* ==== [BLOCK: columns mapping] BEGIN ==== */
  const columns = useMemo(() => {
    const nrCol = { name: "#", prop: "_row", size: 56, type: "text" } as const;
    const mapped = TABLE_COLS.map((c) => ({
      name: c.name,
      prop: c.key,
      size: Math.max(80, c.width ?? 120),
      type: c.key === "varighet" || c.key === "ap" || c.key === "pp" ? "number" : "text",
    }));
    return [nrCol, ...mapped];
  }, []);
  /* ==== [BLOCK: columns mapping] END ==== */

  /* ==== [BLOCK: container height] BEGIN ==== */
  useEffect(() => {
    if (!containerRef.current) return;
    const desired = Math.max(HEADER_H + rows.length * ROW_H + 8, 240, height);
    containerRef.current.style.height = `${desired}px`;
    containerRef.current.style.minHeight = "240px";
  }, [height, rows.length]);
  /* ==== [BLOCK: container height] END ==== */

  /* ==== [BLOCK: data mapping (radnr uten å endre global state)] BEGIN ==== */
  const viewData = useMemo(() => rows.map((r, i) => ({ _row: String(i + 1), ...r })), [rows]);
  /* ==== [BLOCK: data mapping (radnr uten å endre global state)] END ==== */

  /* ==== [BLOCK: imperative init + event binding] BEGIN ==== */
  useEffect(() => {
    const el = gridRef.current as any;
    if (!el) return;

    const apply = () => {
      el.columns = columns;
      el.source = viewData;

      const totalW = columns.reduce((acc: number, c: any) => acc + (c.size ?? 120), 0);
      onTotalWidthChange?.(totalW);

      if (typeof el.refresh === "function") el.refresh("all");
    };

    const ensure = () => requestAnimationFrame(() => Promise.resolve().then(apply));

    if (!customElements.get("revo-grid") && (customElements as any).whenDefined) {
      (customElements as any).whenDefined("revo-grid").then(ensure);
    } else {
      ensure();
    }

    const onSelectionChanged = (e: CustomEvent) => {
      const det: any = e.detail ?? {};
      const ranges: any[] = det?.rgRange || det?.range || [];
      const cells: { r: number; c: KolonneKey }[] = [];
      for (const r of ranges) {
        const { x = 0, y = 0, width = 1, height = 1 } = r || {};
        for (let rr = y; rr < y + height; rr++) {
          for (let cc = x; cc < x + width; cc++) {
            const ourIndex = cc - 1; // -1 pga # kolonne
            const key = TABLE_COLS[ourIndex]?.key as KolonneKey;
            if (ourIndex >= 0 && key) cells.push({ r: rr, c: key });
          }
        }
      }
      onSelectionChange?.(cells);
      if (ranges[0]) {
        const { x = 0, y = 0 } = ranges[0];
        const ourIndex = x - 1;
        const key = (TABLE_COLS[ourIndex]?.key || "navn") as KolonneKey;
        focusRef.current = { rowIndex: y, colKey: key };
      }
    };

    const onCellFocus = (e: CustomEvent) => {
      const det: any = e.detail ?? {};
      const rowIndex = Number(det?.rowIndex ?? det?.row ?? -1);
      const colProp: string | undefined = det?.columnProp || det?.prop;
      if (!Number.isFinite(rowIndex) || rowIndex < 0) return;
      if (!colProp || colProp === "_row") return;
      focusRef.current = { rowIndex, colKey: colProp as KolonneKey };
    };

    const handleAfterEdit = (e: CustomEvent) => {
      const det: any = e.detail ?? {};
      const rowIndex: number = det?.row;
      const colKey: string = det?.col;
      const rawVal: any = det?.value;
      if (rowIndex == null || colKey == null || !rows[rowIndex]) return;
      if (colKey === "_row") return;
      commitEdit(rowIndex, colKey as KolonneKey, rawVal);
    };

    el.addEventListener("selectionChanged", onSelectionChanged as any);
    el.addEventListener("cellFocus", onCellFocus as any);
    el.addEventListener("afteredit", handleAfterEdit as any);
    el.addEventListener("afterEdit", handleAfterEdit as any);

    return () => {
      el.removeEventListener("selectionChanged", onSelectionChanged as any);
      el.removeEventListener("cellFocus", onCellFocus as any);
      el.removeEventListener("afteredit", handleAfterEdit as any);
      el.removeEventListener("afterEdit", handleAfterEdit as any);
    };
  }, [columns, viewData, rows]);
  /* ==== [BLOCK: imperative init + event binding] END ==== */

  /* ==== [BLOCK: commit helper] BEGIN ==== */
  const commitEdit = (rowIndex: number, colKey: KolonneKey, rawVal: any) => {
    // Normaliser verdi
    let committed: any = rawVal;
    if (colKey === "start" || colKey === "slutt") {
      const { normalized } = canonicalizeDateInput(rawVal);
      committed = normalized || "";
    } else if (colKey === "varighet" || colKey === "ap" || colKey === "pp") {
      const n = Number(String(rawVal ?? "").replace(",", "."));
      committed = Number.isFinite(n) ? n : "";
    } else {
      committed = String(rawVal ?? "");
    }

    // Lagre celle
    setCell(rowIndex, colKey as keyof Rad, committed as any);

    // Regler → autoPatch/prompt
    const curr = rows[rowIndex];
    const nextRow: Rad = { ...curr, [colKey]: committed } as Rad;
    const plan = planAfterEdit(nextRow, colKey as any);

    if (plan.prompt) {
      setPrompt({ ...plan.prompt, row: rowIndex });
      return;
    }
    if (plan.autoPatch) {
      for (const [k, v] of Object.entries(plan.autoPatch)) {
        setCell(rowIndex, k as keyof Rad, v as any);
      }
    }

    const s2 = toDate((plan.autoPatch?.start as any) ?? nextRow.start);
    const e2 = toDate((plan.autoPatch?.slutt as any) ?? nextRow.slutt);
    if (s2 && e2 && e2 < s2) {
      setCell(rowIndex, "varighet", "" as any);
    }
  };
  /* ==== [BLOCK: commit helper] END ==== */

  /* ==== [BLOCK: manual commit-on-click-away] BEGIN ==== */
  useEffect(() => {
    const onPointerDown = (ev: PointerEvent) => {
      const gridEl = gridRef.current as any;
      if (!gridEl) return;

      const shadow = gridEl.shadowRoot as ShadowRoot | null;
      if (!shadow) return;

      // Finn editor-input i RevoGrid
      const editor =
        (shadow.querySelector(".editCell input, .editCell textarea") as
          | HTMLInputElement
          | HTMLTextAreaElement
          | null) ||
        (shadow.querySelector("input.rgInput, textarea.rgInput") as
          | HTMLInputElement
          | HTMLTextAreaElement
          | null);

      if (!editor) return;

      // Klikk inne i editor? → la RevoGrid håndtere selv
      const path = (ev.composedPath && (ev.composedPath() as EventTarget[])) || [];
      if (path.includes(editor)) return;

      // Hvis vi har fokusert celle, commit før editor lukkes
      const focus = focusRef.current;
      if (!focus) return;

      const { rowIndex, colKey } = focus;
      if (!rows[rowIndex]) return;
      if (colKey === "_row") return;

      const rawVal = editor.value;
      commitEdit(rowIndex, colKey, rawVal);
      // Ikke stopp event – vi vil at klikket fortsatt skal skje (lukke editor)
    };

    // Capture: kjør før blur/cancel
    window.addEventListener("pointerdown", onPointerDown, { capture: true });
    return () => window.removeEventListener("pointerdown", onPointerDown as any, { capture: true } as any);
  }, [rows]);
  /* ==== [BLOCK: manual commit-on-click-away] END ==== */

  /* ==== [BLOCK: keep rows in sync] BEGIN ==== */
  useEffect(() => {
    const el = gridRef.current as any;
    if (!el) return;
    el.source = viewData;
    if (typeof el.refresh === "function") el.refresh("viewport");
  }, [viewData]);
  /* ==== [BLOCK: keep rows in sync] END ==== */

  /* ==== [BLOCK: H-scroll sync] BEGIN ==== */
  useEffect(() => {
    const el = gridRef.current as any;
    if (!el) return;
    const vp = el.shadowRoot?.querySelector(".rgViewport") as HTMLElement | null;
    if (vp) vp.scrollLeft = scrollX;
  }, [scrollX]);

  useEffect(() => {
    const el = gridRef.current as any;
    if (!el) return;
    const onScroll = () => {
      const vp = el.shadowRoot?.querySelector(".rgViewport") as HTMLElement | null;
      if (vp) onScrollXChange?.(vp.scrollLeft || 0);
    };
    const onViewportScroll = (e: CustomEvent) => {
      const st: any = e.detail || {};
      if (typeof st?.visibleWidth === "number") onViewportWidthChange?.(st.visibleWidth);
      if (typeof st?.firstItem === "number") onTopRowChange?.(st.firstItem);
    };
    el.addEventListener("scroll", onScroll as any, { passive: true } as any);
    el.addEventListener("viewportScroll", onViewportScroll as any);
    return () => {
      el.removeEventListener("scroll", onScroll as any);
      el.removeEventListener("viewportScroll", onViewportScroll as any);
    };
  }, [onScrollXChange, onViewportWidthChange, onTopRowChange]);
  /* ==== [BLOCK: H-scroll sync] END ==== */

  /* ==== [BLOCK: dblklikk/Alt+↓ kalender] BEGIN ==== */
  useEffect(() => {
    const onMouseDown = (e: MouseEvent) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) return;
      const rect = containerRef.current.getBoundingClientRect();
      lastClickPos.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };
    window.addEventListener("mousedown", onMouseDown, { capture: true });

    const onKeyDown = (e: KeyboardEvent) => {
      const within =
        containerRef.current &&
        (containerRef.current === document.activeElement ||
          containerRef.current.contains(document.activeElement));
      if (!within) return;

      if (e.altKey && e.key === "ArrowDown") {
        const focus = focusRef.current;
        if (!focus) return;
        const { rowIndex, colKey } = focus;
        if (colKey !== "start" && colKey !== "slutt") return;
        e.preventDefault();
        e.stopPropagation();

        const val = String(rows[rowIndex]?.[colKey] ?? "");
        const pos = lastClickPos.current || { x: 20, y: 20 };
        setDatePop({
          open: true,
          row: rowIndex,
          key: colKey as "start" | "slutt",
          value: val,
          x: pos.x,
          y: pos.y,
        });
      }
    };
    window.addEventListener("keydown", onKeyDown, { capture: true });

    return () => {
      window.removeEventListener("mousedown", onMouseDown as any, { capture: true } as any);
      window.removeEventListener("keydown", onKeyDown as any, { capture: true } as any);
    };
  }, [rows]);

  const onContainerDoubleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const focus = focusRef.current;
    if (!focus) return;
    const { rowIndex, colKey } = focus;
    if (colKey !== "start" && colKey !== "slutt") return;

    const rect = containerRef.current?.getBoundingClientRect();
    const pos = rect
      ? { x: e.clientX - rect.left, y: e.clientY - rect.top }
      : lastClickPos.current || { x: 20, y: 20 };

    const val = String(rows[rowIndex]?.[colKey] ?? "");
    setDatePop({
      open: true,
      row: rowIndex,
      key: colKey as "start" | "slutt",
      value: val,
      x: pos.x,
      y: pos.y,
    });
  };
  /* ==== [BLOCK: dblklikk/Alt+↓ kalender] END ==== */

  /* ==== [BLOCK: imperative handle] BEGIN ==== */
  useImperativeHandle(ref, () => ({
    scrollToX: (x: number) => {
      const el = gridRef.current as any;
      const vp = el?.shadowRoot?.querySelector(".rgViewport") as HTMLElement | null;
      if (vp) vp.scrollLeft = x;
    },
    copySelectionToClipboard: () => {
      try { document.execCommand?.("copy"); return true; } catch { return false; }
    },
  }));
  /* ==== [BLOCK: imperative handle] END ==== */

  /* ==== [BLOCK: render] BEGIN ==== */
  const themeVars: React.CSSProperties = {
    // @ts-ignore
    "--revogrid-header-bg": "#f9fafb",
    "--revogrid-border-color": "#e5e7eb",
    "--revogrid-row-hover-bg": "#f3f4f6",
    "--revogrid-font-color": "#111827",
    "--revogrid-cell-padding": "4px 8px",
    "--revogrid-row-height": `${ROW_H}px`,
  };

  return (
    <div
      ref={containerRef}
      className="tabell-grid"
      style={{ position: "relative", overflow: "hidden", width: "100%", background: "#fff" }}
      onDoubleClick={onContainerDoubleClick}
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
        style={{ width: "100%", height: "100%", display: "block", ...themeVars }}
      ></revo-grid>

      {prompt && (
        <RecalcDialog
          prompt={prompt}
          onApply={(action) => {
            const patch = resolvePrompt(prompt.nextRow, prompt.kind, action);
            for (const [k, v] of Object.entries(patch)) {
              setCell(prompt.row, k as keyof Rad, v as any);
            }
            setPrompt(null);
          }}
          onCancel={() => setPrompt(null)}
        />
      )}

      {datePop?.open && (
        <DatePopover
          x={datePop.x}
          y={datePop.y}
          value={datePop.value}
          onChange={(iso) => {
            setCell(datePop.row, datePop.key, iso as any);
            const nextRow: Rad = { ...rows[datePop.row], [datePop.key]: iso } as Rad;
            const plan = planAfterEdit(nextRow, datePop.key);
            if (plan.autoPatch) {
              for (const [k, v] of Object.entries(plan.autoPatch)) {
                setCell(datePop.row, k as keyof Rad, v as any);
              }
            }
            setDatePop(null);
          }}
          onCancel={() => setDatePop(null)}
        />
      )}
    </div>
  );
  /* ==== [BLOCK: render] END ==== */
});
/* ==== [BLOCK: komponent] END ==== */

export default Tabell;

/* ==== [BLOCK: RecalcDialog component] BEGIN ==== */
function RecalcDialog({
  prompt,
  onApply,
  onCancel,
}: {
  prompt: RecalcPromptMeta & { row: number };
  onApply: (action: "keep-duration" | "keep-end" | "keep-start") => void;
  onCancel: () => void;
}) {
  const { kind } = prompt;

  let title = "";
  let options: { key: "keep-duration" | "keep-end" | "keep-start"; label: string; desc?: string }[] = [];

  if (kind === "start-changed") {
    title = "Start endret – hva vil du bevare?";
    options = [
      { key: "keep-duration", label: "Bevar varighet", desc: "Flytt Slutt slik at varigheten beholdes." },
      { key: "keep-end", label: "Bevar slutt", desc: "Reberegn varighet ut fra ny Start → Slutt." },
    ];
  } else if (kind === "slutt-changed") {
    title = "Slutt endret – hva vil du bevare?";
    options = [
      { key: "keep-duration", label: "Bevar varighet", desc: "Flytt Start slik at varigheten beholdes." },
      { key: "keep-start", label: "Bevar start", desc: "Reberegn varighet ut fra Start → ny Slutt." },
    ];
  } else {
    title = "Varighet endret – hvilken dato vil du justere?";
    options = [
      { key: "keep-start", label: "Bevar start", desc: "Flytt Slutt basert på ny varighet." },
      { key: "keep-end", label: "Bevar slutt", desc: "Flytt Start basert på ny varighet." },
    ];
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Rekalkulering"
      onClick={onCancel}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,.25)",
        display: "grid",
        placeItems: "end center",
        padding: 16,
        zIndex: 1200,
      }}
    >
      <div
        className="panel"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 520,
          maxWidth: "96vw",
          borderRadius: 12,
          border: "1px solid var(--line)",
          background: "#fff",
          boxShadow: "0 16px 36px rgba(0,0,0,.18)",
          marginBottom: 8,
        }}
      >
        <div style={{ padding: "12px 12px 8px 12px", borderBottom: "1px solid var(--line)" }}>
          <strong>{title}</strong>
        </div>
        <div style={{ padding: 12, display: "grid", gap: 8 }}>
          {options.map((opt) => (
            <button
              key={opt.key}
              className="btn"
              style={{ textAlign: "left", display: "grid", gap: 4, padding: "10px 12px" }}
              onClick={() => onApply(opt.key)}
            >
              <span style={{ fontWeight: 600 }}>{opt.label}</span>
              {opt.desc ? <span style={{ fontSize: 12, color: "#6b7280" }}>{opt.desc}</span> : null}
            </button>
          ))}
        </div>
        <div style={{ padding: 12, borderTop: "1px solid var(--line)", display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button className="btn" onClick={onCancel}>Avbryt</button>
        </div>
      </div>
    </div>
  );
}
/* ==== [BLOCK: RecalcDialog component] END ==== */

/* ==== [BLOCK: DatePopover component] BEGIN ==== */
function DatePopover({
  x, y, value, onChange, onCancel,
}: {
  x: number; y: number; value: string;
  onChange: (iso: string) => void;
  onCancel: () => void;
}) {
  const [val, setVal] = useState<string>(() => (value || ""));
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onClickAway = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onCancel();
    };
    window.addEventListener("mousedown", onClickAway, { capture: true });
    return () => window.removeEventListener("mousedown", onClickAway as any, { capture: true } as any);
  }, [onCancel]);

  useEffect(() => {
    const input = ref.current?.querySelector('input[type="date"]') as HTMLInputElement | null;
    input?.focus();
    input?.showPicker?.();
  }, []);

  return (
    <div
      ref={ref}
      style={{
        position: "absolute",
        left: Math.max(8, x - 120),
        top: y + 12,
        background: "#fff",
        border: "1px solid var(--line)",
        borderRadius: 8,
        boxShadow: "0 10px 28px rgba(0,0,0,.12)",
        padding: 8,
        zIndex: 1300,
        display: "grid",
        gridAutoFlow: "row",
        gap: 6,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <input
        type="date"
        className="btn"
        value={val}
        onChange={(e) => {
          const next = e.currentTarget.value;
          setVal(next);
          const { normalized } = canonicalizeDateInput(next);
          if (normalized) onChange(normalized);
          else onCancel();
        }}
        style={{ padding: "6px 8px", minWidth: 210 }}
      />
      <div style={{ fontSize: 11, color: "#6b7280" }}>
        Dobbeltklikk Start/Slutt for kalender. Alt+↓ åpner også.
      </div>
    </div>
  );
}
/* ==== [BLOCK: DatePopover component] END ==== */
