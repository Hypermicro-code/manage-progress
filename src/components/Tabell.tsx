// Tabell.tsx – Glide Data Grid uten intern V-scroll, ekstern H-slider, klipp/lim, kopier ut, tøm markerte

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

  onSelectionChange?: (cells: { r: number; c: KolonneKey }[]) => void;
};
/* ==== [BLOCK: types & handles] END ==== */

/* ==== [BLOCK: component] BEGIN ==== */
const Tabell = forwardRef<TabellHandle, Props>(function Tabell(
  { rows, setCell, height, scrollX, onScrollXChange, onTotalWidthChange, onSelectionChange },
  ref
) {
  /* ==== [BLOCK: refs] BEGIN ==== */
  const editorRef = useRef<DataEditorRef | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  /* ==== [BLOCK: refs] END ==== */

  /* ==== [BLOCK: columns] BEGIN ==== */
  const columns = useMemo<GridColumn[]>(
    () =>
      TABLE_COLS.map((col) => ({
        id: col.key,
        title: col.name,
        width: col.width, // i unionen er dette gyldig for SizedGridColumn
      })),
    []
  );

  useEffect(() => {
    const total = columns.reduce(
      (acc, c) =>
        acc + (("width" in c && typeof (c as any).width === "number" ? (c as any).width : 120)),
      0
    );
    onTotalWidthChange?.(total);
  }, [columns, onTotalWidthChange]);
  /* ==== [BLOCK: columns] END ==== */

  /* ==== [BLOCK: external H-scroll sync] BEGIN ==== */
  useEffect(() => {
    // Glide 6.0.1 bruker signaturen scrollTo(x, y)
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

  /* ==== [BLOCK: onCellEdited] BEGIN ==== */
  const onCellEdited = React.useCallback(
    (item: Item, newValue: GridCell) => {
      const [col, row] = item;
      const key = TABLE_COLS[col].key as keyof Rad;
      if (!rows[row]) return;

      if (newValue.kind === GridCellKind.Number) {
        const n =
          typeof newValue.data === "number" && !Number.isNaN(newValue.data)
            ? newValue.data
            : "";
        setCell(row, key, n as any);
        return;
      }
      if (newValue.kind === GridCellKind.Text || newValue.kind === GridCellKind.Markdown) {
        setCell(row, key, (newValue.data ?? "") as any);
        return;
      }
    },
    [rows, setCell]
  );
  /* ==== [BLOCK: onCellEdited] END ==== */

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
      return true; // håndtert
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

  // Lytt på Cmd/Ctrl+C når fokus er i grid-containeren
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
    // Kun stil – ikke høyder
    headerFontColor: "#6b7280",
    headerBackgroundColor: "#ffffff",
    headerBottomBorder: "2px solid var(--line-strong)", // samme som Gantt
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
      onVisibleRegionChanged={(r) => onScrollXChange?.(r.x)}
    />

    {/* Masker Glide sin interne vertikale scrollbar helt til høyre */}
    <div className="tabell-vmask" aria-hidden />
  </div>
);
/* ==== [BLOCK: Tabell render] END ==== */



});
/* ==== [BLOCK: component] END ==== */

export default Tabell;

