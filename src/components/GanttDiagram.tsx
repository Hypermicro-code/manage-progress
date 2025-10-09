/* ==== [BLOCK: GanttDiagram – zoom, overlays, width-report + task blocks v0.2] BEGIN ==== */
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

  /** rapportér totalWidth og viewportWidth */
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
function parseDate(s: any): Date | null {
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
  return isNaN(dt.getTime()) ? null : new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
}
function monthsBetween(a: Date, b: Date): number {
  return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
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

  /* ==== [BLOCK: task blocks v0.2] BEGIN ==== */
  const renderTasks = () => {
    const nodes: React.ReactNode[] = [];
    const rowTopBase = 0; // vi er i content-området (under HEADER_H allerede)
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i] as any;
      const s = parseDate(r?.start);
      const durN = Number(String(r?.varighet ?? "").replace(",", "."));
      if (!s || !Number.isFinite(durN) || durN <= 0) continue;

      let x = 0;
      let w = pxPerUnit; // minste bredde enheten
      if (zoom === "day") {
        const daysFromStart = Math.floor((s.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
        x = daysFromStart * pxPerUnit;
        w = Math.max(pxPerUnit * durN, pxPerUnit * 0.6);
      } else if (zoom === "week") {
        const daysFromStart = Math.floor((s.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
        const weeksFromStart = Math.floor(daysFromStart / 7);
        x = weeksFromStart * pxPerUnit;
        const weeks = Math.max(1, Math.ceil(durN / 7));
        w = weeks * pxPerUnit;
      } else {
        const m = monthsBetween(startDate, s);
        x = m * pxPerUnit;
        const months = Math.max(1, Math.ceil(durN / 30));
        w = months * pxPerUnit;
      }

      const y = rowTopBase + i * ROW_H + 6; // litt padding i raden
      const h = ROW_H - 12;

      nodes.push(
        <div
          key={`t${i}`}
          title={`${r?.navn || "Oppgave"} • ${r?.start || ""} → ${r?.slutt || ""} (${r?.varighet || ""}d)`}
          style={{
            position: "absolute",
            left: x,
            top: y,
            width: Math.max(6, w),
            height: Math.max(8, h),
            background: "#60a5fa",
            border: "1px solid #1d4ed8",
            borderRadius: 4,
            boxShadow: "0 2px 6px rgba(0,0,0,.08)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "0 6px",
              fontSize: 12,
              lineHeight: `${Math.max(8, h)}px`,
              color: "#0b1b3a",
              whiteSpace: "nowrap",
              textOverflow: "ellipsis",
              overflow: "hidden",
            }}
          >
            {r?.navn || r?.id || "Oppgave"}
          </div>
        </div>
      );
    }
    return nodes;
  };
  /* ==== [BLOCK: task blocks v0.2] END ==== */

  return (
    <div style={{ overflow: "hidden" }}>
      <div className="hide-native-scrollbars" ref={scrollerRef} style={{ overflowX: "auto", overflowY: "hidden" }}>
        <div style={{ position: "relative", height: HEADER_H, borderBottom: "2px solid var(--line-strong)", background: "#fff", minWidth: totalWidth }}>
          {renderHeader()}
        </div>
        <div style={{ position: "relative", minWidth: totalWidth, height: contentHeight - HEADER_H }}>
          {renderWeekendShading()}
          {renderTodayLine()}
          {/* radlinjer */}
          <div>
            {rows.map((_, i) => (
              <div key={i} style={{ height: ROW_H, borderBottom: "1px solid var(--grid)" }} />
            ))}
          </div>
          {/* oppgaveblokker */}
          <div style={{ position: "absolute", left: 0, top: 0, right: 0, bottom: 0 }}>
            {renderTasks()}
          </div>
        </div>
      </div>
    </div>
  );
}
/* ==== [BLOCK: GanttDiagram – zoom, overlays, width-report + task blocks v0.2] END ==== */
