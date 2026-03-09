// ─── EditorPanel ──────────────────────────────────────────────────────────────
// Right sidebar. Shows editable fields for the selected rectangle.
// Also contains the Export JSON button.
//
// Props:
//   rect        – selected rect object { uid, surah, ayah, x, y, w, h } or null
//   onUpdate    – (changes) => void  — partial update object
//   onDelete    – () => void
//   onDuplicate – () => void
//   onExport    – () => void

export default function EditorPanel({ rect, onUpdate, onDelete, onDuplicate, onExport, onClearAll }) {
  // A single numeric field row
  const NumField = ({ label, fieldKey, min = 0, max }) => (
    <div className="control-group">
      <label>{label}</label>
      <input
        type="number"
        min={min}
        max={max}
        value={rect[fieldKey]}
        onChange={(e) => {
          const val = parseInt(e.target.value, 10);
          if (!isNaN(val)) onUpdate({ [fieldKey]: val });
        }}
      />
    </div>
  );

  return (
    <aside className="editor-panel">
      <h2>Properties</h2>

      {!rect ? (
        <p className="no-selection">Click a box to edit it.</p>
      ) : (
        <>
          <div className="uid-display">id: {rect.uid}</div>

          {/* Ayah identity */}
          <div className="section-title">Ayah</div>
          <NumField label="Surah" fieldKey="surah" min={1} max={114} />
          <NumField label="Ayah"  fieldKey="ayah"  min={1} />

          {/* Coordinates */}
          <div className="section-title" style={{ marginTop: 10 }}>Coordinates</div>
          <NumField label="x" fieldKey="x" min={0} />
          <NumField label="y" fieldKey="y" min={0} />
          <NumField label="w" fieldKey="w" min={1} />
          <NumField label="h" fieldKey="h" min={1} />

          {/* Actions */}
          <div className="btn-row">
            <button className="action-btn dup-btn" onClick={onDuplicate}>
              Duplicate
            </button>
            <button className="action-btn del-btn" onClick={onDelete}>
              Delete
            </button>
          </div>
        </>
      )}

      {/* Export + Clear — always visible at the bottom */}
      <div className="panel-footer">
        <button className="export-btn" onClick={onExport}>
          Export JSON
        </button>
        <button
          className="clear-btn"
          onClick={() => {
            if (window.confirm("Clear all boxes on this page?")) onClearAll();
          }}
        >
          Clear All
        </button>
      </div>
    </aside>
  );
}
