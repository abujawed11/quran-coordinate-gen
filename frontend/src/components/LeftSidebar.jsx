import { useState } from "react";

// ─── LeftSidebar ──────────────────────────────────────────────────────────────
// Controls: page number, drawing mode settings, and line guide management.
//
// Props:
//   pageNumber            – current page number
//   onPageChange          – (n) => void
//   drawSettings          – { fixedHeight, fixedHeightValue, snapToLines, showGuides }
//   onDrawSettingsChange  – (newSettings) => void
//   lineGuides            – array of Y values
//   onAddGuide            – (y) => void
//   onRemoveGuide         – (index) => void
//   boxCount              – total number of drawn boxes

export default function LeftSidebar({
  pageNumber,
  onPageChange,
  drawSettings,
  onDrawSettingsChange,
  lineGuides,
  onAddGuide,
  onRemoveGuide,
  boxCount,
}) {
  const [guideInput, setGuideInput] = useState("");

  const toggle = (key) =>
    onDrawSettingsChange({ ...drawSettings, [key]: !drawSettings[key] });

  const handleAddGuide = () => {
    const val = parseInt(guideInput, 10);
    if (!isNaN(val) && val >= 0) {
      onAddGuide(val);
      setGuideInput("");
    }
  };

  return (
    <aside className="sidebar">
      <h1>Quran Coords</h1>

      {/* Page number */}
      <div className="sidebar-section">
        <div className="control-group">
          <label>Page</label>
          <input
            type="number"
            min="1"
            max="610"
            value={pageNumber}
            onChange={(e) => onPageChange(Number(e.target.value) || 1)}
          />
        </div>
      </div>

      {/* Drawing mode */}
      <div className="sidebar-section">
        <div className="section-title">Drawing</div>

        <label className="toggle-label">
          <input
            type="checkbox"
            checked={drawSettings.fixedHeight}
            onChange={() => toggle("fixedHeight")}
          />
          Fixed Height
        </label>

        {drawSettings.fixedHeight && (
          <div className="control-group indent">
            <label>Height (px)</label>
            <input
              type="number"
              min="10"
              max="500"
              value={drawSettings.fixedHeightValue}
              onChange={(e) =>
                onDrawSettingsChange({
                  ...drawSettings,
                  fixedHeightValue: Number(e.target.value) || 61,
                })
              }
            />
          </div>
        )}

        <label className="toggle-label">
          <input
            type="checkbox"
            checked={drawSettings.snapToLines}
            onChange={() => toggle("snapToLines")}
          />
          Snap to Lines
        </label>

        <label className="toggle-label">
          <input
            type="checkbox"
            checked={drawSettings.showGuides}
            onChange={() => toggle("showGuides")}
          />
          Show Guides
        </label>
      </div>

      {/* Line guides */}
      <div className="sidebar-section">
        <div className="section-title">Line Guides</div>

        <div className="guide-input-row">
          <input
            type="number"
            placeholder="Y px"
            value={guideInput}
            onChange={(e) => setGuideInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAddGuide()}
          />
          <button className="add-btn" onClick={handleAddGuide}>
            Add
          </button>
        </div>

        <div className="guide-list">
          {lineGuides.length === 0 && (
            <span className="muted">No guides yet.</span>
          )}
          {lineGuides.map((y, i) => (
            <div key={i} className="guide-item">
              <span className="guide-y">y = {y}</span>
              <button
                className="guide-remove"
                onClick={() => onRemoveGuide(i)}
                title="Remove guide"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="box-count">
        {boxCount} box{boxCount !== 1 ? "es" : ""}
      </div>
    </aside>
  );
}
