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

export default function Fremdriftsplan({ rows, setCell, addRows, clearCells, apiBridge }: Props) {
  /* ==== [BLOCK: refs & local state] BEGIN ==== */
  const tabellRef = useRef<TabellHandle | null>(null);
  const panelsRef = useRef<HTMLDivElement | null>(null);

  const [tableTotalWidth, setTableTotalWidth] = useState(1200);
  const [tableViewportWidth, setTableViewportWidth] = useState(600);
  const [tableScrollX, setTableScrollX] = useState(0);

  const [ganttTotalWidth, setGanttTotalWidth] = useState(4000);
  const [ganttViewportWidth, setGanttViewportWidth] = useState(800);
  const [ganttScrollX, setGanttScrollX] = useState(0);

  const [selCells, setSelCells] = useState<{ r: number; c: KolonneKey }[]>([]);
  const [topRow, setTopRow] = useState(0);

  const [zoom, setZoom] = useState<GanttZoom>("week");
  const [showWeekends, setShowWeekends] = useState(true);
  const [showToday, setShowToday] = useState(true);

  /* Splitter: hvor stor andel av bredden Gantt får (0..1). Default 0.6 (40/60). */
  const [ganttFrac, setGanttFrac] = useState(0.6);
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef<{ x: number; frac: number; w: number } | null>(null);
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

  const tableSliderMax = Math.max(0, tableTotalWidth - tableViewportWidth);
  const ganttSliderMax = Math.max(0, ganttTotalWidth - ganttViewportWidth);

  const tableFrac = 1 - ganttFrac;
  /* ==== [BLOCK: dimensions] END ==== */

  /* ==== [BLOCK: toolbar actions] BEGIN ==== */
  const onClearSelected = () => {
    if (selCells.length === 0) return;
    clearCells(selCells.map((s) => ({ r: s.r, c: s.c })));
  };
  const onCopySelected = () => tabellRef.current?.copySelectionToClipboard();
  /* ==== [BLOCK: toolbar actions] END ==== */

  /* ==== [BLOCK: splitter handlers] BEGIN ==== */
  const onSplitterDown = (e: React.MouseEvent | React.TouchEvent) => {
    const startX = "touches" in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const w = panelsRef.current?.getBoundingClientRect().width ?? 1;
    dragStart.current = { x: startX, frac: ganttFrac, w };
    setDragging(true);
    document.body.classList.add("no-select");
  };

  const onSplitterMove = (clientX: number) => {
    if (!dragStart.current) return;
    const { x, frac, w } = dragStart.current;
    const dx = clientX - x;
    const dFrac = dx / w; // positiv dx => større Gantt
    const next = Math.min(1, Math.max(0, frac + dFrac));
    setGanttFrac(next);
  };

  useEffect(() => {
    if (!dragging) return;

    const onMouseMove = (ev: MouseEvent) => onSplitterMove(ev.clientX);
    const onTouchMove = (ev: TouchEvent) => onSplitterMove(ev.touches[0].clientX);
    const onUp = () => {
      setDragging(false);
      dragStart.current = null;
      document.body.classList.remove("no-select");
    };
    window.addEventListener("mousemove", onMouseMove, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("mouseup", onUp, { passive: true });
    window.addEventListener("touchend", onUp, { passive: true });
    return () => {
      window.removeEventListener("mousemove", onMouseMove as any);
      window.removeEventListener("touchmove", onTouchMove as any);
      window.removeEventListener("mouseup", onUp as any);
      window.removeEventListener("touchend", onUp as any);
    };
  }, [dragging]);

  const onSplitterDoubleClick = () => {
    // reset til 40/60 (Gantt 60%)
    setGanttFrac(0.6);
  };
  /* ==== [BLOCK: splitter handlers] END ==== */

  /* ==== [BLOCK: render] BEGIN ==== */
  return (
    <>
      {/* Toolbar */}
      <div className="toolbar" style={{ marginBottom: 10, gap: 10 }}>
        <button className="btn primary" onClick={() => addRows(20)}>+20 rader</button>
        <button className="btn" onClick={onClearSelected} title="Tøm markerte celler">Tøm markerte</button>
        <button className="btn" onClick={onCopySelected} title="Kopier utvalg til utklippstavle">Kopier</button>

        <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: 8 }}>
          <label style={{ fontSize: 12, color: "#6b7280" }}>Zoom</label>
          <select className="btn" value={zoom} onChange={(e) => setZoom(e.target.value as GanttZoom)}>
            <option value="day">Dag</option>
            <option value="week">Uke</option>
            <option value="month">Måned</option>
          </select>
          <label className="btn" style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input type="checkbox" checked={showWeekends} onChange={(e) => setShowWeekends(e.target.checked)} /> Helgeskygge
          </label>
          <label className="btn" style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input type="checkbox" checked={showToday} onChange={(e) => setShowToday(e.target.checked)} /> I-dag-linje
          </label>
        </div>

        <div style={{ marginLeft: "auto", fontSize: 12, color: "#6b7280" }}>
          Rader: {rows.length} • Rad: {ROW_H}px • Header: {HEADER_H}px • Gantt px/{zoom}: {GANTT_ZOOM_PX[zoom]}
        </div>
      </div>

      {/* Felles scroll-host – eneste vertikale scroll */}
      <div className="scroll-host wide">
        {/* Panels med dynamiske kolonner basert på splitter */}
        <div
          ref={panelsRef}
          className={`panels${dragging ? " panels-dragging" : ""}`}
          style={{
            minHeight: contentHeight,
            gridTemplateColumns: `${Math.max(0, tableFrac * 100)}% 8px ${Math.max(0, ganttFrac * 100)}%`,
          }}
        >
          {/* === Tabell === */}
          <div className="panel" style={{ alignSelf: "start" }}>
            <Tabell
              ref={tabellRef}
              rows={rows}
              setCell={setCell}
              onSelectionChange={setSelCells}
              onTotalWidthChange={setTableTotalWidth}
              onViewportWidthChange={setTableViewportWidth}
              onTopRowChange={setTopRow}
              height={contentHeight}
              scrollX={tableScrollX}
              onScrollXChange={setTableScrollX}
            />
          </div>

          {/* === Splitter === */}
          <div
            role="separator"
            aria-label="Flytt skillelinje mellom Tabell og Gantt"
            aria-orientation="vertical"
            className="splitter"
            style={{ height: "100%" }}
            onMouseDown={onSplitterDown}
            onTouchStart={onSplitterDown}
            onDoubleClick={onSplitterDoubleClick}
          />

          {/* === Gantt === */}
          <div className="panel" style={{ alignSelf: "start" }}>
            <GanttDiagram
              rows={rows}
              height={contentHeight}
              scrollX={ganttScrollX}
              topRow={topRow}
              zoom={zoom}
              showWeekends={showWeekends}
              showToday={showToday}
              onTotalWidthChange={setGanttTotalWidth}
              onViewportWidthChange={setGanttViewportWidth}
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
              max={Math.max(0, tableTotalWidth - tableViewportWidth)}
              step={1}
              value={Math.min(tableScrollX, Math.max(0, tableTotalWidth - tableViewportWidth))}
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
              max={Math.max(0, ganttTotalWidth - ganttViewportWidth)}
              step={1}
              value={Math.min(ganttScrollX, Math.max(0, ganttTotalWidth - ganttViewportWidth))}
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
