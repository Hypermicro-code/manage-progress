/* ==== [BLOCK: GanttDiagram – v1 zoom + overlays, no V-scroll] BEGIN ==== */
import React, { useEffect, useMemo, useRef } from "react";
import type { Rad } from "../core/types";
import {
  HEADER_H,
  ROW_H,
  GANTT_ZOOM_PX,
  GANTT_HORIZON_UNITS,
} from "../core/layout";

export type GanttZoom = "day" | "week" | "month";

type Props = {
  rows: Rad[];
  /** total content height (for å unngå intern V-scroll) */
  height: number;
  /** horisontal scrollposisjon styres utenfra */
  scrollX: number;
  /** øverste synlige rad (beregnet i scroll-host) */
  topRow: number;
  /** zoom-nivå */
  zoom: GanttZoom;
  /** vis helgeskygge (kun dag-zoom) */
  showWeekends: boolean;
  /** vis i-dag-linje */
  showToday: boolean;
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
    if (zoom === "month") {
      const s = startOfMonth(new Date(today.getFullYear(), 0, 1));
      return s;
    } else {
      const s = new Date(today);
      s.setDate(s.getDate() - 30);
      return startOfDay(s);
    }
  }, [today, zoom]);
  /* ==== [BLOCK: time scale] END ==== */

  /* ==== [BLOCK: dims] BEGIN ==== */
  const totalWidth = useMemo(() => units * pxPerUnit, [units, pxPerUnit]);
  const contentHeight = useMemo(
    () => Math.max(HEADER_H + rows.length * ROW_H, height),
    [rows.length, height]
  );
  /* ==== [BLOCK: dims] END ==== */

  /* ==== [BLOCK: render helpers] BEGIN ==== */
  const renderHeader = () => {
    const marks: React.ReactNode[] = [];
    if (zoom === "day") {
      for (let i = 0; i <= units; i++) {
        const d = new Date(startDate);
        d.setDate(d.getDate() + i);
        const x = i * pxPerUnit;
        const isMonthStart = d.getDate() === 1;
        marks.push(
          <div
            key={`d${i}`}
            style={{
              position: "absolute",
              left: x,
              top: 0,
              height: "100%",
              width: 1,
              background: isMonthStart ? "var(--line-strong)" : "var(--line)",
            }}
          />
        );
        if (isMonthStart) {
          marks.push(
            <div
              key={`m${i}`}
              style={{
                position: "absolute",
                left: x + 6,
                top: 8,
                fontSize: 12,
                color: "#6b7280",
              }}
            >
              {d.toLocaleDateString(undefined, {
                month: "short",
                year: "numeric",
              })}
            </div>
          );
        }
      }
    } else if (zoom === "week") {
      for (let i = 0; i <= units; i++) {
        const x = i * pxPerUnit;
        marks.push(
          <div
            key={`w${i}`}
            style={{
              position: "absolute",
              left: x,
              top: 0,
              height: "100%",
              width: 1,
              background: "var(--line)",
            }}
          />
        );
        if (i % 4 === 0) {
          const d = new Date(startDate);
          d.setDate(d.getDate() + i * 7);
          marks.push(
            <div
              key={`wm${i}`}
              style={{
                position: "absolute",
                left: x + 6,
                top: 8,
                fontSize: 12,
                color: "#6b7280",
              }}
            >
              {d.toLocaleDateString(undefined, {
                month: "short",
                year: "numeric",
              })}
            </div>
          );
        }
      }
    } else {
      for (let i = 0; i <= units; i++) {
        const x = i * pxPerUnit;
        marks.push(
          <div
            key={`m${i}`}
            style={{
              position: "absolute",
              left: x,
              top: 0,
              height: "100%",
              width: 1,
              background: "var(--line)",
            }}
          />
        );
        const d = new Date(startDate);
        d.setMonth(d.getMonth() + i);
        marks.push(
          <div
            key={`ml${i}`}
            style={{
              position: "absolute",
              left: x + 6,
              top: 8,
              fontSize: 12,
              color: "#6b7280",
            }}
          >
            {d.toLocaleDateString(undefined, {
              month: "short",
              year: "numeric",
            })}
          </div>
        );
      }
    }
    return marks;
  };

  const renderWeekendShading = () => {
    if (!showWeekends || zoom !== "day") return null;
    const bands: React.ReactNode[] = [];
    for (let i = 0; i < units; i++) {
      const d = new Date(startDate);
      d.setDate(d.getDate() + i);
      const day = d.getDay(); // 0=Sun,6=Sat
      if (day === 0 || day === 6) {
        const x = i * pxPerUnit;
        bands.push(
          <div
            key={`we${i}`}
            style={{
              position: "absolute",
              left: x,
              top: 0,
              width: pxPerUnit,
              height: "100%",
              background: "rgba(31, 41, 55, 0.05)",
            }}
          />
        );
      }
    }
    return bands;
  };

  const renderTodayLine = () => {
    if (!showToday) return null;
    let x = 0;
    if (zoom === "day") {
      const diffDays = Math.floor(
        (startOfDay(new Date()).getTime() - startDate.getTime()) /
          (1000 * 60 * 60 * 24)
      );
      x = diffDays * pxPerUnit + Math.floor(pxPerUnit / 2);
    } else if (zoom === "week") {
      const diffDays = Math.floor(
        (startOfDay(new Date()).getTime() - startDate.getTime()) /
          (1000 * 60 * 60 * 24)
      );
      const diffWeeks = Math.floor(diffDays / 7);
      x = diffWeeks * pxPerUnit + Math.floor(pxPerUnit / 2);
    } else {
      const months =
        (startOfDay(new Date()).getFullYear() - startDate.getFullYear()) * 12 +
        (startOfDay(new Date()).getMonth() - startDate.getMonth());
      x = months * pxPerUnit + Math.floor(pxPerUnit / 2);
    }
    return (
      <div
        style={{
          position: "absolute",
          left: x,
          top: 0,
          width: 2,
          height: "100%",
          background: "#ef4444",
        }}
      />
    );
  };
  /* ==== [BLOCK: render helpers] END ==== */

  return (
    <div style={{ overflow: "hidden" }}>
      {/* Horisontal scroll JA, vertikal scroll NEI */}
      <div
        className="hide-native-scrollbars"
        ref={scrollerRef}
        style={{ overflowX: "auto", overflowY: "hidden" }}
      >
        {/* Header */}
        <div
          style={{
            position: "relative",
            height: HEADER_H,
            borderBottom: "2px solid var(--line-strong)",
            background: "#fff",
            minWidth: totalWidth,
          }}
        >
          {renderHeader()}
        </div>

        {/* Kropp – bakgrunnsrutenett + overlays */}
        <div
          style={{
            position: "relative",
            minWidth: totalWidth,
            height: contentHeight - HEADER_H,
          }}
        >
          {/* Helgeskygge */}
          {renderWeekendShading()}

          {/* I-dag-linje */}
          {renderTodayLine()}

          {/* Radlinjer */}
          <div>
            {rows.map((_, i) => (
              <div
                key={i}
                style={{
                  height: ROW_H,
                  borderBottom: "1px solid var(--grid)",
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
/* ==== [BLOCK: GanttDiagram – v1 zoom + overlays, no V-scroll] END ==== */
