import type { Rad } from "./types"; // NB: peker til ditt eksisterende types.ts i /core
import { toDate, fmt, addDays, subDays, diffDaysInclusive, toNum } from "./date";

/* ==== [BLOCK: types] BEGIN ==== */
export type ChangeKey = "start" | "slutt" | "varighet";
export type PromptKind =
  | "start-changed"
  | "slutt-changed"
  | "varighet-changed";

export type RecalcPromptMeta = {
  row: number;
  kind: PromptKind;
  nextRow: Rad; // snapshot etter primær-commit
};

export type PromptAction =
  | "keep-duration" // flytt motsatt dato for å bevare varighet
  | "keep-end"      // (ved start- eller varighet-endring) hold slutt
  | "keep-start";   // (ved slutt- eller varighet-endring) hold start
/* ==== [BLOCK: types] END ==== */

/* ==== [BLOCK: planner] BEGIN ==== */
/** Returnerer enten en prompt (tvetydig) eller en “auto plan” (patches) */
export function planAfterEdit(nextRow: Rad, editedKey: ChangeKey): {
  prompt?: RecalcPromptMeta;
  autoPatch?: Partial<Rad>;
} {
  const s = toDate(nextRow.start);
  const e = toDate(nextRow.slutt);
  const d = toNum(nextRow.varighet);

  // Tvetydige situasjoner — trenger valg
  if (editedKey === "start" && e && d && d > 0) {
    return { prompt: { row: -1, kind: "start-changed", nextRow } }; // row settes i Tabell
  }
  if (editedKey === "slutt" && s && d && d > 0) {
    return { prompt: { row: -1, kind: "slutt-changed", nextRow } };
  }
  if (editedKey === "varighet" && s && e) {
    return { prompt: { row: -1, kind: "varighet-changed", nextRow } };
  }

  // Ikke-tvetydige: kalkuler umiddelbart
  const patch: Partial<Rad> = {};

  // Start + Varighet → Slutt
  if ((editedKey === "start" || editedKey === "varighet") && s && d && d > 0) {
    patch.slutt = fmt(addDays(s, d - 1));
  }

  // Start + Slutt → Varighet
  if ((editedKey === "start" || editedKey === "slutt") && s && e && e >= s) {
    patch.varighet = diffDaysInclusive(s, e);
  }

  // Slutt tømt → nullstill varighet
  if (editedKey === "slutt" && s && !e) {
    patch.varighet = "" as any;
  }

  return { autoPatch: Object.keys(patch).length ? patch : undefined };
}
/* ==== [BLOCK: planner] END ==== */

/* ==== [BLOCK: resolver] BEGIN ==== */
/** Løser en prompt ved valgt action og returnerer patch */
export function resolvePrompt(nextRow: Rad, kind: PromptKind, action: PromptAction): Partial<Rad> {
  const s = toDate(nextRow.start);
  const e = toDate(nextRow.slutt);
  const d = toNum(nextRow.varighet);
  const patch: Partial<Rad> = {};

  if (kind === "start-changed" && s && e && d) {
    if (action === "keep-duration") {
      patch.slutt = fmt(addDays(s, d - 1));
    } else if (action === "keep-end") {
      patch.varighet = diffDaysInclusive(s, e);
    }
  }

  if (kind === "slutt-changed" && s && e && d) {
    if (action === "keep-duration") {
      patch.start = fmt(subDays(e, d - 1));
    } else if (action === "keep-start") {
      patch.varighet = diffDaysInclusive(s, e);
    }
  }

  if (kind === "varighet-changed" && s && e && d) {
    if (action === "keep-start") {
      patch.slutt = fmt(addDays(s, d - 1));
    } else if (action === "keep-end") {
      patch.start = fmt(subDays(e, d - 1));
    }
  }

  // Sanity: ugyldig rekkefølge → blank ut varighet
  const s2 = toDate(patch.start ?? nextRow.start);
  const e2 = toDate(patch.slutt ?? nextRow.slutt);
  if (s2 && e2 && e2 < s2) {
    patch.varighet = "" as any;
  }

  return patch;
}
/* ==== [BLOCK: resolver] END ==== */
