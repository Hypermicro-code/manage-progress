// Tabell.tsx – Glide Data Grid uten intern V-scroll, ekstern H-slider, klipp/lim, kopier ut, tøm markerte
// v0.2.1: Beregningsregler + rekalkulerings-PROMPT ved tvetydige endringer

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

  /** total content height (for å unngå intern V-scroll) */
  height: number;
  /** horisontal scrollposisjon styres utenfra */
  scrollX: number;
  onScrollXChange: (x: number) => void;
  onTotalWidthChange?: (w: number) => void;

  /** Løft opp valgt område (for “Tøm markerte”) */
  onSelectionChange?: (cells: { r: number; c: KolonneKey }[]) => void;

  /** NY: rapportér viewport-bredde (for korrekt slider-max) */
  onViewportWidthChange?: (w: number) => void;

  /** NY: rapportér topRow basert på faktisk synlig region i grid */
  onTopRowChange?: (top: number) => void;
};
/* ==== [BLOCK: types & handles] END ==== */

/* ==== [BLOCK: date helpers] BEGIN ==== */
function toDate(s: any): Date | null {
  const str = String(s ?? "").trim();
  if (!str) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str);
  if (m) {
    const y = Number(m[1]), mo = Number(m[2]) - 1, d = Number(m[3]);
    const dt = new Date(y, mo, d);
    dt.setHours(0, 0, 0, 0);
    return isNaN(dt.getTime()) ? null : dt;
  }
  const dt = new Date(str);
  if (isNaN(dt.getTime())) return null;
  dt.setHours(0, 0, 0, 0);
  return dt;
}
function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  x.setHours(0, 0, 0, 0);
  return x;
}
function subDays(d: Date, n: number): Date {
  return addDays(d, -n);
}
function fmt(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${da}`;
}
function toNum(n: any): number | null {
  const v = Number(String(n ?? "").replace(",", "."));
  return Number.isFinite(v) ? v : null;
}
function diffDaysInclusive(a: Date, b: Date): number {
  const ms = b.getTime() - a.getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24)) + 1;
}
/* ==== [BLOCK: date helpers] END ==== */

/* ==== [BLOCK: recalc prompt types] BEGIN ==== */
type ChangeKey = "start" | "slutt" | "varighet";
type PromptKind =
  | "start-changed"   // har slutt+varighet → valg: hold varighet (flytt slutt) | hold slutt (reberegn varighet)
  | "slutt-changed"   // har start+varighet → valg: hold varighet (flytt start)  | hold start (reberegn varighet)
  | "varighet-changed"; // har start+slutt → valg: hold start (flytt slutt)       | hold slutt (flytt start)

type RecalcPrompt = {
  row: number;
  kind: PromptKind;
  nextRow: Rad; // snapshot etter primær-commit (inkl. nylig redigert verdi)
};
/* ==== [BLOCK: recalc prompt types] END ==== */

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

  /* ==== [BLOCK: recalc prompt state] BEGIN ==== */
  const [prompt, setPrompt] = useState<RecalcPrompt | null>(null);
  /* ==== [BLOCK: recalc prompt state] END ==== */

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

  /* ==== [BLOCK: onCellEdited (v0.2.1 med prompt)] BEGIN ==== */
  const onCellEdited = React.useCallback(
    (item: Item, newValue: GridCell) => {
      const [col, row] = item;
      const key = TABLE_COLS[col].key as keyof Rad;
      if (!rows[row]) return;

      // ---- Normaliser innkommende verdi
      let editedVal: any = "";
      if (newValue.kind === GridCellKind.Number) {
        editedVal =
          typeof newValue.data === "number" && !Number.isNaN(newValue.data)
            ? newValue.data
            : "";
      } else if (newValue.kind === GridCellKind.Text || newValue.kind === GridCellKind.Markdown) {
        editedVal = (newValue.data ?? "") as any;
      } else {
        editedVal = (newValue as any).data ?? (newValue as any).displayData ?? "";
      }

      // ---- Lokal snapshot av raden *etter* redigeringen
      const curr = rows[row];
      const nextRow: Rad = { ...curr, [key]: editedVal } as Rad;

      // Commit primærfeltet først (det brukeren redigerte)
      setCell(row, key, editedVal as any);

      // ---- Finn situasjon for prompt/auto
      const s = toDate(nextRow.start);
      const e = toDate(nextRow.slutt);
      const d = toNum(nextRow.varighet);

      // Tvetydige cases → prompt:
      if (key === "start" && e && d && d > 0) {
        setPrompt({ row, kind: "start-changed", nextRow });
        return;
      }
      if (key === "slutt" && s && d && d > 0) {
        setPrompt({ row, kind: "slutt-changed", nextRow });
        return;
      }
      if (key === "varighet" && s && e) {
        setPrompt({ row, kind: "varighet-changed", nextRow });
        return;
      }

      // Ikke-tvetydige cases → automatikk:
      // R1: Start + Varighet → Slutt
      if (key === "start" || key === "varighet") {
        const s1 = toDate(nextRow.start);
        const d1 = toNum(nextRow.varighet);
        if (s1 && d1 && d1 > 0) {
          const newEnd = addDays(s1, d1 - 1);
          setCell(row, "slutt", fmt(newEnd) as any);
        }
      }

      // R2: Start + Slutt → Varighet
      if (key === "start" || key === "slutt") {
        const s2 = toDate(nextRow.start);
        const e2 = toDate(nextRow.slutt);
        if (s2 && e2 && e2.getTime() >= s2.getTime()) {
          setCell(row, "varighet", diffDaysInclusive(s2, e2) as any);
        } else if (key === "slutt" && s2 && !e2) {
          // Slutt tømt → nullstill varighet
          setCell(row, "varighet", "" as any);
        }
      }
    },
    [rows, setCell]
  );
  /* ==== [BLOCK: onCellEdited (v0.2.1 med prompt)] END ==== */

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
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand("copy"); } catch {}
        document.body.removeChild(ta);
      }
    };
    void doCopy();
    return true;
  }, [selection, getCellString]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const within =
        containerRef.current &&
        (containerRef.current === document.activeElement ||
          containerRef.current.contains(document.activeElement));
      if (!within) return;
      const isMac = navigator.platform.toLowerCase().includes("mac");
      const mod = isMac ? e.metaKey : e.ctrlKey;
      if (mod && e.key.toLowerCase() === "c") {
        const handled = copySelectionToClipboard();
        if (handled) {
          e.preventDefault();
          e.stopPropagation();
        }
      }
    };
    window.addEventListener("keydown", onKeyDown, { capture: true });
    return () => window.removeEventListener("keydown", onKeyDown as any, { capture: true } as any);
  }, [copySelectionToClipboard]);
  /* ==== [BLOCK: copy helpers] END ==== */

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

  // Editorhøyde > innhold for å unngå intern V-scroll (liten buffer)
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
      />

      {/* Masker ev. intern vertikal scrollbar helt til høyre */}
      <div className="tabell-vmask" aria-hidden />
      <div className="tabell-hmask" aria-hidden />

      {/* Recalc prompt */}
      {prompt && (
        <RecalcDialog
          prompt={prompt}
          onApply={(action) => {
            const { row, kind, nextRow } = prompt;
            const s = toDate(nextRow.start);
            const e = toDate(nextRow.slutt);
            const d = toNum(nextRow.varighet);

            if (kind === "start-changed" && s && e && d) {
              if (action === "keep-duration") {
                // Flytt SLUTT for å bevare VARIGHET
                setCell(row, "slutt", fmt(addDays(s, d - 1)) as any);
              } else if (action === "keep-end") {
                // Reberegn VARIGHET basert på SLUTT
                setCell(row, "varighet", diffDaysInclusive(s, e) as any);
              }
            }

            if (kind === "slutt-changed" && s && e && d) {
              if (action === "keep-duration") {
                // Flytt START for å bevare VARIGHET
                setCell(row, "start", fmt(subDays(e, d - 1)) as any);
              } else if (action === "keep-start") {
                // Reberegn VARIGHET basert på START
                setCell(row, "varighet", diffDaysInclusive(s, e) as any);
              }
            }

            if (kind === "varighet-changed" && s && e && d) {
              if (action === "keep-start") {
                // Flytt SLUTT fra START
                setCell(row, "slutt", fmt(addDays(s, d - 1)) as any);
              } else if (action === "keep-end") {
                // Flytt START fra SLUTT
                setCell(row, "start", fmt(subDays(e, d - 1)) as any);
              }
            }

            setPrompt(null);
          }}
          onCancel={() => setPrompt(null)}
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
  prompt: RecalcPrompt;
  onApply: (action:
    | "keep-duration" // flytt motsatt dato
    | "keep-end"      // hold slutt, reberegn varighet ELLER flytt start (avhengig case)
    | "keep-start"    // hold start, reberegn varighet ELLER flytt slutt (avhengig case)
  ) => void;
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
