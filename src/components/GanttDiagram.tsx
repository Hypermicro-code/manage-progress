/* ==== [BLOCK: GanttDiagram – zoom, overlays, width-report] BEGIN ==== */
import React, { useEffect, useMemo, useRef } from "react";
import type { Rad } from "../core/types";
import {
  HEADER_H,
  ROW_H,
  GANTT_ZOOM_PX,
  GANTT_HORIZON_UNITS,
  type GanttZoom,
} from "../core/layout";

type Props = {
  rows: Rad[];
  height: number;
  scrollX: number;
  topRow: number;
  zoom: GanttZoom;
  showWeekends: boolean;
  showToday: boolean;

  /** NY: rapportér totalWidth og viewportWidth */
  onTotalWidthChange?: (w: number) => void;
  onViewportWidthChange?: (w: number) => void;
};

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function startOfMonth(d: Date) {
  const x = startOfDay(d);
  x.setDate(1);
  return x;
}

export default function GanttDiagram({
  rows,
  height,
  scrollX,
  topRow,
  zoom,
  showWeekends,
  showToday,
  onTotalWidthChange,
  onViewportWidthChange,
}: Props) {
  const scrollerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (scrollerRef.current) scrollerRef.current.scrollLeft = scrollX;
  }, [scrollX]);

  /* ==== [BLOCK: time scale] BEGIN ==== */
  const pxPerUnit = GANTT_ZOOM_PX[zoom];
  const units = GANTT_HORIZON_UNITS[zoom];

  const today = useMemo(() => startOfDay(new Date()), []);
  const startDate = useMemo(() => {
    if (zoom === "month") return startOfMonth(new Date(today.getFullYear(), 0, 1));
    const s = new Date(today);
    s.setDate(s.getDate() - 30);
    return startOfDay(s);
  }, [today, zoom]);
  /* ==== [BLOCK: time scale] END ==== */

  /* ==== [BLOCK: dims] BEGIN ==== */
  const totalWidth = useMemo(() => units * pxPerUnit, [units, pxPerUnit]);
  const contentHeight = useMemo(
    () => Math.max(HEADER_H + rows.length * ROW_H, height),
    [rows.length, height]
  );

  useEffect(() => {
    onTotalWidthChange?.(totalWidth);
  }, [totalWidth, onTotalWidthChange]);

  useEffect(() => {
    const send = () => {
      const w = scrollerRef.current?.clientWidth ?? 0;
      onViewportWidthChange?.(w);
    };
    send();
    window.addEventListener("resize", send);
    return () => window.removeEventListener("resize", send);
  }, [onViewportWidthChange]);
  /* ==== [BLOCK: dims] END ==== */

  /* ==== [BLOCK: header render] BEGIN ==== */
  const renderHeader = () => {
    const marks: React.ReactNode[] = [];
    const labelStyle: React.CSSProperties = {
      position: "absolute",
      left: 0,
      top: "50%",
      transform: "translateY(-50%)",
      fontSize: 12,
      color: "#6b7280",
      pointerEvents: "none",
    };

    if (zoom === "day") {
      for (let i = 0; i <= units; i++) {
        const d = new Date(startDate);
        d.setDate(d.getDate() + i);
        const x = i * pxPerUnit;
        const isMonthStart = d.getDate() === 1;
        marks.push(
          <div key={`d${i}`} style={{ position: "absolute", left: x, top: 0, height: "100%", width: 1,
            background: isMonthStart ? "var(--line-strong)" : "var(--line)" }} />
        );
        if (isMonthStart) {
          marks.push(<div key={`m${i}`} style={{ ...labelStyle, left: x + 6 }}>
            {d.toLocaleDateString(undefined, { month: "short", year: "numeric" })}
          </div>);
        }
      }
    } else if (zoom === "week") {
      for (let i = 0; i <= units; i++) {
        const x = i * pxPerUnit;
        marks.push(
          <div key={`w${i}`} style={{ position: "absolute", left: x, top: 0, height: "100%", width: 1, background: "var(--line)" }} />
        );
        if (i % 4 === 0) {
          const d = new Date(startDate);
          d.setDate(d.getDate() + i * 7);
          marks.push(<div key={`wm${i}`} style={{ ...labelStyle, left: x + 6 }}>
            {d.toLocaleDateString(undefined, { month: "short", year: "numeric" })}
          </div>);
        }
      }
    } else {
      for (let i = 0; i <= units; i++) {
        const x = i * pxPerUnit;
        marks.push(
          <div key={`m${i}`} style={{ position: "absolute", left: x, top: 0, height: "100%", width: 1, background: "var(--line)" }} />
        );
        const d = new Date(startDate);
        d.setMonth(d.getMonth() + i);
        marks.push(<div key={`ml${i}`} style={{ ...labelStyle, left: x + 6 }}>
          {d.toLocaleDateString(undefined, { month: "short", year: "numeric" })}
        </div>);
      }
    }
    return marks;
  };
  /* ==== [BLOCK: header render] END ==== */

  /* ==== [BLOCK: weekend + today overlays] BEGIN ==== */
  const renderWeekendShading = () => {
    if (!showWeekends || zoom !== "day") return null;
    const bands: React.ReactNode[] = [];
    for (let i = 0; i < units; i++) {
      const d = new Date(startDate);
      d.setDate(d.getDate() + i);
      const day = d.getDay();
      if (day === 0 || day === 6) {
        const x = i * pxPerUnit;
        bands.push(
          <div key={`we${i}`} style={{
            position: "absolute", left: x, top: 0, width: pxPerUnit, height: "100%",
            background: "rgba(31, 41, 55, 0.05)",
          }} />
        );
      }
    }
    return bands;
  };

  const renderTodayLine = () => {
    if (!showToday) return null;
    let x = 0;
    if (zoom === "day") {
      const diffDays = Math.floor((startOfDay(new Date()).getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      x = diffDays * pxPerUnit + Math.floor(pxPerUnit / 2);
    } else if (zoom === "week") {
      const diffDays = Math.floor((startOfDay(new Date()).getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      const diffWeeks = Math.floor(diffDays / 7);
      x = diffWeeks * pxPerUnit + Math.floor(pxPerUnit / 2);
    } else {
      const months =
        (startOfDay(new Date()).getFullYear() - startDate.getFullYear()) * 12 +
        (startOfDay(new Date()).getMonth() - startDate.getMonth());
      x = months * pxPerUnit + Math.floor(pxPerUnit / 2);
    }
    return <div style={{ position: "absolute", left: x, top: 0, width: 2, height: "100%", background: "#ef4444" }} />;
  };
  /* ==== [BLOCK: weekend + today overlays] END ==== */

  return (
    <div style={{ overflow: "hidden" }}>
      <div className="hide-native-scrollbars" ref={scrollerRef} style={{ overflowX: "auto", overflowY: "hidden" }}>
        <div style={{ position: "relative", height: HEADER_H, borderBottom: "2px solid var(--line-strong)", background: "#fff", minWidth: totalWidth }}>
          {renderHeader()}
        </div>
        <div style={{ position: "relative", minWidth: totalWidth, height: contentHeight - HEADER_H }}>
          {renderWeekendShading()}
          {renderTodayLine()}
          <div>
            {rows.map((_, i) => (
              <div key={i} style={{ height: ROW_H, borderBottom: "1px solid var(--grid)" }} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
/* ==== [BLOCK: GanttDiagram – zoom, overlays, width-report] END ==== */
