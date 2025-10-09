// Tabell.tsx – Glide Data Grid uten intern V-scroll, ekstern H-slider, klipp/lim og tøm markerte

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

export type KolonneKey = (typeof TABLE_COLS)[number]["key"];

export type TabellHandle = {
  scrollToX: (x: number) => void;
};

type Props = {
  rows: Rad[];
  setCell: (rowIndex: number, key: keyof Rad, value: Rad[keyof Rad]) => void;

  height: number; // total content height (for å unngå intern V-scroll)
  scrollX: number; // styres utenfra
  onScrollXChange: (x: number) => void;
  onTotalWidthChange?: (w: number) => void;

  onSelectionChange?: (cells: { r: number; c: KolonneKey }[]) => void;
};

/* ==== [BLOCK: component] BEGIN ==== */
const Tabell = forwardRef<TabellHandle, Props>(function Tabell(
  { rows, setCell, height, scrollX, onScrollXChange, onTotalWidthChange, onSelectionChange },
  ref
) {
  const editorRef = useRef<DataEditorRef | null>(null);

  // Glide Columns
  const columns = useMemo<GridColumn[]>(
    () =>
      TABLE_COLS.map((col) => ({
        id: col.key,
        title: col.name,
        width: col.width, // lov i SizedGridColumn; unionen tillater det
      })),
    []
  );

  // Oppdater total bredde ut til parent (guard for union uten width)
  useEffect(() => {
    const total = columns.reduce((acc, c) => acc + (("width" in c && typeof c.width === "number") ? c.width : 120), 0);
    onTotalWidthChange?.(total);
  }, [columns, onTotalWidthChange]);

  // Ekstern scroll -> inn i DataEditor (v6.0.1: scrollTo(x, y))
  useEffect(() => {
    editorRef.current?.scrollTo(scrollX, 0);
  }, [scrollX]);

  // Eksponér scrollToX
  useImperativeHandle(ref, () => ({
    scrollToX: (x: number) => editorRef.current?.scrollTo(x, 0),
  }));

  // Hent celle-innhold
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
      if (key === "start" || key === "slutt") {
        return {
          kind: GridCellKind.Text,
          displayData: String(v ?? ""),
          data: String(v ?? ""),
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

  // Redigering
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

  // Selection -> løft opp koordinater for “Tøm markerte”
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

  // Klipp/lim – vi map’er celler manuelt
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

  // Tema/høyder
  const theme = useMemo(
    () => ({
      headerHeight: HEADER_H,
      rowHeight: ROW_H,
    }),
    []
  );

  // Hindre intern V-scroll ved å gi full høyde
  const editorHeight = Math.max(HEADER_H + rows.length * ROW_H, height);

  return (
    <div className="hide-native-scrollbars" style={{ overflow: "hidden" }}>
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
        smoothScrollY
        theme={theme as any}
        onVisibleRegionChanged={(r) => onScrollXChange?.(r.x)}
      />
    </div>
  );
});
/* ==== [BLOCK: component] END ==== */

export default Tabell;
