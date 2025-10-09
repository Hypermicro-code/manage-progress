// Tabell.tsx – Glide Data Grid uten intern V-scroll, ekstern H-slider, klipp/lim, kopier ut, tøm markerte
// v0.2.4-fix: Fjern openCellEditor (ikke i vår Glide-versjon). Enkeltklikk + date-popover + fleksibel parsing + prompt + tapsfri skriving.

/* ==== [BLOCK: imports] BEGIN ==== */
import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import DataEditor, {
  CompactSelection,
  DataEditorRef,
  GridCell,
  GridCellKind,
  GridColumn,
  GridSelection,
  Item,
} from "@glideapps/glide-data-grid";
import "@glideapps/glide-data-grid/dist/index.css";
import type { Rad } from "../core/types";
import { HEADER_H, ROW_H, TABLE_COLS } from "../core/layout";
import { toDate, canonicalizeDateInput } from "../core/date";
import {
  planAfterEdit,
  resolvePrompt,
  type RecalcPromptMeta,
} from "../core/recalc";
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
  const editorRef = useRef<DataEditorRef | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  /* ==== [BLOCK: refs] END ==== */

  /* ==== [BLOCK: speedy typing buffer – refs & helpers] BEGIN ==== */
  const typeBufRef = useRef<{ row: number; col: number; value: string } | null>(null);
  const typeBufTimerRef = useRef<number | null>(null);

  function clearTypeBufSoon(ms = 500) {
    if (typeBufTimerRef.current) window.clearTimeout(typeBufTimerRef.current);
    typeBufTimerRef.current = window.setTimeout(() => {
      typeBufRef.current = null;
      typeBufTimerRef.current = null;
    }, ms);
  }
  function isPrintableKey(e: KeyboardEvent): boolean {
    if (e.ctrlKey || e.metaKey || e.altKey) return false;
    return e.key.length === 1;
  }
  function sanitizeForColumn(colKey: string, raw: string): string {
    if (colKey === "varighet" || colKey === "ap" || colKey === "pp") {
      const s = raw.replace(/,/g, ".").replace(/[^0-9.]+/g, "");
      return s;
    }
    return raw;
  }
  /* ==== [BLOCK: speedy typing buffer – refs & helpers] END ==== */

  /* ==== [BLOCK: prompt state] BEGIN ==== */
  const [prompt, setPrompt] = useState<(RecalcPromptMeta & { row: number }) | null>(null);
  /* ==== [BLOCK: prompt state] END ==== */

  /* ==== [BLOCK: date popover state] BEGIN ==== */
  const [datePop, setDatePop] = useState<{
    open: boolean;
    row: number;
    col: number;
    key: "start" | "slutt";
    value: string;
    x: number;
    y: number;
  } | null>(null);
  const lastClickPos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  /* ==== [BLOCK: date popover state] END ==== */

  /* ==== [BLOCK: columns] BEGIN ==== */
  const columns = useMemo<GridColumn[]>(
    () =>
      TABLE_COLS.map((col) => ({
        id: col.key,
        title: col.name,
        width: col.width,
      })),
    []
  );

  useEffect(() => {
    const total = columns.reduce(
      (acc, c) => acc + (("width" in c && typeof (c as any).width === "number" ? (c as any).width : 120)),
      0
    );
    onTotalWidthChange?.(total);
  }, [columns, onTotalWidthChange]);
  /* ==== [BLOCK: columns] END ==== */

  /* ==== [BLOCK: external H-scroll sync] BEGIN ==== */
  useEffect(() => {
    editorRef.current?.scrollTo(scrollX, 0);
  }, [scrollX]);
  /* ==== [BLOCK: external H-scroll sync] END ==== */

  /* ==== [BLOCK: getCellContent] BEGIN ==== */
  const getCellContent = React.useCallback(
    (item: Item): GridCell => {
      const [col, row] = item;
      const r = rows[row];
      const key = TABLE_COLS[col].key as keyof Rad;
      const v = r?.[key] ?? "";

      if (key === "varighet" || key === "ap" || key === "pp") {
        const numStr = v === "" ? "" : String(v);
        return {
          kind: GridCellKind.Number,
          displayData: numStr,
          data: numStr === "" ? undefined : Number(numStr),
          allowOverlay: true,
        };
      }
      return {
        kind: GridCellKind.Text,
        displayData: String(v ?? ""),
        data: String(v ?? ""),
        allowOverlay: true,
      };
    },
    [rows]
  );
  /* ==== [BLOCK: getCellContent] END ==== */

  /* ==== [BLOCK: onCellEdited – normalize start/slutt + core/recalc] BEGIN ==== */
  const onCellEdited = React.useCallback(
    (item: Item, newValue: GridCell) => {
      const [col, row] = item;
      const key = TABLE_COLS[col].key as keyof Rad;
      if (!rows[row]) return;

      let editedVal: any = "";
      if (newValue.kind === GridCellKind.Number) {
        editedVal = typeof newValue.data === "number" && !Number.isNaN(newValue.data) ? newValue.data : "";
      } else if (newValue.kind === GridCellKind.Text || newValue.kind === GridCellKind.Markdown) {
        editedVal = (newValue.data ?? "") as any;
      } else {
        editedVal = (newValue as any).data ?? (newValue as any).displayData ?? "";
      }

      // Normaliser dato felter
      let committedVal: any = editedVal;
      if (key === "start" || key === "slutt") {
        const { normalized } = canonicalizeDateInput(editedVal);
        if (normalized) committedVal = normalized;
      }

      const curr = rows[row];
      const nextRow: Rad = { ...curr, [key]: committedVal } as Rad;

      setCell(row, key, committedVal as any);

      const plan = planAfterEdit(nextRow, key as any);
      if (plan.prompt) {
        setPrompt({ ...plan.prompt, row });
        return;
      }
      if (plan.autoPatch) {
        for (const [k, v] of Object.entries(plan.autoPatch)) {
          setCell(row, k as keyof Rad, v as any);
        }
      }

      const s2 = toDate((plan.autoPatch?.start as any) ?? nextRow.start);
      const e2 = toDate((plan.autoPatch?.slutt as any) ?? nextRow.slutt);
      if (s2 && e2 && e2 < s2) {
        setCell(row, "varighet", "" as any);
      }
    },
    [rows, setCell]
  );
  /* ==== [BLOCK: onCellEdited – normalize start/slutt + core/recalc] END ==== */

  /* ==== [BLOCK: selection state + lift] BEGIN ==== */
  const [selection, setSelection] = useState<GridSelection>({
    columns: CompactSelection.empty(),
    rows: CompactSelection.empty(),
    current: undefined,
  });

  useEffect(() => {
    const out: { r: number; c: KolonneKey }[] = [];
    if (selection.current) {
      const c0 = selection.current.range.x;
      const r0 = selection.current.range.y;
      const cw = selection.current.range.width;
      const rh = selection.current.range.height;
      for (let rr = r0; rr < r0 + rh; rr++) {
        for (let cc = c0; cc < c0 + cw; cc++) {
          out.push({ r: rr, c: TABLE_COLS[cc].key });
        }
      }
    }
    onSelectionChange?.(out);
  }, [selection, onSelectionChange]);
  /* ==== [BLOCK: selection state + lift] END ==== */

  /* ==== [BLOCK: paste handler] BEGIN ==== */
  const onPaste = React.useCallback(
    (target: Item, data: readonly (readonly (string | number)[])[]) => {
      const [cStart, rStart] = target;
      const maxR = Math.min(rows.length, rStart + data.length);
      for (let r = rStart; r < maxR; r++) {
        const rowVals = data[r - rStart];
        const maxC = Math.min(TABLE_COLS.length, cStart + rowVals.length);
        for (let c = cStart; c < maxC; c++) {
          const key = TABLE_COLS[c].key as keyof Rad;
          const raw = rowVals[c - cStart];
          let val: any = raw;
          if (key === "varighet" || key === "ap" || key === "pp") {
            const n = Number(String(raw).replace(",", "."));
            val = Number.isFinite(n) ? n : "";
          } else if (key === "start" || key === "slutt") {
            const { normalized } = canonicalizeDateInput(raw);
            val = normalized || String(raw ?? "");
          } else {
            val = String(raw ?? "");
          }
          setCell(r, key, val);
        }
      }
      return true;
    },
    [rows.length, setCell]
  );
  /* ==== [BLOCK: paste handler] END ==== */

  /* ==== [BLOCK: copy helpers] BEGIN ==== */
  const getCellString = React.useCallback(
    (r: number, c: number): string => {
      const cell = getCellContent([c, r]);
      const anyCell: any = cell as any;
      const disp = anyCell?.displayData;
      const data = anyCell?.data;
      if (disp !== undefined && disp !== null) return String(disp);
      if (data !== undefined && data !== null) return String(data);
      return "";
    },
    [getCellContent]
  );

  const copySelectionToClipboard = React.useCallback((): boolean => {
    if (!selection.current) return false;
    const { x, y, width, height } = selection.current.range;
    const lines: string[] = [];
    for (let rr = y; rr < y + height; rr++) {
      const cols: string[] = [];
      for (let cc = x; cc < x + width; cc++) {
        const raw = getCellString(rr, cc).replace(/\t/g, " ").replace(/\r?\n/g, " ");
        cols.push(raw);
      }
      lines.push(cols.join("\t"));
    }
    const tsv = lines.join("\n");

    const doCopy = async () => {
      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(tsv);
        } else {
          throw new Error("no clipboard api");
        }
      } catch {
        const ta = document.createElement("textarea");
        ta.value = tsv;
        ta.style.position = "fixed";
        ta.style.left = "-9999px";
        ta.style.top = "0";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand("copy"); } catch {}
        document.body.removeChild(ta);
      }
    };
    void doCopy();
    return true;
  }, [selection, getCellString]);
  /* ==== [BLOCK: copy helpers] END ==== */

  /* ==== [BLOCK: global key/mouse handlers – single-click helpers + date popover + copy + lossless typing] BEGIN ==== */
  useEffect(() => {
    // Husk siste klikkposisjon for å posisjonere date-popover
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

      // Åpne date-popover med Alt+PilNed hvis i start/slutt
      if (selection.current) {
        const { x, y, width, height } = selection.current.range;
        if (width === 1 && height === 1) {
          const colKey = TABLE_COLS[x].key as keyof Rad;
          if ((colKey === "start" || colKey === "slutt") && e.altKey && e.key === "ArrowDown") {
            e.preventDefault(); e.stopPropagation();
            const rowIndex = y;
            const value = String(rows[rowIndex]?.[colKey] ?? "");
            const pos = lastClickPos.current || { x: 20, y: 20 };
            setDatePop({ open: true, row: rowIndex, col: x, key: colKey, value, x: pos.x, y: pos.y });
            return;
          }
        }
      }

      // Kopi / tapsfri skriving / osv.
      if (!selection.current) {
        const isMac = navigator.platform.toLowerCase().includes("mac");
        const mod = isMac ? e.metaKey : e.ctrlKey;
        if (mod && e.key.toLowerCase() === "c") {
          const handled = copySelectionToClipboard();
          if (handled) { e.preventDefault(); e.stopPropagation(); }
        }
        return;
      }

      const { x, y, width, height } = selection.current.range;
      const isMac = navigator.platform.toLowerCase().includes("mac");
      const mod = isMac ? e.metaKey : e.ctrlKey;

      // Multi-utvalg → kun kopiering
      if (width !== 1 || height !== 1) {
        if (mod && e.key.toLowerCase() === "c") {
          const handled = copySelectionToClipboard();
          if (handled) { e.preventDefault(); e.stopPropagation(); }
        }
        return;
      }

      const colIndex = x;
      const rowIndex = y;
      const colKey = TABLE_COLS[colIndex].key as keyof Rad;
      const row = rows[rowIndex];

      // Kopiering
      if (mod && e.key.toLowerCase() === "c") {
        const handled = copySelectionToClipboard();
        if (handled) { e.preventDefault(); e.stopPropagation(); }
        return;
      }

      // Navigasjon/commit – tøm buffer
      const navKeys = ["Enter","Escape","ArrowLeft","ArrowRight","ArrowUp","ArrowDown","Tab"];
      if (navKeys.includes(e.key)) {
        typeBufRef.current = null;
        if (typeBufTimerRef.current) {
          window.clearTimeout(typeBufTimerRef.current);
          typeBufTimerRef.current = null;
        }
        return;
      }

      // Backspace/Delete
      if (e.key === "Backspace" || e.key === "Delete") {
        e.preventDefault(); e.stopPropagation();
        const base =
          typeBufRef.current &&
          typeBufRef.current.row === rowIndex &&
          typeBufRef.current.col === colIndex
            ? typeBufRef.current.value
            : String(row?.[colKey] ?? "");
        const next = e.key === "Backspace" ? base.slice(0, -1) : "";
        const cleaned = sanitizeForColumn(String(colKey), next);
        setCell(rowIndex, colKey, cleaned as any);
        typeBufRef.current = { row: rowIndex, col: colIndex, value: cleaned };
        clearTypeBufSoon();
        return;
      }

      // Skrivbar tast → tapsfri
      if (isPrintableKey(e)) {
        e.preventDefault(); e.stopPropagation();
        const baseActive =
          typeBufRef.current &&
          typeBufRef.current.row === rowIndex &&
          typeBufRef.current.col === colIndex;
        const seed = baseActive ? typeBufRef.current!.value : "";
        const nextRaw = seed + e.key;
        const next = sanitizeForColumn(String(colKey), nextRaw);
        setCell(rowIndex, colKey, next as any);
        typeBufRef.current = { row: rowIndex, col: colIndex, value: next };
        clearTypeBufSoon();
        return;
      }
    };

    window.addEventListener("keydown", onKeyDown, { capture: true });
    return () => {
      window.removeEventListener("mousedown", onMouseDown as any, { capture: true } as any);
      window.removeEventListener("keydown", onKeyDown as any, { capture: true } as any);
    };
  }, [rows, selection, setCell, copySelectionToClipboard]);
  /* ==== [BLOCK: global key/mouse handlers – single-click helpers + date popover + copy + lossless typing] END ==== */

  /* ==== [BLOCK: imperative handle] BEGIN ==== */
  useImperativeHandle(ref, () => ({
    scrollToX: (x: number) => editorRef.current?.scrollTo(x, 0),
    copySelectionToClipboard: () => copySelectionToClipboard() ?? false,
  }));
  /* ==== [BLOCK: imperative handle] END ==== */

  /* ==== [BLOCK: Tabell theme + sizing] BEGIN ==== */
  const theme = useMemo(
    () => ({
      headerFontColor: "#111",
      headerBackgroundColor: "#ffffff",
      headerBottomBorder: "2px solid #000",
      accentColor: "#000",
      borderColor: "#000",
      horizontalBorderColor: "#000",
      verticalBorderColor: "#000",
      gridLineColor: "#000",
      textDark: "#111",
      textMedium: "#111",
      textLight: "#111",
    }),
    []
  );
  const editorHeight = HEADER_H + rows.length * ROW_H + 20;
  /* ==== [BLOCK: Tabell theme + sizing] END ==== */

  /* ==== [BLOCK: Tabell render] BEGIN ==== */
  return (
    <div
      ref={containerRef}
      className="hide-native-scrollbars tabell-grid"
      style={{ overflow: "hidden", position: "relative" }}
    >
      <DataEditor
        ref={editorRef}
        width="100%"
        height={editorHeight}
        rows={rows.length}
        columns={columns}
        getCellContent={getCellContent}
        onCellEdited={onCellEdited}
        onPaste={onPaste}
        gridSelection={selection}
        onGridSelectionChange={setSelection}
        rowMarkers="number"
        smoothScrollX
        smoothScrollY={false}
        headerHeight={HEADER_H}
        rowHeight={ROW_H}
        overscrollY={0}
        theme={theme as any}
        onVisibleRegionChanged={(r) => {
          onScrollXChange?.(r.x);
          onViewportWidthChange?.(r.width);
          const yRows = Math.max(0, r.y - HEADER_H);
          const top = Math.floor(yRows / ROW_H);
          onTopRowChange?.(top);
        }}
        // Enkeltklikk-aktivering: vi åpner *bare* vår date-popover for start/slutt.
        onCellActivated={(cell) => {
          const [col, row] = cell;
          const key = TABLE_COLS[col].key as keyof Rad;
          if (key === "start" || key === "slutt") {
            const val = String(rows[row]?.[key] ?? "");
            const pos = lastClickPos.current || { x: 20, y: 20 };
            setDatePop({ open: true, row, col, key, value: val, x: pos.x, y: pos.y });
          } else {
            if (datePop?.open) setDatePop(null);
          }
        }}
      />

      {/* Masker ev. interne scrollbars */}
      <div className="tabell-vmask" aria-hidden />
      <div className="tabell-hmask" aria-hidden />

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
            // trigge regler (auto path) etter setting
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
  /* ==== [BLOCK: Tabell render] END ==== */
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
    // Åpne native kalender automatisk
    const input = ref.current?.querySelector('input[type="date"]') as HTMLInputElement | null;
    if (input) {
      input.focus();
      input.showPicker?.();
    }
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
        onChange={(e) => setVal(e.currentTarget.value)}
        style={{ padding: "6px 8px", minWidth: 210 }}
      />
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button className="btn" onClick={onCancel}>Avbryt</button>
        <button
          className="btn primary"
          onClick={() => {
            const { normalized } = canonicalizeDateInput(val);
            if (normalized) onChange(normalized);
            else onCancel();
          }}
        >
          Sett dato
        </button>
      </div>
      <div style={{ fontSize: 11, color: "#6b7280" }}>
        Tips: Alt+↓ åpner kalender på valgt celle.
      </div>
    </div>
  );
}
/* ==== [BLOCK: DatePopover component] END ==== */
