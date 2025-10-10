// Tabell.tsx – RevoGrid-variant
// v0.3.1: React 18 + web components fix → sett columns/source IMPERATIVT via ref
//         Beholder fleksibel dato-parsing, regler/prompt, kalender på dblklikk/Alt+↓.

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
  const columns = useMemo(
    () =>
      TABLE_COLS.map((c) => ({
        name: c.name,
        prop: c.key,
        size: c.width,
        type: c.key === "varighet" || c.key === "ap" || c.key === "pp" ? "number" : "text",
      })),
    []
  );
  /* ==== [BLOCK: columns mapping] END ==== */

  /* ==== [BLOCK: mount + bind events] BEGIN ==== */
  useEffect(() => {
    const el = gridRef.current as HTMLElement | null;
    if (!el) return;

    // 1) Sett container-høyde (RevoGrid scroller internt)
    if (containerRef.current) {
      containerRef.current.style.height = `${Math.max(
        HEADER_H + rows.length * ROW_H + 8,
        height
      )}px`;
    }

    // 2) Imperativ init av props (kritisk i React 18)
    (el as any).columns = columns;
    (el as any).source = rows;

    // 3) Eventer
    const onAfterEdit = (e: CustomEvent) => {
      const det: any = e.detail ?? {};
      const rowIndex: number = det?.row;
      const colKey: KolonneKey = det?.col;
      const rawVal: any = det?.value;
      if (rowIndex == null || colKey == null) return;
      if (!rows[rowIndex]) return;

      let committedVal: any = rawVal;
      if (colKey === "start" || colKey === "slutt") {
        const { normalized } = canonicalizeDateInput(rawVal);
        if (normalized) committedVal = normalized;
      } else if (colKey === "varighet" || colKey === "ap" || colKey === "pp") {
        const n = Number(String(rawVal ?? "").replace(",", "."));
        committedVal = Number.isFinite(n) ? n : "";
      } else {
        committedVal = String(rawVal ?? "");
      }

      setCell(rowIndex, colKey as keyof Rad, committedVal as any);

      const curr = rows[rowIndex];
      const nextRow: Rad = { ...curr, [colKey]: committedVal } as Rad;
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

    const onSelectionChanged = (e: CustomEvent) => {
      const det: any = e.detail ?? {};
      const ranges: any[] = det?.rgRange || det?.range || [];
      const cells: { r: number; c: KolonneKey }[] = [];
      for (const r of ranges) {
        const { x = 0, y = 0, width = 1, height = 1 } = r || {};
        for (let rr = y; rr < y + height; rr++) {
          for (let cc = x; cc < x + width; cc++) {
            const key = TABLE_COLS[cc]?.key as KolonneKey;
            if (key) cells.push({ r: rr, c: key });
          }
        }
      }
      onSelectionChange?.(cells);

      // lagre fokus (øverste-venstre i utvalget)
      if (ranges[0]) {
        const { x = 0, y = 0 } = ranges[0];
        const key = (TABLE_COLS[x]?.key || "navn") as KolonneKey;
        focusRef.current = { rowIndex: y, colKey: key };
      }
    };

    el.addEventListener("afteredit", onAfterEdit as any);
    el.addEventListener("selectionChanged", onSelectionChanged as any);

    return () => {
      el.removeEventListener("afteredit", onAfterEdit as any);
      el.removeEventListener("selectionChanged", onSelectionChanged as any);
    };
  }, [rows, height, columns, onSelectionChange, setCell]);
  /* ==== [BLOCK: mount + bind events] END ==== */

  /* ==== [BLOCK: keep grid in sync with rows/columns] BEGIN ==== */
  useEffect(() => {
    const el = gridRef.current as any;
    if (!el) return;
    el.columns = columns;
  }, [columns]);

  useEffect(() => {
    const el = gridRef.current as any;
    if (!el) return;
    el.source = rows;
  }, [rows]);
  /* ==== [BLOCK: keep grid in sync with rows/columns] END ==== */

  /* ==== [BLOCK: external H-scroll sync (best effort)] BEGIN ==== */
  useEffect(() => {
    const el = gridRef.current as any;
    if (!el) return;
    try {
      const viewport = el.shadowRoot?.querySelector(".rgViewport") as HTMLElement | null;
      if (viewport) viewport.scrollLeft = scrollX;
    } catch {}
  }, [scrollX]);

  useEffect(() => {
    const el = gridRef.current as any;
    if (!el) return;
    const onScroll = () => {
      try {
        const viewport = el.shadowRoot?.querySelector(".rgViewport") as HTMLElement | null;
        if (viewport) onScrollXChange?.(viewport.scrollLeft || 0);
      } catch {}
    };
    el.addEventListener("scroll", onScroll as any, { passive: true } as any);
    return () => el.removeEventListener("scroll", onScroll as any);
  }, [onScrollXChange]);
  /* ==== [BLOCK: external H-scroll sync (best effort)] END ==== */

  /* ==== [BLOCK: dblclick + Alt+↓ – kalender] BEGIN ==== */
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
  /* ==== [BLOCK: dblclick + Alt+↓ – kalender] END ==== */

  /* ==== [BLOCK: imperative handle] BEGIN ==== */
  useImperativeHandle(ref, () => ({
    scrollToX: (x: number) => {
      try {
        const el = gridRef.current as any;
        const viewport = el?.shadowRoot?.querySelector(".rgViewport") as HTMLElement | null;
        if (viewport) viewport.scrollLeft = x;
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
  /* ==== [BLOCK: imperative handle] END ==== */

  /* ==== [BLOCK: render] BEGIN ==== */
  return (
    <div
      ref={containerRef}
      className="hide-native-scrollbars tabell-grid"
      style={{ position: "relative", overflow: "hidden" }}
      onDoubleClick={(e) => {
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
      }}
    >
      <revo-grid
        ref={gridRef}
        theme="material"
        resize={true}
        canFocus={true}
        range={true}
        clipboard={true}
        readonly={false}
        row-size={ROW_H}
        onViewportScroll={(e: CustomEvent) => {
          const st: any = e.detail || {};
          if (typeof st?.scrollLeft === "number") onScrollXChange?.(st.scrollLeft);
          if (typeof st?.visibleWidth === "number") onViewportWidthChange?.(st.visibleWidth);
          if (typeof st?.firstItem === "number") onTopRowChange?.(st.firstItem);
        }}
      ></revo-grid>

      {/* Recalc prompt */}
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

      {/* Date popover */}
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
/* ==== [BLOCK: component] END ==== */

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
