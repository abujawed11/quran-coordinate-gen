import { useEffect, useRef, useState } from "react";

function NumInput({ label, value, onChange, min = 0, max, mixed = false }) {
  const [draft, setDraft] = useState(mixed ? "" : String(value));

  useEffect(() => {
    setDraft(mixed ? "" : String(value ?? ""));
  }, [value, mixed]);

  const clamp = (n) =>
    max !== undefined ? Math.min(max, Math.max(min, n)) : Math.max(min, n);

  const commit = (raw = draft) => {
    const n = parseInt(raw, 10);
    if (isNaN(n)) { setDraft(mixed ? "" : String(value)); return; }
    const c = clamp(n);
    setDraft(String(c));
    onChange(c);
  };

  const step = (delta) => {
    const base = parseInt(draft, 10);
    if (isNaN(base)) return;
    const n = clamp(base + delta);
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
        placeholder={mixed ? "mixed" : undefined}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => commit()}
        onKeyDown={(e) => {
          if (e.key === "Enter")     { e.target.blur(); }
          if (e.key === "Escape")    { setDraft(mixed ? "" : String(value)); e.target.blur(); }
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

export default function EditorPanel({ rects, allRects, onUpdate, onDelete, onDuplicate, onExport, onPreview, onClearAll, onBulkSetSurah, onBulkApplyAyahPattern }) {
  if (rects === undefined) rects = [];
  if (allRects === undefined) allRects = [];

  const count = rects.length;
  const allCount = allRects.length;

  // ── Bulk apply state ──────────────────────────────────────────────────────
  const [bulkSurah, setBulkSurah] = useState(1);
  const [bulkStartAyah, setBulkStartAyah] = useState(1);
  const [patternStr, setPatternStr] = useState("");
  const patternRef = useRef(null);

  const parsedCounts = patternStr
    .split(",")
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => !isNaN(n) && n > 0);
  const patternTotal = parsedCounts.reduce((a, b) => a + b, 0);

  const patternPreview = patternStr.trim() === "" ? null
    : patternTotal === 0 ? "invalid pattern"
    : patternTotal > allCount ? `covers ${patternTotal} (only ${allCount} boxes)`
    : patternTotal < allCount ? `covers ${patternTotal} of ${allCount} boxes`
    : `covers all ${allCount} boxes`;

  const patternOk = parsedCounts.length > 0 && patternTotal > 0 && allCount > 0;
  const patternExact = patternOk && patternTotal === allCount;

  // Helper: get display value for a field — null if mixed across selection
  const fieldVal = (key) => {
    if (count === 0) return null;
    const first = rects[0][key];
    return rects.every((r) => r[key] === first) ? first : null;
  };

  const isMixed = (key) => count > 1 && fieldVal(key) === null;

  return (
    <aside className="editor-panel">
      <h2>Properties</h2>

      <div className="panel-content">

        {/* ── Bulk Apply (always visible) ─────────────────────────────── */}
        <div className="bulk-section">
          <div className="section-title" style={{ color: "#a78bfa" }}>Bulk — this page</div>

          {/* Surah */}
          <div className="bulk-field-label">Surah</div>
          <NumInput label="S" value={bulkSurah} min={1} max={114} onChange={setBulkSurah} />
          <button
            className="bulk-apply-btn"
            disabled={allCount === 0}
            onClick={() => onBulkSetSurah(bulkSurah)}
          >
            Apply Surah to all {allCount > 0 ? `(${allCount})` : ""}
          </button>

          {/* Ayah pattern */}
          <div className="bulk-field-label" style={{ marginTop: 4 }}>Ayah pattern</div>
          <NumInput label="Start" value={bulkStartAyah} min={0} onChange={setBulkStartAyah} />
          <input
            ref={patternRef}
            className="pattern-input"
            type="text"
            placeholder="e.g. 3,4,2,1"
            value={patternStr}
            onChange={(e) => setPatternStr(e.target.value)}
          />
          {patternPreview && (
            <div className={`pattern-preview ${patternExact ? "pattern-preview--ok" : patternOk ? "pattern-preview--warn" : "pattern-preview--err"}`}>
              {patternPreview}
            </div>
          )}
          <button
            className="bulk-apply-btn bulk-apply-btn--ayah"
            disabled={!patternOk || allCount === 0}
            onClick={() => onBulkApplyAyahPattern(bulkStartAyah, parsedCounts)}
          >
            Apply Ayah pattern
          </button>
        </div>

        <div className="bulk-divider" />

        {count === 0 && (
          <p className="no-selection">Click a box to edit it.</p>
        )}

        {count === 1 && (
          <>
            <div className="uid-display">id: {rects[0].uid}</div>

            <div className="section-title">Ayah</div>
            <NumInput label="Surah" value={rects[0].surah} min={1} max={114}
              onChange={(v) => onUpdate({ surah: v })} />
            <NumInput label="Ayah"  value={rects[0].ayah}  min={0}
              onChange={(v) => onUpdate({ ayah: v })} />

            <div className="section-title" style={{ marginTop: 10 }}>Coordinates</div>
            <NumInput label="x" value={rects[0].x} min={0} onChange={(v) => onUpdate({ x: v })} />
            <NumInput label="y" value={rects[0].y} min={0} onChange={(v) => onUpdate({ y: v })} />
            <NumInput label="w" value={rects[0].w} min={1} onChange={(v) => onUpdate({ w: v })} />
            <NumInput label="h" value={rects[0].h} min={1} onChange={(v) => onUpdate({ h: v })} />

            <div className="btn-row">
              <button className="action-btn dup-btn" onClick={onDuplicate}>Duplicate</button>
              <button className="action-btn del-btn"  onClick={onDelete}>Delete</button>
            </div>
          </>
        )}

        {count > 1 && (
          <>
            <div className="multi-select-badge">{count} boxes selected</div>

            <div className="section-title">Ayah — applies to all</div>
            <NumInput label="Surah" value={fieldVal("surah") ?? 0} mixed={isMixed("surah")}
              min={1} max={114} onChange={(v) => onUpdate({ surah: v })} />
            <NumInput label="Ayah"  value={fieldVal("ayah") ?? 0}  mixed={isMixed("ayah")}
              min={0} onChange={(v) => onUpdate({ ayah: v })} />

            <div className="section-title" style={{ marginTop: 10 }}>Coordinates — applies to all</div>
            <NumInput label="x" value={fieldVal("x") ?? 0} mixed={isMixed("x")} min={0} onChange={(v) => onUpdate({ x: v })} />
            <NumInput label="y" value={fieldVal("y") ?? 0} mixed={isMixed("y")} min={0} onChange={(v) => onUpdate({ y: v })} />
            <NumInput label="w" value={fieldVal("w") ?? 0} mixed={isMixed("w")} min={1} onChange={(v) => onUpdate({ w: v })} />
            <NumInput label="h" value={fieldVal("h") ?? 0} mixed={isMixed("h")} min={1} onChange={(v) => onUpdate({ h: v })} />

            <div className="btn-row">
              <button className="action-btn dup-btn" onClick={onDuplicate}>Dup {count}</button>
              <button className="action-btn del-btn"  onClick={onDelete}>Del {count}</button>
            </div>
          </>
        )}
      </div>

      <div className="panel-footer">
        <button className="preview-btn" onClick={onPreview}>Preview JSON</button>
        <button className="export-btn"  onClick={onExport}>Export JSON</button>
        <button className="clear-btn"
          onClick={() => { if (window.confirm("Clear all boxes on this page?")) onClearAll(); }}>
          Clear All
        </button>
      </div>
    </aside>
  );
}
