import React, { useMemo, useRef, useState } from "react";
import Fremdriftsplan from "./components/Fremdriftsplan";
import type { Rad } from "./core/types";

/* ==== [BLOCK: seed + helpers] BEGIN ==== */
const makeEmptyRow = (i: number): Rad => ({
  id: String(i + 1),
  navn: "",
  start: "",
  slutt: "",
  varighet: "",
  ap: "",
  pp: "",
  ansvarlig: "",
  status: ""
});

function seedRows(n: number): Rad[] {
  return Array.from({ length: n }, (_, i) => makeEmptyRow(i));
}
/* ==== [BLOCK: seed + helpers] END ==== */

export default function App() {
  /* 120 seed-rader */
  const [rows, setRows] = useState<Rad[]>(() => seedRows(120));

  const apiRef = useRef<{ scrollTableToX: (x: number) => void } | null>(null);
  const totalWidthRef = useRef<number>(0);

  const addRows = (n = 20) => {
    setRows(prev => {
      const start = prev.length;
      const more = Array.from({ length: n }, (_, k) => makeEmptyRow(start + k));
      return [...prev, ...more];
    });
  };

  const setCell = (rowIndex: number, key: keyof Rad, value: Rad[typeof key]) => {
    setRows(prev => {
      const next = prev.slice();
      next[rowIndex] = { ...next[rowIndex], [key]: value };
      return next;
    });
  };

  /** Tøm markerte celler: Fremdriftsplan gir oss en liste av {r,c} vi kan resette */
  const clearCells = (targets: { r: number; c: keyof Rad }[]) => {
    setRows(prev => {
      const next = prev.slice();
      for (const t of targets) {
        if (!next[t.r]) continue;
        // Tom-verdi per kolonne
        const empty: any = { navn: "", start: "", slutt: "", varighet: "", ap: "", pp: "", ansvarlig: "", status: "" };
        next[t.r] = { ...next[t.r], [t.c]: empty[t.c] };
      }
      return next;
    });
  };

  const api = useMemo(() => ({
    registerTableApi: (api: { scrollToX: (x: number) => void, onTotalWidth: (w: number) => void }) => {
      apiRef.current = { scrollTableToX: api.scrollToX };
      api.onTotalWidth(totalWidthRef.current);
      return {
        setTotalWidth: (w: number) => { totalWidthRef.current = w; }
      };
    }
  }), []);

  return (
    <div className="wrapper">
      <h1 style={{ margin: "8px 0 12px 0" }}>Manage Progress (MP) – Kickoff</h1>
      <Fremdriftsplan
        rows={rows}
        setCell={setCell}
        addRows={addRows}
        clearCells={clearCells}
        apiBridge={api}
      />
    </div>
  );
}
