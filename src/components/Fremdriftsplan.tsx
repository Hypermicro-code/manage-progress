import React, { useEffect, useMemo, useRef, useState } from "react";
import Tabell, { TabellHandle } from "./Tabell";
import GanttDiagram from "./GanttDiagram";
import { HEADER_H, ROW_H, GANTT_ZOOM_PX, type GanttZoom } from "../core/layout";
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

/* ==== [BLOCK: helpers – relative offset] BEGIN ==== */
function getRelativeTop(el: HTMLElement, ancestor: HTMLElement): number {
  let y = 0;
  let node: HTMLElement | null = el;
  while (node && node !== ancestor) {
    y += node.offsetTop;
    node = node.offsetParent as HTMLElement | null;
  }
  return y;
}
/* ==== [BLOCK: helpers – relative offset] END ==== */

export default function Fremdriftsplan({
  rows,
  setCell,
  addRows,
  clearCells,
  apiBridge,
}: Props) {
  /* ==== [BLOCK: refs & local state] BEGIN ==== */
  const scrollHostRef = useRef<HTMLDivElement | null>(null);
  const tablePanelRef = useRef<HTMLDivElement | null>(null);
  const tabellRef = useRef<TabellHandle | null>(null);

  const [tableTotalWidth, setTableTotalWidth] = useState(1200);
  const [tableScrollX, setTableScrollX] = useState(0);
  const [ganttScrollX, setGanttScrollX] = useState(0);

  const [selCells, setSelCells] = useState<{ r: number; c: KolonneKey }[]>([]);
  const [topRow, setTopRow] = useState(0);

  const [zoom, setZoom] = useState<GanttZoom>("week");
  const [showWeekends, setShowWeekends] = useState(true);
  const [showToday, setShowToday] = useState(true);
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
  const contentHeight = useMemo(
    () => HEADER_H + rows.length * ROW_H,
    [rows.length]
  );
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
    const host = scrollHostRef.current;
    const tablePanel = tablePanelRef.current;
    if (!host || !tablePanel) return;

    const updateTop = () => {
      // DataEditor har egen header (HEADER_H) før datarader
      const baseY = getRelativeTop(tablePanel, host) + HEADER_H;
      const y = host.scrollTop;
      const top = Math.max(0, Math.floor((y - baseY) / ROW_H));
      setTopRow(top);
    };

    updateTop();
    host.addEventListener("scroll", updateTop, { passive: true });
    window.addEventListener("resize", updateTop);
    return () => {
      host.removeEventListener("scroll", updateTop as any);
      window.removeEventListener("resize", updateTop);
    };
  }, []);
  /* ==== [BLOCK: topRow sync from scroll-host] END ==== */

  /* ==== [BLOCK: render] BEGIN ==== */
  return (
    <>
      {/* Toolbar (beholder avrundede hjørner) */}
      <div className="toolbar" style={{ marginBottom: 10, gap: 10 }}>
        <button className="btn primary" onClick={() => addRows(20)}>
          +20 rader
        </button>
        <button className="btn" onClick={onClearSelected} title="Tøm markerte celler">
          Tøm markerte
        </button>
        <button className="btn" onClick={onCopySelected} title="Kopier utvalg til utklippstavle">
          Kopier
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: 8 }}>
          <label style={{ fontSize: 12, color: "#6b7280" }}>Zoom</label>
          <select className="btn" value={zoom} onChange={(e) => setZoom(e.target.value as GanttZoom)}>
            <option value="day">Dag</option>
            <option value="week">Uke</option>
            <option value="month">Måned</option>
          </select>
          <label className="btn" style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input type="checkbox" checked={showWeekends} onChange={(e) => setShowWeekends(e.target.checked)} />
            Helgeskygge
          </label>
          <label className="btn" style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input type="checkbox" checked={showToday} onChange={(e) => setShowToday(e.target.checked)} />
            I-dag-linje
          </label>
        </div>

        <div style={{ marginLeft: "auto", fontSize: 12, color: "#6b7280" }}>
          Rader: {rows.length} • Rad: {ROW_H}px • Header: {HEADER_H}px • Gantt px/{zoom}: {GANTT_ZOOM_PX[zoom]}
        </div>
      </div>

      {/* Felles scroll-host – eneste vertikale scroll */}
      <div ref={scrollHostRef} className="scroll-host wide">
        <div className="panels" style={{ minHeight: contentHeight }}>
          {/* === Tabell-panel (uten panelheader) === */}
          <div ref={tablePanelRef} className="panel" style={{ alignSelf: "start" }}>
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
          </div>

          {/* === Gantt-panel (uten panelheader) === */}
          <div className="panel" style={{ alignSelf: "start" }}>
            <GanttDiagram
              rows={rows}
              height={contentHeight}
              scrollX={ganttScrollX}
              topRow={topRow}
              zoom={zoom}
              showWeekends={showWeekends}
              showToday={showToday}
            />
          </div>
        </div>
      </div>

      {/* Sticky footer med H-slidere + credit */}
      <div className="footer-bar">
        <div className="footer-scrollers">
          <div className="footer-slider">
            <label>Tabell</label>
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
          <div className="footer-slider">
            <label>Gantt</label>
            <input
              className="hslider"
              type="range"
              min={0}
              max={6000}
              step={1}
              value={ganttScrollX}
              onChange={(e) => setGanttScrollX(Number(e.currentTarget.value))}
            />
          </div>
        </div>
        <div className="footer-credit">Brewed by Morning Coffee Labs 2025</div>
      </div>
    </>
  );
  /* ==== [BLOCK: render] END ==== */
}
