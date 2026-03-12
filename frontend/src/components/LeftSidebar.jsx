import { useEffect, useRef, useState } from "react";

// ─── GuideList ─────────────────────────────────────────────────────────────────
// React's synthetic onWheel is passive — e.preventDefault() is silently ignored.
// We attach a native non-passive listener so scroll-to-nudge works correctly.

function GuideList({ axis, guides, onAdd, onRemove, onAdjust, color, placeholder }) {
  const [input, setInput]   = useState("");
  const listRef             = useRef(null);
  const guidesRef           = useRef(guides);
  const onAdjustRef         = useRef(onAdjust);
  guidesRef.current         = guides;
  onAdjustRef.current       = onAdjust;

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
            <span className="guide-num">{i + 1}</span>
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
  savedPages,
  // Guide generation
  guideSettings,
  onGuideSettingsChange,
  onGenerateGuides,
  onCopyGuidesFromPrev,
  onResetYGuides,
  guideSnapshot,
  onSaveGuideSnapshot,
  onRestoreGuideSnapshot,
  onExportSettings,
  onImportSettings,
}) {
  const importFileRef = useRef(null);

  const toggle = (key) =>
    onDrawSettingsChange({ ...drawSettings, [key]: !drawSettings[key] });

  const isSpecialPage = pageNumber <= 2;

  const [copyFromPage, setCopyFromPage] = useState(
    pageNumber > 1 ? pageNumber - 1 : 1
  );

  // Preview: approximate display-space line height that will be generated
  const lineHeightPreview = imageInfo
    ? Math.round(
        imageInfo.displayHeight *
        (1 - guideSettings.topMarginPct / 100 - guideSettings.bottomMarginPct / 100) /
        15
      )
    : null;

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
          <button className="page-nav-btn" disabled={pageNumber <= 1}
            onClick={() => onPageChange(pageNumber - 1)}>← Prev</button>
          <span className="page-nav-label">{pageNumber} / 610</span>
          <button className="page-nav-btn" disabled={pageNumber >= 610}
            onClick={() => onPageChange(pageNumber + 1)}>Next →</button>
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

      {/* ── Guide generation ── */}
      <div className="sidebar-section">
        <div className="section-title">Guide Generation</div>

        {isSpecialPage && (
          <div className="special-page-notice">
            Pages 1–2 have a non-standard layout. Auto-generate is disabled on page load for these pages, but you can still generate manually.
          </div>
        )}

        <label className="toggle-label">
          <input
            type="checkbox"
            checked={guideSettings.autoOnLoad}
            onChange={(e) => onGuideSettingsChange({ autoOnLoad: e.target.checked })}
          />
          Auto-generate on page load
        </label>

        {guideSettings.autoOnLoad && (
          <p className="gen-note">
            {isSpecialPage
              ? "Skipped for pages 1–2 — use the button below."
              : "15 guides will be created automatically for pages without saved guides."}
          </p>
        )}

        <div className="control-group">
          <label>Top margin %</label>
          <input
            type="number" min="0" max="45" step="0.5"
            value={guideSettings.topMarginPct}
            onChange={(e) =>
              onGuideSettingsChange({ topMarginPct: parseFloat(e.target.value) || 0 })
            }
          />
        </div>

        <div className="control-group">
          <label>Bottom margin %</label>
          <input
            type="number" min="0" max="45" step="0.5"
            value={guideSettings.bottomMarginPct}
            onChange={(e) =>
              onGuideSettingsChange({ bottomMarginPct: parseFloat(e.target.value) || 0 })
            }
          />
        </div>

        {lineHeightPreview !== null && (
          <div className="guide-gen-preview">
            ~{lineHeightPreview}px spacing · {15} lines
          </div>
        )}

        <button
          className="gen-btn"
          onClick={onGenerateGuides}
          disabled={!imageInfo}
          title={!imageInfo ? "Wait for image to load" : "Replace Y guides with 15 auto-generated lines"}
        >
          ⚡ Generate 15 Guides
        </button>

        <div className="copy-guides-row">
          <input
            type="number" min="1" max="610"
            value={copyFromPage}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (n >= 1 && n <= 610) setCopyFromPage(n);
            }}
            title="Page to copy guides from"
          />
          <button
            className="gen-btn gen-btn--secondary copy-guides-btn"
            onClick={() => onCopyGuidesFromPrev(copyFromPage)}
            disabled={copyFromPage === pageNumber}
            title={copyFromPage === pageNumber ? "Can't copy from the current page" : `Copy Y guides from page ${copyFromPage}`}
          >
            Copy from pg {copyFromPage}
          </button>
        </div>

        {/* ── Guide snapshot ── */}
        <div className="snapshot-row">
          <button
            className="gen-btn gen-btn--snap"
            onClick={onSaveGuideSnapshot}
            title="Save current guides as a restore point for this page"
          >
            Save Guides
          </button>
          <button
            className="gen-btn gen-btn--snap-restore"
            onClick={onRestoreGuideSnapshot}
            disabled={!guideSnapshot}
            title={guideSnapshot
              ? `Restore guides saved at ${new Date(guideSnapshot.savedAt).toLocaleTimeString()}`
              : "No saved snapshot yet"}
          >
            Restore
          </button>
        </div>
        {guideSnapshot && (
          <div className="snapshot-info">
            Snapshot: {guideSnapshot.yGuides.length}Y + {guideSnapshot.xGuides.length}X guides
            &nbsp;·&nbsp;{new Date(guideSnapshot.savedAt).toLocaleTimeString()}
          </div>
        )}

        <button
          className="gen-btn gen-btn--danger"
          onClick={onResetYGuides}
        >
          Clear Y Guides
        </button>
      </div>

      {/* ── Y guides (manual list) ── */}
      <div className="sidebar-section">
        <div className="section-title guide-section-title">
          <span className="guide-axis-dot" style={{ background: "#38bdf8" }} />
          Y Guides
          <span className="guide-hint">horizontal · {yGuides.length}</span>
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

      {/* ── Export / Import settings ── */}
      <div className="sidebar-section">
        <div className="section-title">Settings Backup</div>
        <button className="gen-btn" onClick={onExportSettings} title="Download all pages, guides, and settings as a JSON file">
          Export All Settings
        </button>
        <button
          className="gen-btn gen-btn--secondary"
          onClick={() => importFileRef.current?.click()}
          title="Restore from a previously exported settings file"
        >
          Import Settings
        </button>
        <input
          ref={importFileRef}
          type="file"
          accept=".json,application/json"
          style={{ display: "none" }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              onImportSettings(file);
              e.target.value = "";
            }
          }}
        />
      </div>

      <div className="box-count">
        {boxCount} box{boxCount !== 1 ? "es" : ""}
      </div>
    </aside>
  );
}
