/* ==== [BLOCK: Gantt renderHeader – exact vertical centering] BEGIN ==== */
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
        <div key={`d${i}`} style={{
          position: "absolute", left: x, top: 0, height: "100%", width: 1,
          background: isMonthStart ? "var(--line-strong)" : "var(--line)"
        }} />
      );

      if (isMonthStart) {
        marks.push(
          <div key={`m${i}`} style={{ ...labelStyle, left: x + 6 }}>
            {d.toLocaleDateString(undefined, { month: "short", year: "numeric" })}
          </div>
        );
      }
    }
  } else if (zoom === "week") {
    for (let i = 0; i <= units; i++) {
      const x = i * pxPerUnit;
      marks.push(
        <div key={`w${i}`} style={{
          position: "absolute", left: x, top: 0, height: "100%", width: 1, background: "var(--line)"
        }} />
      );
      if (i % 4 === 0) {
        const d = new Date(startDate);
        d.setDate(d.getDate() + i * 7);
        marks.push(
          <div key={`wm${i}`} style={{ ...labelStyle, left: x + 6 }}>
            {d.toLocaleDateString(undefined, { month: "short", year: "numeric" })}
          </div>
        );
      }
    }
  } else {
    for (let i = 0; i <= units; i++) {
      const x = i * pxPerUnit;
      marks.push(
        <div key={`m${i}`} style={{
          position: "absolute", left: x, top: 0, height: "100%", width: 1, background: "var(--line)"
        }} />
      );
      const d = new Date(startDate);
      d.setMonth(d.getMonth() + i);
      marks.push(
        <div key={`ml${i}`} style={{ ...labelStyle, left: x + 6 }}>
          {d.toLocaleDateString(undefined, { month: "short", year: "numeric" })}
        </div>
      );
    }
  }
  return marks;
};
/* ==== [BLOCK: Gantt renderHeader – exact vertical centering] END ==== */
