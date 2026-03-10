import { useEffect, useRef, useState } from "react";

// ─── GuideList ─────────────────────────────────────────────────────────────────
// Reusable guide list for either axis.
// Scroll wheel on a guide item nudges its value ±1 (±10 with Shift).
//
// WHY useEffect + native listener instead of React onWheel:
// Browsers mark React's synthetic wheel events as "passive" by default, which
// means e.preventDefault() is silently ignored and the sidebar scrolls instead
// of the guide value changing. Attaching the listener manually with
// { passive: false } restores the expected behaviour.

function GuideList({ axis, guides, onAdd, onRemove, onAdjust, color, placeholder }) {
  const [input, setInput] = useState("");
  const listRef    = useRef(null);

  // Keep refs so the wheel handler always reads the latest values without
  // needing to be re-registered on every render.
  const guidesRef  = useRef(guides);
  const onAdjustRef = useRef(onAdjust);
  guidesRef.current   = guides;
  onAdjustRef.current = onAdjust;

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;

    const handleWheel = (e) => {
      // Walk up from the actual target to find a [data-guide-index] element
      const item = e.target.closest("[data-guide-index]");
      if (!item) return;

      e.preventDefault(); // works because listener is non-passive
      const i    = parseInt(item.dataset.guideIndex, 10);
      const cur  = guidesRef.current[i];
      if (cur === undefined) return;

      const step  = e.shiftKey ? 10 : 1;
      const delta = e.deltaY < 0 ? step : -step; // scroll-up → increase
      onAdjustRef.current(axis, i, Math.max(0, cur + delta));
    };

    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, [axis]); // axis never changes per instance; stable enough

  const handleAdd = () => {
    const val = parseInt(input, 10);
    if (!isNaN(val) && val >= 0) {
      onAdd(axis, val);
      setInput("");
    }
  };

  return (
    <>
      <div className="guide-input-row">
        <input
          type="number"
          placeholder={placeholder}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
        />
        <button className="add-btn" onClick={handleAdd}>Add</button>
      </div>

      <div className="guide-list" ref={listRef}>
        {guides.length === 0 && <span className="muted">No guides yet.</span>}
        {guides.map((val, i) => (
          <div
            key={i}
            className="guide-item"
            data-guide-index={i}
            title="Scroll to nudge · Shift+scroll ×10"
          >
            <span className="guide-dot" style={{ background: color }} />
            <span className="guide-val">{axis} = {val}</span>
            <button
              className="guide-remove"
              onClick={() => onRemove(axis, i)}
              title="Remove"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </>
  );
}

// ─── LeftSidebar ───────────────────────────────────────────────────────────────

export default function LeftSidebar({
  pageNumber,
  onPageChange,
  drawSettings,
  onDrawSettingsChange,
  yGuides,
  xGuides,
  onAddGuide,
  onRemoveGuide,
  onAdjustGuide,
  boxCount,
}) {
  const toggle = (key) =>
    onDrawSettingsChange({ ...drawSettings, [key]: !drawSettings[key] });

  return (
    <aside className="sidebar">
      <h1>Quran Coords</h1>

      {/* Page */}
      <div className="sidebar-section">
        <div className="control-group">
          <label>Page</label>
          <input
            type="number" min="1" max="610"
            value={pageNumber}
            onChange={(e) => onPageChange(Number(e.target.value) || 1)}
          />
        </div>
      </div>

      {/* Drawing mode */}
      <div className="sidebar-section">
        <div className="section-title">Drawing</div>

        <label className="toggle-label">
          <input type="checkbox" checked={drawSettings.fixedHeight}
            onChange={() => toggle("fixedHeight")} />
          Fixed Height
        </label>

        {drawSettings.fixedHeight && (
          <div className="control-group indent">
            <label>Height (px)</label>
            <input
              type="number" min="10" max="500"
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
          <input type="checkbox" checked={drawSettings.snapToLines}
            onChange={() => toggle("snapToLines")} />
          Snap to Lines
        </label>

        <label className="toggle-label">
          <input type="checkbox" checked={drawSettings.showGuides}
            onChange={() => toggle("showGuides")} />
          Show Guides
        </label>
      </div>

      {/* Y guides — horizontal lines */}
      <div className="sidebar-section">
        <div className="section-title guide-section-title">
          <span className="guide-axis-dot" style={{ background: "#38bdf8" }} />
          Y Guides
          <span className="guide-hint">horizontal</span>
        </div>
        <GuideList
          axis="y"
          guides={yGuides}
          onAdd={onAddGuide}
          onRemove={onRemoveGuide}
          onAdjust={onAdjustGuide}
          color="#38bdf8"
          placeholder="Y px"
        />
      </div>

      {/* X guides — vertical lines */}
      <div className="sidebar-section">
        <div className="section-title guide-section-title">
          <span className="guide-axis-dot" style={{ background: "#f97316" }} />
          X Guides
          <span className="guide-hint">vertical</span>
        </div>
        <GuideList
          axis="x"
          guides={xGuides}
          onAdd={onAddGuide}
          onRemove={onRemoveGuide}
          onAdjust={onAdjustGuide}
          color="#f97316"
          placeholder="X px"
        />
      </div>

      <div className="box-count">
        {boxCount} box{boxCount !== 1 ? "es" : ""}
      </div>
    </aside>
  );
}
