import React, { useEffect, useState } from "react";

/* ==== [BLOCK: types] BEGIN ==== */
export type ProsjektInfo = {
  navn: string;
  prosjektId: string;
  eier: string;
  start: string; // YYYY-MM-DD (fri tekst aksepteres, men vi viser som er)
  slutt: string;
  beskrivelse: string;
};

type Props = {
  open: boolean;
  initial: ProsjektInfo;
  onSave: (p: ProsjektInfo) => void;
  onClose: () => void;
};
/* ==== [BLOCK: types] END ==== */

export default function ProsjektInfoModal({ open, initial, onSave, onClose }: Props) {
  /* ==== [BLOCK: local state] BEGIN ==== */
  const [form, setForm] = useState<ProsjektInfo>(initial);
  useEffect(() => setForm(initial), [initial]);
  /* ==== [BLOCK: local state] END ==== */

  if (!open) return null;

  /* ==== [BLOCK: render] BEGIN ==== */
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Prosjektinformasjon"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,.35)",
        display: "grid",
        placeItems: "center",
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        className="panel"
        style={{ width: 680, maxWidth: "95vw", borderRadius: 12, padding: 16 }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ margin: "0 0 12px 0" }}>Prosjekt</h2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="Prosjektnavn">
            <input className="btn" value={form.navn} onChange={(e) => setForm({ ...form, navn: e.target.value })} />
          </Field>
          <Field label="Prosjekt-ID">
            <input className="btn" value={form.prosjektId} onChange={(e) => setForm({ ...form, prosjektId: e.target.value })} />
          </Field>
          <Field label="Eier">
            <input className="btn" value={form.eier} onChange={(e) => setForm({ ...form, eier: e.target.value })} />
          </Field>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Start">
              <input className="btn" placeholder="YYYY-MM-DD" value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} />
            </Field>
            <Field label="Slutt">
              <input className="btn" placeholder="YYYY-MM-DD" value={form.slutt} onChange={(e) => setForm({ ...form, slutt: e.target.value })} />
            </Field>
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <Field label="Beskrivelse">
              <textarea
                className="btn"
                rows={4}
                value={form.beskrivelse}
                onChange={(e) => setForm({ ...form, beskrivelse: e.target.value })}
              />
            </Field>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 12 }}>
          <button className="btn" onClick={onClose}>Avbryt</button>
          <button
            className="btn primary"
            onClick={() => {
              onSave(form);
              onClose();
            }}
          >
            Lagre
          </button>
        </div>
      </div>
    </div>
  );
  /* ==== [BLOCK: render] END ==== */
}

/* ==== [BLOCK: Field helper] BEGIN ==== */
function Field(props: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "grid", gap: 6 }}>
      <span style={{ fontSize: 12, color: "#6b7280" }}>{props.label}</span>
      {props.children}
    </label>
  );
}
/* ==== [BLOCK: Field helper] END ==== */
