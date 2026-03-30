import { useEffect, useRef, useState } from "react";

// ─── GuideList ─────────────────────────────────────────────────────────────────
// React's synthetic onWheel is passive — e.preventDefault() is silently ignored.
// We attach a native non-passive listener so scroll-to-nudge works correctly.

function GuideList({ axis, guides, onAdd, onRemove, onAdjust, color, placeholder, locked }) {
  const [input, setInput]   = useState("");
  const listRef             = useRef(null);
  const guidesRef           = useRef(guides);
  const onAdjustRef         = useRef(onAdjust);
  const lockedRef           = useRef(locked);
  guidesRef.current         = guides;
  onAdjustRef.current       = onAdjust;
  lockedRef.current         = locked;

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const onWheel = (e) => {
      const item = e.target.closest("[data-guide-index]");
      if (!item) return;
      e.preventDefault();
      if (lockedRef.current) return;
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
          disabled={locked}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !locked && handleAdd()}
        />
        <button className="add-btn" onClick={handleAdd} disabled={locked}>Add</button>
      </div>
      <div className="guide-list" ref={listRef}>
        {guides.length === 0 && <span className="muted">No guides yet.</span>}
        {guides.map((val, i) => (
          <div key={i} className="guide-item" data-guide-index={i}
            title={locked ? "Panel is locked" : "Scroll to nudge · Shift+scroll ×10"}>
            <span className="guide-num">{i + 1}</span>
            <span className="guide-dot" style={{ background: color }} />
            <span className="guide-val">{axis} = {val}</span>
            <button className="guide-remove" disabled={locked} onClick={() => onRemove(axis, i)} title="Remove">×</button>
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
  onSplitBox,
  splitEnabled,
  onCopyBoxesFromPage,
  savedLayouts,
  onSaveLayout,
  onLoadLayout,
  onDeleteLayout,
  onExportSettings,
  onImportSettings,
}) {
  const importFileRef = useRef(null);
  const [locked, setLocked] = useState(false);
  const [layoutName, setLayoutName] = useState("");
  const [splitLeftPct, setSplitLeftPct] = useState(50);
  const [copyBoxesFromPage, setCopyBoxesFromPage] = useState(
    pageNumber > 1 ? pageNumber - 1 : 1
  );

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
      <div className="sidebar-header">
        <h1>Quran Coords</h1>
        <button
          className={`lock-btn ${locked ? "lock-btn--on" : ""}`}
          title={locked ? "Unlock sidebar" : "Lock sidebar (prevent accidental edits)"}
          onClick={() => setLocked((v) => !v)}
        >
          {locked ? "🔒" : "🔓"}
        </button>
      </div>

      {/* ── Page navigation ── */}
      <div className="sidebar-section">
        <div className="control-group">
          <label>Page (1 – 610)</label>
          <input
            type="number" min="1" max="610"
            value={pageNumber}
            disabled={locked}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (n >= 1 && n <= 610) onPageChange(n);
            }}
          />
        </div>
        <div className="page-nav-row">
          <button className="page-nav-btn" 
          // disabled={locked || pageNumber <= 1}
            onClick={() => onPageChange(pageNumber - 1)}>← Prev</button>
          <span className="page-nav-label">{pageNumber} / 610</span>
          <button className="page-nav-btn" 
          // disabled={locked || pageNumber >= 610}
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
            disabled={locked}
            onChange={() => toggle("fixedHeight")} />
          Fixed Height
        </label>

        {drawSettings.fixedHeight && (
          <div className="control-group indent">
            <label>Height (px)</label>
            <input
              type="number" min="10" max="500"
              value={drawSettings.fixedHeightValue}
              disabled={locked}
              onChange={(e) =>
                onDrawSettingsChange({ ...drawSettings, fixedHeightValue: Number(e.target.value) || 61 })
              }
            />
          </div>
        )}

        <label className="toggle-label">
          <input type="checkbox" checked={drawSettings.snapToLines}
            disabled={locked}
            onChange={() => toggle("snapToLines")} />
          Snap to Lines
        </label>

        <label className="toggle-label">
          <input type="checkbox" checked={drawSettings.showGuides}
            disabled={locked}
            onChange={() => toggle("showGuides")} />
          Show Guides
        </label>
      </div>

      {/* ── Split box ── */}
      <div className="sidebar-section">
        <div className="section-title">Split Box</div>
        <div className="control-group">
          <label>Left / Right %</label>
          <div className="split-ratio-row">
            <input
              type="number" min="1" max="99"
              value={splitLeftPct}
              disabled={locked}
              onChange={(e) => {
                const n = Math.min(99, Math.max(1, Number(e.target.value)));
                setSplitLeftPct(n);
              }}
            />
            <span className="split-ratio-preview">{splitLeftPct} / {100 - splitLeftPct}</span>
          </div>
        </div>
        <button
          className="gen-btn"
          onClick={() => onSplitBox(splitLeftPct)}
          disabled={locked || !splitEnabled}
          title={locked ? "Panel is locked" : splitEnabled ? "Split selected box into two" : "Select exactly one box to split"}
        >
          Split Box
        </button>
        {!splitEnabled && <p className="gen-note">Select exactly 1 box to enable.</p>}
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
            disabled={locked}
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
            disabled={locked}
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
            disabled={locked}
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
          disabled={locked || !imageInfo}
          title={locked ? "Panel is locked" : !imageInfo ? "Wait for image to load" : "Replace Y guides with 15 auto-generated lines"}
        >
          ⚡ Generate 15 Guides
        </button>

        <div className="copy-guides-row">
          <input
            type="number" min="1" max="610"
            value={copyFromPage}
            // disabled={locked}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (n >= 1 && n <= 610) setCopyFromPage(n);
            }}
            title="Page to copy guides from"
          />
          <button
            className="gen-btn gen-btn--secondary copy-guides-btn"
            onClick={() => onCopyGuidesFromPrev(copyFromPage)}
            // disabled={locked || copyFromPage === pageNumber}
            title={`Copy Y guides from page ${copyFromPage}`}
            // title={locked ? "Panel is locked" : copyFromPage === pageNumber ? "Can't copy from the current page" : `Copy Y guides from page ${copyFromPage}`}
          >
            Copy from pg {copyFromPage}
          </button>
        </div>

        {/* ── Guide snapshot ── */}
        <div className="snapshot-row">
          <button
            className="gen-btn gen-btn--snap"
            onClick={onSaveGuideSnapshot}
            disabled={locked}
            title={locked ? "Panel is locked" : "Save current guides as a restore point for this page"}
          >
            Save Guides
          </button>
          <button
            className="gen-btn gen-btn--snap-restore"
            onClick={onRestoreGuideSnapshot}
            disabled={locked || !guideSnapshot}
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
          disabled={locked}
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
          onAdjust={onAdjustGuide} color="#38bdf8" placeholder="Y px" locked={locked} />
      </div>

      {/* ── X guides ── */}
      <div className="sidebar-section">
        <div className="section-title guide-section-title">
          <span className="guide-axis-dot" style={{ background: "#f97316" }} />
          X Guides
          <span className="guide-hint">vertical</span>
        </div>
        <GuideList axis="x" guides={xGuides} onAdd={onAddGuide} onRemove={onRemoveGuide}
          onAdjust={onAdjustGuide} color="#f97316" placeholder="X px" locked={locked} />
      </div>

      {/* ── Copy boxes from page ── */}
      <div className="sidebar-section">
        <div className="section-title">Copy Boxes</div>
        <div className="copy-guides-row">
          <input
            type="number" min="1" max="610"
            value={copyBoxesFromPage}
            disabled={locked}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (n >= 1 && n <= 610) setCopyBoxesFromPage(n);
            }}
            title="Page to copy boxes from"
          />
          <button
            className="gen-btn gen-btn--secondary copy-guides-btn"
            onClick={() => onCopyBoxesFromPage(copyBoxesFromPage)}
            disabled={locked || copyBoxesFromPage === pageNumber}
            title={
              copyBoxesFromPage === pageNumber
                ? "Can't copy from the current page"
                : `Replace current boxes with boxes from page ${copyBoxesFromPage}`
            }
          >
            Copy from pg {copyBoxesFromPage}
          </button>
        </div>
        <p className="gen-note">Replaces current page boxes with boxes from the selected page.</p>
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

      {/* ── Saved layouts ── */}
      <div className="sidebar-section">
        <div className="section-title">Saved Layouts</div>
        <div className="guide-input-row">
          <input
            type="text"
            placeholder="Layout name"
            value={layoutName}
            disabled={locked}
            onChange={(e) => setLayoutName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !locked) { onSaveLayout(layoutName); setLayoutName(""); }
            }}
          />
          <button
            className="add-btn"
            onClick={() => { onSaveLayout(layoutName); setLayoutName(""); }}
            disabled={locked || !layoutName.trim()}
            title={locked ? "Panel is locked" : "Save current boxes as a named layout"}
          >
            Save
          </button>
        </div>
        {savedLayouts.length === 0 ? (
          <span className="muted">No layouts saved yet.</span>
        ) : (
          <div className="guide-list">
            {savedLayouts.map((layout) => (
              <div key={layout.name} className="guide-item">
                <span className="guide-val" style={{ flex: 1 }}>
                  {layout.name}
                  <span className="muted" style={{ marginLeft: 4 }}>({layout.rectangles.length})</span>
                </span>
                <button
                  className="gen-btn gen-btn--secondary"
                  style={{ padding: "1px 7px", fontSize: "0.75rem" }}
                  // disabled={locked}
                  onClick={() => onLoadLayout(layout.name)}
                  title={`Load "${layout.name}" onto current page`}
                  // title={locked ? "Panel is locked" : `Load "${layout.name}" onto current page`}
                >
                  Load
                </button>
                <button
                  className="guide-remove"
                  disabled={locked}
                  onClick={() => onDeleteLayout(layout.name)}
                  title={locked ? "Panel is locked" : `Delete "${layout.name}"`}
                >×</button>
              </div>
            ))}
          </div>
        )}
        <p className="gen-note">Loading a layout replaces the current page's boxes.</p>
      </div>

      {/* ── Export / Import settings ── */}
      <div className="sidebar-section">
        <div className="section-title">Settings Backup</div>
        <button className="gen-btn" onClick={onExportSettings} disabled={locked} title={locked ? "Panel is locked" : "Download all pages, guides, and settings as a JSON file"}>
          Export All Settings
        </button>
        <button
          className="gen-btn gen-btn--secondary"
          onClick={() => importFileRef.current?.click()}
          disabled={locked}
          title={locked ? "Panel is locked" : "Restore from a previously exported settings file"}
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
