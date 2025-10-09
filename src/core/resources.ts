/* ==== [BLOCK: resource estimation] BEGIN ==== */
/**
 * En enkel ressurskalkulator:
 * - effortHours: totalt antall timer som trengs (summen av oppgaven)
 * - hoursPerDay: tilgjengelige timer per ressurs per dag (f.eks. 7.5)
 * - availabilityPct: prosent tilgjengelighet per ressurs (0..100)
 * - durationDays: antall kalender-/arbeidsdager (her: rene dager i v0.2)
 *
 * Returnerer estimert antall ressurser (avrundet opp).
 */
export function estimateResources({
  effortHours,
  hoursPerDay,
  availabilityPct,
  durationDays,
}: {
  effortHours: number;
  hoursPerDay: number;
  availabilityPct: number; // 0..100
  durationDays: number;
}): number {
  if (effortHours <= 0 || hoursPerDay <= 0 || availabilityPct <= 0 || durationDays <= 0) return 0;
  const effectiveHoursPerResource = hoursPerDay * (availabilityPct / 100) * durationDays;
  return Math.max(0, Math.ceil(effortHours / effectiveHoursPerResource));
}
/* ==== [BLOCK: resource estimation] END ==== */
