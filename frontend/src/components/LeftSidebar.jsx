import { useEffect, useRef, useState } from "react"; // useRef kept for GuideList wheel listener

// ─── GuideList ─────────────────────────────────────────────────────────────────
// React's synthetic onWheel is passive — e.preventDefault() is silently ignored.
// We attach a native non-passive listener so scroll-to-nudge actually works.

function GuideList({ axis, guides, onAdd, onRemove, onAdjust, color, placeholder }) {
  const [input, setInput] = useState("");
  const listRef     = useRef(null);
  const guidesRef   = useRef(guides);
  const onAdjustRef = useRef(onAdjust);
  guidesRef.current   = guides;
  onAdjustRef.current = onAdjust;

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const onWheel = (e) => {
      const item = e.target.closest("[data-guide-index]");
      if (!item) return;
      e.preventDefault();
      const i   = parseInt(item.dataset.guideIndex, 10);
      const cur = guidesRef.current[i];
      if (cur === undefined) return;
      const step  = e.shiftKey ? 10 : 1;
      const delta = e.deltaY < 0 ? step : -step;
      onAdjustRef.current(axis, i, Math.max(0, cur + delta));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [axis]);

  const handleAdd = () => {
    const val = parseInt(input, 10);
    if (!isNaN(val) && val >= 0) { onAdd(axis, val); setInput(""); }
  };

  return (
    <>
      <div className="guide-input-row">
        <input
          type="number" placeholder={placeholder} value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
        />
        <button className="add-btn" onClick={handleAdd}>Add</button>
      </div>
      <div className="guide-list" ref={listRef}>
        {guides.length === 0 && <span className="muted">No guides yet.</span>}
        {guides.map((val, i) => (
          <div key={i} className="guide-item" data-guide-index={i}
            title="Scroll to nudge · Shift+scroll ×10">
            <span className="guide-dot" style={{ background: color }} />
            <span className="guide-val">{axis} = {val}</span>
            <button className="guide-remove" onClick={() => onRemove(axis, i)} title="Remove">×</button>
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
  imageInfo,
  savedPages,   // sorted array of page numbers with saved data
}) {
  const toggle = (key) =>
    onDrawSettingsChange({ ...drawSettings, [key]: !drawSettings[key] });

  return (
    <aside className="sidebar">
      <h1>Quran Coords</h1>

      {/* ── Page navigation ── */}
      <div className="sidebar-section">
        <div className="control-group">
          <label>Page (1 – 610)</label>
          <input
            type="number" min="1" max="610"
            value={pageNumber}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (n >= 1 && n <= 610) onPageChange(n);
            }}
          />
        </div>
        <div className="page-nav-row">
          <button
            className="page-nav-btn"
            disabled={pageNumber <= 1}
            onClick={() => onPageChange(pageNumber - 1)}
          >
            ← Prev
          </button>
          <span className="page-nav-label">{pageNumber} / 610</span>
          <button
            className="page-nav-btn"
            disabled={pageNumber >= 610}
            onClick={() => onPageChange(pageNumber + 1)}
          >
            Next →
          </button>
        </div>
      </div>

      {/* ── Image scale info ── */}
      <div className="sidebar-section">
        <div className="section-title">Image Scale</div>
        {imageInfo ? (
          <div className="image-info">
            <div className="info-row">
              <span className="info-label">Original</span>
              <span className="info-val">{imageInfo.originalWidth} × {imageInfo.originalHeight}</span>
            </div>
            <div className="info-row">
              <span className="info-label">Display</span>
              <span className="info-val">{imageInfo.displayWidth} × {imageInfo.displayHeight}</span>
            </div>
            <div className="info-row">
              <span className="info-label">Scale</span>
              <span className="info-val">
                {imageInfo.scaleX.toFixed(2)} × {imageInfo.scaleY.toFixed(2)}
              </span>
            </div>
          </div>
        ) : (
          <span className="muted">Loading…</span>
        )}
      </div>

      {/* ── Drawing mode ── */}
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
                onDrawSettingsChange({ ...drawSettings, fixedHeightValue: Number(e.target.value) || 61 })
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

      {/* ── Y guides ── */}
      <div className="sidebar-section">
        <div className="section-title guide-section-title">
          <span className="guide-axis-dot" style={{ background: "#38bdf8" }} />
          Y Guides
          <span className="guide-hint">horizontal</span>
        </div>
        <GuideList axis="y" guides={yGuides} onAdd={onAddGuide} onRemove={onRemoveGuide}
          onAdjust={onAdjustGuide} color="#38bdf8" placeholder="Y px" />
      </div>

      {/* ── X guides ── */}
      <div className="sidebar-section">
        <div className="section-title guide-section-title">
          <span className="guide-axis-dot" style={{ background: "#f97316" }} />
          X Guides
          <span className="guide-hint">vertical</span>
        </div>
        <GuideList axis="x" guides={xGuides} onAdd={onAddGuide} onRemove={onRemoveGuide}
          onAdjust={onAdjustGuide} color="#f97316" placeholder="X px" />
      </div>

      {/* ── Saved pages quick-nav ── */}
      {savedPages.length > 0 && (
        <div className="sidebar-section">
          <div className="section-title">Saved Pages</div>
          <div className="saved-pages">
            {savedPages.map((n) => (
              <button
                key={n}
                className={`page-badge ${n === pageNumber ? "page-badge--active" : ""}`}
                onClick={() => onPageChange(n)}
                title={`Go to page ${n}`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="box-count">
        {boxCount} box{boxCount !== 1 ? "es" : ""}
      </div>
    </aside>
  );
}
