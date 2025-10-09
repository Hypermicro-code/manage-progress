import React, { useMemo, useState } from "react";

/* ==== [BLOCK: types] BEGIN ==== */
export type FaqItem = {
  id: string;
  tittel: string;
  innhold: string;
  gruppe: "Kom i gang" | "Prosjekt" | "Tabell" | "Gantt";
};
/* ==== [BLOCK: types] END ==== */

const DEFAULTS: FaqItem[] = [
  { id: "k1", gruppe: "Kom i gang", tittel: "Legg til rader", innhold: "Klikk “+20 rader” i toolbaren." },
  { id: "k2", gruppe: "Kom i gang", tittel: "Flytt splitter", innhold: "Dra skillelinjen mellom Tabell og Gantt. Dobbeltklikk for 40/60." },
  { id: "p1", gruppe: "Prosjekt", tittel: "Prosjektinfo", innhold: "Åpne via (i)-knappen. Navn/ID/Eier vises i toolbar." },
  { id: "t1", gruppe: "Tabell", tittel: "Kopier utvalg", innhold: "Ctrl/Cmd+C kopierer utvalget til utklippstavle." },
  { id: "t2", gruppe: "Tabell", tittel: "Lim inn", innhold: "Marker celle og lim inn TSV fra Excel/Sheets – varighet tolkes som tall." },
  { id: "t3", gruppe: "Tabell", tittel: "Tøm markerte", innhold: "Bruk knappen “Tøm markerte” for å nullstille feltene." },
  { id: "t4", gruppe: "Tabell", tittel: "Ingen interne scrollbars", innhold: "Vertikal scroll skjer kun i hovedvinduet." },
  { id: "g1", gruppe: "Gantt", tittel: "Zoom og overlays", innhold: "Velg Dag/Uke/Måned, helgeskygge og i-dag-linje i toolbar." },
  { id: "g2", gruppe: "Gantt", tittel: "Synk med tabell", innhold: "Start/Slutt/Varighet oppdateres i tabellen og flytter blokker i Gantt." },
];

/* ==== [BLOCK: component] BEGIN ==== */
export default function HjelpFaqPanel({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [q, setQ] = useState("");

  const items = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return DEFAULTS;
    return DEFAULTS.filter(
      (i) =>
        i.tittel.toLowerCase().includes(term) ||
        i.innhold.toLowerCase().includes(term) ||
        i.gruppe.toLowerCase().includes(term)
    );
  }, [q]);

  if (!open) return null;

  const grupper = ["Kom i gang", "Prosjekt", "Tabell", "Gantt"] as const;

  return (
    <aside
      aria-label="Hjelp og FAQ"
      style={{
        position: "fixed",
        top: 16,
        right: 16,
        bottom: 16,
        width: 360,
        background: "#fff",
        border: "1px solid var(--line)",
        borderRadius: 12,
        boxShadow: "0 10px 32px rgba(0,0,0,.12)",
        display: "grid",
        gridTemplateRows: "auto 1fr auto",
        zIndex: 900,
      }}
    >
      {/* Header */}
      <div style={{ padding: 10, borderBottom: "1px solid var(--line)", display: "flex", gap: 8, alignItems: "center" }}>
        <strong style={{ fontSize: 14 }}>Hjelp</strong>
        <input
          className="btn"
          placeholder="Søk…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{ marginLeft: "auto", width: 160 }}
        />
        <button className="btn" onClick={onClose} aria-label="Lukk">Lukk</button>
      </div>

      {/* Innhold (scrollbart) */}
      <div className="hide-native-scrollbars" style={{ overflow: "auto", padding: 10 }}>
        {grupper.map((g) => {
          const subset = items.filter((i) => i.gruppe === g);
          if (subset.length === 0) return null;
          return (
            <div key={g} style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: "#6b7280", margin: "8px 0" }}>{g}</div>
              <div style={{ display: "grid", gap: 6 }}>
                {subset.map((i) => (
                  <details key={i.id} style={{ border: "1px solid var(--line)", borderRadius: 8, padding: "6px 8px", background: "#fff" }}>
                    <summary style={{ cursor: "pointer" }}>{i.tittel}</summary>
                    <div style={{ fontSize: 13, color: "#111", paddingTop: 6 }}>{i.innhold}</div>
                  </details>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div style={{ padding: 10, borderTop: "1px solid var(--line)", fontSize: 12, color: "#6b7280" }}>
        Tips: Dobbeltklikk på splitteren for å resette til 40/60.
      </div>
    </aside>
  );
}
/* ==== [BLOCK: component] END ==== */
