// Tabell.tsx – minimal sanity test for RevoGrid
import React, { useEffect, useRef } from "react";
import "@revolist/revogrid";

/* ==== [BLOCK: JSX shim] BEGIN ==== */
declare global {
  namespace JSX {
    interface IntrinsicElements {
      "revo-grid": any;
    }
  }
}
/* ==== [BLOCK: JSX shim] END ==== */

export default function Tabell() {
  const gridRef = useRef<any>(null);

  useEffect(() => {
    const el = gridRef.current;
    if (!el) return;
    el.columns = [{ name: "Navn", prop: "navn", size: 200 }];
    el.source = [{ navn: "Test-rad 1" }];
  }, []);

  return (
    <div style={{ height: 400, background: "#fff" }}>
      <revo-grid ref={gridRef} theme="material" resize canFocus></revo-grid>
    </div>
  );
}
