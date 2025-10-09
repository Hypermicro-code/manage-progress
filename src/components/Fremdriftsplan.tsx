import React, { useEffect, useMemo, useRef, useState } from "react";
import Tabell, { TabellHandle } from "./Tabell";
import GanttDiagram from "./GanttDiagram";
import { HEADER_H, ROW_H } from "../core/layout";
import type { Rad, KolonneKey } from "../core/types";

/* ==== [BLOCK: props] BEGIN ==== */
type Props = {
  rows: Rad[];
  setCell: (rowIndex: number, key: keyof Rad, value: Rad[keyof Rad]) => void;
  addRows: (n?: number) => void;
  clearCells: (targets: { r: number; c: keyof Rad }[]) => void;
  apiBridge: {
    registerTableApi: (api: { scrollToX: (x: number) => void; onTotalWidth: (w: number) => void }) => {
      setTotalWidth: (w: number) => void;
    };
  };
};
/* ==== [BLOCK: props] END ==== */

export default function Fremdriftsplan({ rows, setCell, addRows, clearCells, apiBridge }: Props) {
  /* ==== [BLOCK: refs & local state] BEGIN ==== */
  const scrollHostRef = useRef<HTMLDivElement | null>(null);
  const tabellRef = useRef<TabellHandle | null>(null);

  const [tableTotalWidth, setTableTotalWidth] = useState(1200);
  const [tableScrollX, setTableScrollX] = useState(0);
  const [ganttScrollX, setGanttScrollX] = useState(0);

  const [selCells, setSelCells] = useState<{ r: number; c: KolonneKey }[]>([]);
  const [topRow, setTopRow] = useState(0);
  /* ==== [BLOCK: refs & local state] END ==== */

  /* ==== [BLOCK: expose API upwards] BEGIN ==== */
  useEffect(() => {
    const cleanup = apiBridge.registerTableApi({
      scrollToX: (x: number) => tabellRef.current?.scrollToX(x),
      onTotalWidth: (w: number) => setTableTotalWidth(w),
    });
    return () => {
      cleanup.setTotalWidth = () => {};
    };
  }, [apiBridge]);
  /* ==== [BLOCK: expose API upwards] END ==== */

  /* ==== [BLOCK: dimensions] BEGIN ==== */
  const contentHeight = useMemo(() => HEADER_H + rows.length * ROW_H, [rows.length]);
  /* ==== [BLOCK: dimensions] END ==== */

  /* ==== [BLOCK: toolbar actions] BEGIN ==== */
  const onClearSelected = () => {
    if (selCells.length === 0) return;
    clearCells(selCells.map((s) => ({ r: s.r, c: s.c })));
  };
  const onCopySelected = () => {
    tabellRef.current?.copySelectionToClipboard();
  };
  /* ==== [BLOCK: toolbar actions] END ==== */

  /* ==== [BLOCK: topRow sync from scroll-host] BEGIN ==== */
  useEffect(() => {
    const el = scrollHostRef.current;
    if (!el) return;

    const onScroll = () => {
      // Grov beregning: antall hele rader scrollet forbi, justert for panel-header (~HEADER_H)
      const y = el.scrollTop;
      const firstContentY = HEADER_H; // panel-header-høyde per panel
      const top = Math.max(0, Math.floor((y - firstContentY) / ROW_H));
      setTopRow(top);
    };

    onScroll(); // init
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll as any);
  }, []);
  /* ==== [BLOCK: topRow sync from scroll-host] END ==== */

  /* ==== [BLOCK: render] BEGIN ==== */
  return (
    <>
      {/* Toolbar */}
      <div className="toolbar" style={{ marginBottom: 10 }}>
        {/* ==== [BLOCK: toolbar buttons] BEGIN ==== */}
        <button className="btn primary" onClick={() => addRows(20)}>+20 rader</button>
        <button className="btn" onClick={onClearSelected} title="Tøm markerte celler">Tøm markerte</button>
        <button className="btn" onClick={onCopySelected} title="Kopier utvalg til utklippstavle">Kopier</button>
        {/* ==== [BLOCK: toolbar buttons] END ==== */}
        <div style={{ marginLeft: "auto", fontSize: 12, color: "#6b7280" }}>
          Rader: {rows.length} • Rad-høyde: {ROW_H}px • Header: {HEADER_H}px
        </div>
      </div>

      {/* Felles scroll-host – eneste vertikale scroll */}
      <div ref={scrollHostRef} className="scroll-host">
        <div className="panels" style={{ minHeight: contentHeight }}>
          {/* === Tabell-panel === */}
          <div className="panel" style={{ alignSelf: "start" }}>
            <div className="panel-header">Tabell</div>
            <Tabell
              ref={tabellRef}
              rows={rows}
              setCell={setCell}
              onSelectionChange={setSelCells}
              onTotalWidthChange={(w) => setTableTotalWidth(w)}
              height={contentHeight}
              scrollX={tableScrollX}
              onScrollXChange={setTableScrollX}
            />
            <div className="hslider-wrap">
              <input
                className="hslider"
                type="range"
                min={0}
                max={Math.max(0, tableTotalWidth - 50)}
                step={1}
                value={tableScrollX}
                onChange={(e) => {
                  const x = Number(e.currentTarget.value);
                  setTableScrollX(x);
                  tabellRef.current?.scrollToX(x);
                }}
              />
            </div>
          </div>

          {/* === Gantt-panel (stub) === */}
          <div className="panel" style={{ alignSelf: "start" }}>
            <div className="panel-header">Gantt (stub)</div>
            <GanttDiagram
              rows={rows}
              height={contentHeight}
              scrollX={ganttScrollX}
              topRow={topRow}
            />
            <div className="hslider-wrap">
              <input
                className="hslider"
                type="range"
                min={0}
                max={3000}
                step={1}
                value={ganttScrollX}
                onChange={(e) => setGanttScrollX(Number(e.currentTarget.value))}
              />
            </div>
          </div>
        </div>

        <div className="footer">
          Akseptkriterier: felles V-scroll, to H-slidere alltid synlige, +20 rader fungerer,
          klipp/lim/kopier virker i Tabell, “Tøm markerte” nullstiller innhold, synk-høyder matcher.
        </div>
      </div>
    </>
  );
  /* ==== [BLOCK: render] END ==== */
}
