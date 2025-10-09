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
