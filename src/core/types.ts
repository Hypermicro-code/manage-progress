/* ==== [BLOCK: shared types] BEGIN ==== */
export type Rad = {
  id: string;
  navn: string;
  start: string;   // ISO yyyy-mm-dd
  slutt: string;   // ISO yyyy-mm-dd
  varighet: number | "";
  ap: number | ""; // % gjenstår (AP)
  pp: number | ""; // % fullført (PP)
  ansvarlig: string;
  status: string;
};
/** Kolonne-key i tabellen */
export type KolonneKey =
  | "navn" | "start" | "slutt" | "varighet"
  | "ap" | "pp" | "ansvarlig" | "status";
/* ==== [BLOCK: shared types] END ==== */
