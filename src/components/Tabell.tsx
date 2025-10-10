/* ==== [BLOCK: editor observer (commit på blur/enter/klikk-utenfor)] BEGIN ==== */
useEffect(() => {
  const gridEl = gridRef.current as any;
  if (!gridEl) return;

  const shadow = gridEl.shadowRoot as ShadowRoot | null;
  if (!shadow) return;

  editorObsRef.current?.disconnect();
  editorObsRef.current = new MutationObserver(() => {
    const editorHost = shadow.querySelector(".editCell") as HTMLElement | null;
    const input =
      (editorHost?.querySelector("input, textarea") as
        | HTMLInputElement
        | HTMLTextAreaElement
        | null) ?? null;

    editorInputRef.current = input || null;

    if (input) {
      const focus = focusRef.current;
      if (focus) {
        editorInfoRef.current = { row: focus.rowIndex, col: focus.colKey as GridColKey };
      }

      // NB: TS-friendly EventListener-signatur
      const onKeyDown: EventListener = (evt: Event) => {
        const e = evt as KeyboardEvent;
        if (e.key === "Enter") {
          const info = editorInfoRef.current;
          if (info) commitEdit(info.row, info.col, (input as any).value);
        }
      };
      const onBlur: EventListener = () => {
        const info = editorInfoRef.current;
        if (info) commitEdit(info.row, info.col, (input as any).value);
      };

      input.addEventListener("keydown", onKeyDown);
      input.addEventListener("blur", onBlur);

      const cleanup = () => {
        input.removeEventListener("keydown", onKeyDown);
        input.removeEventListener("blur", onBlur);
      };

      // Rydd når editoren forsvinner
      const cellObs = new MutationObserver(() => {
        const stillThere = shadow.querySelector(".editCell");
        if (!stillThere) {
          cleanup();
          cellObs.disconnect();
          editorInputRef.current = null;
          editorInfoRef.current = null;
        }
      });
      cellObs.observe(shadow, { childList: true, subtree: true });
    }
  });

  editorObsRef.current.observe(shadow, { childList: true, subtree: true });

  return () => {
    editorObsRef.current?.disconnect();
    editorObsRef.current = null;
    editorInputRef.current = null;
    editorInfoRef.current = null;
  };
}, [rows]);
/* ==== [BLOCK: editor observer (commit på blur/enter/klikk-utenfor)] END ==== */
