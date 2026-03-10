import { useEffect, useState } from "react";

// ─── NumInput ──────────────────────────────────────────────────────────────────
// Defined OUTSIDE EditorPanel so React never re-mounts it on re-renders.
// Uses local draft state — commits to parent only on blur or Enter.
function NumInput({ label, value, onChange, min = 0, max }) {
  const [draft, setDraft] = useState(String(value));

  useEffect(() => { setDraft(String(value)); }, [value]);

  const clamp = (n) =>
    max !== undefined ? Math.min(max, Math.max(min, n)) : Math.max(min, n);

  const commit = (raw = draft) => {
    const n = parseInt(raw, 10);
    if (isNaN(n)) { setDraft(String(value)); return; }
    const c = clamp(n);
    setDraft(String(c));
    if (c !== value) onChange(c);
  };

  const step = (delta) => {
    const n = clamp((parseInt(draft, 10) || 0) + delta);
    setDraft(String(n));
    onChange(n);
  };

  return (
    <div className="num-input-row">
      <span className="num-input-label">{label}</span>
      <input
        className="num-input"
        type="number"
        min={min}
        max={max}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => commit()}
        onKeyDown={(e) => {
          if (e.key === "Enter")  { e.target.blur(); }
          if (e.key === "Escape") { setDraft(String(value)); e.target.blur(); }
          if (e.key === "ArrowUp")   { e.preventDefault(); step(+1); }
          if (e.key === "ArrowDown") { e.preventDefault(); step(-1); }
        }}
      />
      <div className="num-spinners">
        <button className="spinner-btn" tabIndex={-1} onMouseDown={(e) => { e.preventDefault(); step(+1); }}>▲</button>
        <button className="spinner-btn" tabIndex={-1} onMouseDown={(e) => { e.preventDefault(); step(-1); }}>▼</button>
      </div>
    </div>
  );
}

// ─── EditorPanel ──────────────────────────────────────────────────────────────
export default function EditorPanel({ rect, onUpdate, onDelete, onDuplicate, onExport, onClearAll }) {
  return (
    <aside className="editor-panel">
      <h2>Properties</h2>

      {!rect ? (
        <p className="no-selection">Click a box to edit it.</p>
      ) : (
        <>
          <div className="uid-display">id: {rect.uid}</div>

          <div className="section-title">Ayah</div>
          <NumInput label="Surah" value={rect.surah} min={1} max={114}
            onChange={(v) => onUpdate({ surah: v })} />
          <NumInput label="Ayah"  value={rect.ayah}  min={1}
            onChange={(v) => onUpdate({ ayah: v })} />

          <div className="section-title" style={{ marginTop: 10 }}>Coordinates</div>
          <NumInput label="x" value={rect.x} min={0} onChange={(v) => onUpdate({ x: v })} />
          <NumInput label="y" value={rect.y} min={0} onChange={(v) => onUpdate({ y: v })} />
          <NumInput label="w" value={rect.w} min={1} onChange={(v) => onUpdate({ w: v })} />
          <NumInput label="h" value={rect.h} min={1} onChange={(v) => onUpdate({ h: v })} />

          <div className="btn-row">
            <button className="action-btn dup-btn" onClick={onDuplicate}>Duplicate</button>
            <button className="action-btn del-btn"  onClick={onDelete}>Delete</button>
          </div>
        </>
      )}

      <div className="panel-footer">
        <button className="export-btn" onClick={onExport}>Export JSON</button>
        <button className="clear-btn"
          onClick={() => { if (window.confirm("Clear all boxes on this page?")) onClearAll(); }}>
          Clear All
        </button>
      </div>
    </aside>
  );
}
