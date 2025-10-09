import { toDate, diffDaysInclusive, fmt } from "./date";

/* ==== [BLOCK: rollup main task] BEGIN ==== */
/**
 * Gitt en liste av barne-rader (minStart, maxSlutt), sett hovedaktivitetens
 * start/slutt/varighet basert på barna (rene dager).
 */
export function rollupSummaryTask(children: { start?: string; slutt?: string }[]): {
  start: string | "";
  slutt: string | "";
  varighet: number | "" ;
} {
  const starts = children.map(c => toDate(c.start)).filter(Boolean) as Date[];
  const ends = children.map(c => toDate(c.slutt)).filter(Boolean) as Date[];
  if (starts.length === 0 || ends.length === 0) {
    return { start: "", slutt: "", varighet: "" };
  }
  const minS = new Date(Math.min(...starts.map(d => d.getTime())));
  const maxE = new Date(Math.max(...ends.map(d => d.getTime())));
  return {
    start: fmt(minS),
    slutt: fmt(maxE),
    varighet: diffDaysInclusive(minS, maxE),
  };
}
/* ==== [BLOCK: rollup main task] END ==== */
