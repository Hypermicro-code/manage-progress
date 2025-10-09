import { addDays, subDays, toDate, fmt } from "./date";

/* ==== [BLOCK: types] BEGIN ==== */
export type DepType = "FS" | "SS" | "FF" | "SF";
export type Lag = { days?: number }; // v0.5: +/- arbeidsdager via kalender (her: rene dager)
/* ==== [BLOCK: types] END ==== */

/* ==== [BLOCK: compute dependency] BEGIN ==== */
/**
 * Beregn konsekvens på successor (B) gitt predecessor (A) og avhengighetstype.
 * Returnerer patch på B: { start?: string; slutt?: string }
 * NB: Enkel rene-dager-variant. Ved v0.5 kobles dette til kalender.
 */
export function computeDependency({
  predStart,
  predEnd,
  succStart,
  succEnd,
  type,
  lag = {},
}: {
  predStart?: string;
  predEnd?: string;
  succStart?: string;
  succEnd?: string;
  type: DepType;
  lag?: Lag;
}): Partial<{ start: string; slutt: string }> {
  const L = Math.round(lag.days ?? 0);
  const ps = toDate(predStart);
  const pe = toDate(predEnd);
  const ss = toDate(succStart);
  const se = toDate(succEnd);

  if (type === "FS" && pe) {
    // B.start >= A.end + L
    const ns = addDays(pe, L);
    return { start: fmt(ns) };
  }
  if (type === "SS" && ps) {
    // B.start >= A.start + L
    const ns = addDays(ps, L);
    return { start: fmt(ns) };
  }
  if (type === "FF" && pe) {
    // B.end >= A.end + L
    const ne = addDays(pe, L);
    return { slutt: fmt(ne) };
  }
  if (type === "SF" && ps) {
    // B.end >= A.start + L
    const ne = addDays(ps, L);
    return { slutt: fmt(ne) };
  }
  return {};
}
/* ==== [BLOCK: compute dependency] END ==== */
