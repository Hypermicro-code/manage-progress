/* ==== [BLOCK: layout constants] BEGIN ==== */
export const ROW_H = 34;       // px – må matche Tabell + Gantt
export const HEADER_H = 56;    // px – må matche Tabell + Gantt header

export const TABLE_COLS = [
  { key: "navn",       name: "Navn",      width: 260 },
  { key: "start",      name: "Start",     width: 130 },
  { key: "slutt",      name: "Slutt",     width: 130 },
  { key: "varighet",   name: "Varighet",  width: 120 },
  { key: "ap",         name: "AP%",       width: 90  },
  { key: "pp",         name: "PP%",       width: 90  },
  { key: "ansvarlig",  name: "Ansvarlig", width: 160 },
  { key: "status",     name: "Status",    width: 200 }
] as const;
/* ==== [BLOCK: layout constants] END ==== */

/* ==== [BLOCK: gantt zoom presets] BEGIN ==== */
export type GanttZoom = "day" | "week" | "month";

/** px per “enhet” (dag/uke/måned) */
export const GANTT_ZOOM_PX: Record<GanttZoom, number> = {
  day: 24,   // 1 dag = 24 px
  week: 42,  // 1 uke = 42 px
  month: 90, // 1 mnd = 90 px
};

/** horisont-horisont: hvor mange enheter tegnes */
export const GANTT_HORIZON_UNITS: Record<GanttZoom, number> = {
  day: 240,   // ~8 mnd
  week: 104,  // 2 år
  month: 36,  // 3 år
};
/* ==== [BLOCK: gantt zoom presets] END ==== */
