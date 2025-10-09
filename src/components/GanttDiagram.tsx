import React, { useEffect, useMemo, useRef } from "react";
import type { Rad } from "../core/types";
import { HEADER_H, ROW_H } from "../core/layout";

type Props = {
  rows: Rad[];
  height: number;
  scrollX: number;
};

export default function GanttDiagram({ rows, height, scrollX }: Props) {
  const scrollerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (scrollerRef.current) scrollerRef.current.scrollLeft = scrollX;
  }, [scrollX]);

  const totalWidth = useMemo(() => 3000, []);
  const contentHeight = useMemo(() => Math.max(HEADER_H + rows.length * ROW_H, height), [rows.length, height]);

  return (
    <div style={{ overflow: "hidden" }}>
      <div className="hide-native-scrollbars" ref={scrollerRef} style={{ overflow: "auto" }}>
        {/* Header */}
        <div style={{
          height: HEADER_H,
          borderBottom: "2px solid var(--line-strong)",
          display: "grid",
          gridTemplateColumns: `1fr`,
          alignItems: "center",
          padding: "0 10px",
          position: "sticky",
          top: 0,
          background: "#fff",
          zIndex: 1,
          minWidth: totalWidth
        }}>
          <div style={{ fontWeight: 600 }}>Tidslinje (placeholder)</div>
        </div>

        {/* Kropp – bare rute-linjer for nå */}
        <div style={{ minWidth: totalWidth }}>
          {rows.map((_, i) => (
            <div key={i} style={{
              height: ROW_H,
              borderBottom: "1px solid var(--grid)"
            }} />
          ))}
        </div>
      </div>
    </div>
  );
}
