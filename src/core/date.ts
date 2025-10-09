/* ==== [BLOCK: date helpers – flexible parsing] BEGIN ==== */

/** Månedsnavn/alias – både norsk og engelsk */
const MONTHS: Record<string, number> = {
  jan: 0, januar: 0, january: 0,
  feb: 1, februar: 1, february: 1,
  mar: 2, mars: 2, march: 2,
  apr: 3, april: 3,
  mai: 4, may: 4,
  jun: 5, juni: 5, june: 5,
  jul: 6, juli: 6, july: 6,
  aug: 7, august: 7,
  sep: 8, sept: 8, september: 8,
  okt: 9, october: 9, oktob: 9, // "okt" / "oct"
  nov: 10, november: 10,
  des: 11, desember: 11, dec: 11, december: 11,
};

function clampInt(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}
function makeDate(y: number, m: number, d: number): Date | null {
  const dt = new Date(y, m, d);
  if (isNaN(dt.getTime())) return null;
  dt.setHours(0, 0, 0, 0);
  // Sjekk at JS ikke har “rullet” måneden (f.eks. 2025-02-31)
  if (dt.getFullYear() !== y || dt.getMonth() !== m || dt.getDate() !== d) return null;
  return dt;
}

export function fmt(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${da}`;
}
export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  x.setHours(0, 0, 0, 0);
  return x;
}
export const subDays = (d: Date, n: number) => addDays(d, -n);
export function diffDaysInclusive(a: Date, b: Date): number {
  const ms = b.getTime() - a.getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24)) + 1;
}
export function toNum(n: any): number | null {
  const v = Number(String(n ?? "").replace(",", "."));
  return Number.isFinite(v) ? v : null;
}

/**
 * Fleksibel parser:
 *  - ISO: YYYY-MM-DD, YYYY/M/D, YYYYMMDD
 *  - Norsk/EU: D.M.YYYY, D/M/YYYY, D-M-YYYY, og kort D.M / D/M (bruker current year)
 *  - Tekst: "1 feb 2025", "01 feb", "1. feb", "1 February 25"
 *  - Relative: "i dag" / "idag" / "today", "+7" (dager), "-3"
 *
 *  Ambiguitet for "/" tolkes som D/M(/Y) – norsk standard.
 */
export function toDate(v: any): Date | null {
  const raw = String(v ?? "").trim().toLowerCase();
  if (!raw) return null;

  // Relative
  if (raw === "i dag" || raw === "idag" || raw === "today") {
    const t = new Date(); t.setHours(0, 0, 0, 0); return t;
  }
  if (/^[+-]\d{1,4}$/.test(raw)) {
    const n = parseInt(raw, 10);
    const t = new Date(); t.setHours(0, 0, 0, 0);
    return addDays(t, n);
  }

  // Pure digits: YYYYMMDD (8)
  if (/^\d{8}$/.test(raw)) {
    const y = parseInt(raw.slice(0, 4), 10);
    const m = parseInt(raw.slice(4, 6), 10) - 1;
    const d = parseInt(raw.slice(6, 8), 10);
    return makeDate(y, m, d);
  }

  // ISO-like: YYYY[-/.]M[-/.]D
  let m = raw.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (m) {
    const y = parseInt(m[1], 10);
    const mo = parseInt(m[2], 10) - 1;
    const d = parseInt(m[3], 10);
    return makeDate(y, mo, d);
  }

  // D[./-]M[./-]YYYY eller D[./-]M (assume norsk D/M/Y)
  m = raw.match(/^(\d{1,2})[./-](\d{1,2})(?:[./-](\d{2,4}))?$/);
  if (m) {
    const d = parseInt(m[1], 10);
    const mo = parseInt(m[2], 10) - 1;
    let y = m[3] ? parseInt(m[3], 10) : new Date().getFullYear();
    if (y < 100) y += y >= 70 ? 1900 : 2000;
    return makeDate(y, mo, d);
  }

  // Tekst: "1 feb 2025" / "01 feb" / "1. februar 25"
  m = raw.match(/^(\d{1,2})(?:[.\s])?([a-zæøå]+)\s*(\d{2,4})?$/i);
  if (m) {
    const d = parseInt(m[1], 10);
    const monKey = (m[2] || "").slice(0, 4).replace(/[^a-zæøå]/g, "");
    const mo = MONTHS.hasOwnProperty(monKey) ? (MONTHS as any)[monKey] as number : undefined;
    if (mo === undefined) return null;
    let y = m[3] ? parseInt(m[3], 10) : new Date().getFullYear();
    if (y < 100) y += y >= 70 ? 1900 : 2000;
    return makeDate(y, mo, d);
  }

  // Fallback: stol på Date(...) hvis mulig
  const dt = new Date(raw);
  if (!isNaN(dt.getTime())) {
    dt.setHours(0, 0, 0, 0);
    return dt;
  }
  return null;
}

/**
 * Normaliser en inputstreng til YYYY-MM-DD hvis mulig.
 * Returnerer { normalized, date } – normalized er "" hvis parsing feilet.
 */
export function canonicalizeDateInput(input: any): { normalized: string; date: Date | null } {
  const d = toDate(input);
  return { normalized: d ? fmt(d) : "", date: d };
}
/* ==== [BLOCK: date helpers – flexible parsing] END ==== */
