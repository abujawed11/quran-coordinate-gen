import { useEffect, useRef, useState } from "react";
import "./App.css";

import DrawingCanvas from "./components/DrawingCanvas";
import EditorPanel   from "./components/EditorPanel";
import LeftSidebar   from "./components/LeftSidebar";
import { exportGroupedJSON, downloadJSON, nextUid, bumpUidCounter } from "./utils/rectUtils";
import { savePageData, loadPageData, getSavedPageNumbers, saveGuideSnapshot, loadGuideSnapshot, exportAllData, importAllData } from "./utils/storageUtils";

const DEFAULT_DRAW_SETTINGS = {
  fixedHeight:      true,
  fixedHeightValue: 81,
  snapToLines:      true,
  showGuides:       true,
};

const DEFAULT_GUIDE_SETTINGS = {
  topMarginPct:    8,     // % of displayHeight to treat as header (skip)
  bottomMarginPct: 6,     // % of displayHeight to treat as footer (skip)
  autoOnLoad:      false, // auto-generate guides when switching to a new page
};

// ── Guide generation algorithm ────────────────────────────────────────────────
// Produces 15 Y values in DISPLAY coordinates.
// Each value is the TOP edge of a text line — consistent with how box-snapping
// works (mousedown snaps the box's top-left to the nearest guide).
//
// textTop    = displayH × (topPct / 100)
// textBottom = displayH × (1 − bottomPct / 100)
// step       = (textBottom − textTop) / 15
// guideY[i]  = round(textTop + i × step)   for i = 0 … 14

export function computeLineGuides(displayH, topPct, bottomPct) {
  const textTop    = Math.round(displayH * (topPct    / 100));
  const textBottom = Math.round(displayH * (1 - bottomPct / 100));
  const step       = (textBottom - textTop) / 15;
  return Array.from({ length: 15 }, (_, i) => Math.round(textTop + i * step));
}

// ─────────────────────────────────────────────────────────────────────────────

export default function App() {
  const [pageNumber,   setPageNumber]   = useState(1);
  const [rectangles,   setRectangles]   = useState([]);
  const [selectedIds,  setSelectedIds]  = useState([]);
  const [drawSettings, setDrawSettings] = useState(DEFAULT_DRAW_SETTINGS);
  const [yGuides,      setYGuides]      = useState([]);
  const [xGuides,      setXGuides]      = useState([]);
  const [lastLabel,    setLastLabel]    = useState({ surah: 1, ayah: 1 });

  // Populated by DrawingCanvas when image loads:
  // { originalWidth, originalHeight, displayWidth, displayHeight, scaleX, scaleY }
  const [imageInfo, setImageInfo] = useState(null);

  // Guide-generation settings — persisted globally (not per page)
  const [guideSettings, setGuideSettings] = useState(() => {
    try {
      const s = localStorage.getItem("quran-guide-settings");
      return s ? { ...DEFAULT_GUIDE_SETTINGS, ...JSON.parse(s) } : DEFAULT_GUIDE_SETTINGS;
    } catch { return DEFAULT_GUIDE_SETTINGS; }
  });

  const [savedPages,      setSavedPages]      = useState(() => getSavedPageNumbers());
  // Guide snapshot for the current page — null means no snapshot saved yet
  const [guideSnapshot,   setGuideSnapshot]   = useState(() => loadGuideSnapshot(1));

  // Cross-page clipboard: survives page switches
  const clipboardRef = useRef([]);

  const pageImageSrc = `/pages/${String(pageNumber).padStart(3, "0")}.png`;
  const selectedRects = rectangles.filter((r) => selectedIds.includes(r.uid));

  // Persist guide settings whenever they change
  useEffect(() => {
    localStorage.setItem("quran-guide-settings", JSON.stringify(guideSettings));
  }, [guideSettings]);

  // ── pendingAutoGen: set before a page switch so the next onImageLoad knows ──
  // to generate guides for the incoming page.
  const pendingAutoGenRef = useRef(false);

  // ── on mount: load saved data for the initial page ───────────────────────────
  useEffect(() => {
    const saved = loadPageData(pageNumber);
    if (saved) {
      const rects = saved.rectangles ?? [];
      setRectangles(rects);
      setYGuides(saved.yGuides ?? []);
      setXGuides(saved.xGuides ?? []);
      bumpUidCounter(Math.max(0, ...rects.map((r) => r.uid ?? 0)));
    }
    // Auto-generation on initial mount is intentionally NOT triggered.
    // The user must switch pages (or click the button) to get auto-generated guides.
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── react to imageInfo update → auto-generate if flagged ────────────────────
  useEffect(() => {
    if (!imageInfo || !pendingAutoGenRef.current) return;
    pendingAutoGenRef.current = false;
    setYGuides(
      computeLineGuides(imageInfo.displayHeight, guideSettings.topMarginPct, guideSettings.bottomMarginPct)
    );
  }, [imageInfo]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── auto-save on every data change ───────────────────────────────────────────
  const skipFirstSave = useRef(true);
  useEffect(() => {
    if (skipFirstSave.current) { skipFirstSave.current = false; return; }
    savePageData(pageNumber, { rectangles, yGuides, xGuides });
    setSavedPages(getSavedPageNumbers());
  }, [rectangles, yGuides, xGuides, pageNumber]);

  // ── copy / paste (Ctrl+C / Ctrl+V) ──────────────────────────────────────────
  useEffect(() => {
    const onKeyDown = (e) => {
      // Don't fire while typing in an input/textarea
      const tag = document.activeElement?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;

      if (e.ctrlKey && e.key === "c") {
        if (selectedIds.length === 0) return;
        clipboardRef.current = rectangles.filter((r) => selectedIds.includes(r.uid));
      }

      if (e.ctrlKey && e.key === "v") {
        if (clipboardRef.current.length === 0) return;
        const pasted = clipboardRef.current.map((r) => ({
          ...r,
          uid: nextUid(),
          x: r.x + 10,
          y: r.y + 10,
        }));
        setRectangles((prev) => [...prev, ...pasted]);
        setSelectedIds(pasted.map((p) => p.uid));
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedIds, rectangles]);

  // ── page change ──────────────────────────────────────────────────────────────
  const handlePageChange = (newPage) => {
    if (newPage === pageNumber) return;
    savePageData(pageNumber, { rectangles, yGuides, xGuides });

    const saved = loadPageData(newPage);
    const rects = saved?.rectangles ?? [];
    bumpUidCounter(Math.max(0, ...rects.map((r) => r.uid ?? 0)));

    // Flag auto-generation if:
    //   • user has enabled it
    //   • destination is NOT a special page (1 or 2)
    //   • that page has no previously saved guides
    const hasNoSavedGuides = !(saved?.yGuides?.length > 0);
    pendingAutoGenRef.current =
      guideSettings.autoOnLoad && newPage > 2 && hasNoSavedGuides;

    setPageNumber(newPage);
    setRectangles(rects);
    setYGuides(saved?.yGuides ?? []);
    setXGuides(saved?.xGuides ?? []);
    setSelectedIds([]);
    setImageInfo(null);
    setGuideSnapshot(loadGuideSnapshot(newPage));
  };

  // ── guide generation handlers ─────────────────────────────────────────────────

  const handleGenerateGuides = () => {
    if (!imageInfo) return;
    setYGuides(
      computeLineGuides(imageInfo.displayHeight, guideSettings.topMarginPct, guideSettings.bottomMarginPct)
    );
  };

  // Copy Y guides from any saved page
  const handleCopyGuidesFromPrev = (sourcePage) => {
    if (sourcePage === pageNumber) return;
    const src = loadPageData(sourcePage);
    if (src?.yGuides?.length > 0) setYGuides([...src.yGuides]);
    if (src?.xGuides?.length > 0) setXGuides([...src.xGuides]);
  };

  // Copy rectangles from any saved page
  const handleCopyBoxesFromPage = (sourcePage) => {
    if (sourcePage === pageNumber) return;
    const src = loadPageData(sourcePage);
    if (!src?.rectangles?.length) return;
    const remapped = src.rectangles.map((r) => ({ ...r, uid: nextUid() }));
    setRectangles(remapped);
    setSelectedIds([]);
  };

  const handleResetYGuides = () => setYGuides([]);

  const handleSaveGuideSnapshot = () => {
    saveGuideSnapshot(pageNumber, { yGuides, xGuides });
    setGuideSnapshot({ yGuides: [...yGuides], xGuides: [...xGuides], savedAt: Date.now() });
  };

  const handleRestoreGuideSnapshot = () => {
    if (!guideSnapshot) return;
    setYGuides([...guideSnapshot.yGuides]);
    setXGuides([...guideSnapshot.xGuides]);
  };

  const handleGuideSettingsChange = (changes) =>
    setGuideSettings((prev) => ({ ...prev, ...changes }));

  // ── rectangle CRUD ───────────────────────────────────────────────────────────

  const handleRectCreate = (rect) => {
    const newRect = { ...rect, surah: lastLabel.surah, ayah: lastLabel.ayah };
    setRectangles((prev) => [...prev, newRect]);
    setSelectedIds([newRect.uid]);
  };

  const handleRectSelect = (uid, isCtrl = false) => {
    if (uid === null) { setSelectedIds([]); return; }
    if (isCtrl) {
      setSelectedIds((prev) =>
        prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid]
      );
    } else {
      setSelectedIds([uid]);
    }
  };

  const handleRectUpdate = (changes) => {
    setRectangles((prev) =>
      prev.map((r) => (selectedIds.includes(r.uid) ? { ...r, ...changes } : r))
    );
    if (changes.surah !== undefined || changes.ayah !== undefined)
      setLastLabel((prev) => ({ ...prev, ...changes }));
  };

  const handleRectMove = (uid, { x, y }) =>
    setRectangles((prev) => prev.map((r) => (r.uid === uid ? { ...r, x, y } : r)));

  const handleRectResize = (uid, changes) =>
    setRectangles((prev) => prev.map((r) => (r.uid === uid ? { ...r, ...changes } : r)));

  const handleRectDelete = () => {
    setRectangles((prev) => prev.filter((r) => !selectedIds.includes(r.uid)));
    setSelectedIds([]);
  };

  const handleRectDuplicate = () => {
    const toDup = rectangles.filter((r) => selectedIds.includes(r.uid));
    if (!toDup.length) return;
    const dups = toDup.map((r) => ({
      ...r, uid: nextUid(), x: r.x + 10, y: r.y + r.h + 4,
    }));
    setRectangles((prev) => [...prev, ...dups]);
    setSelectedIds(dups.map((d) => d.uid));
  };

  const handleClearAll = () => { setRectangles([]); setSelectedIds([]); };

  // ── export ───────────────────────────────────────────────────────────────────

  const buildExportData = () =>
    exportGroupedJSON(rectangles, {
      scale:          imageInfo ? { x: imageInfo.scaleX, y: imageInfo.scaleY } : { x: 1, y: 1 },
      page:           pageNumber,
      originalWidth:  imageInfo?.originalWidth  ?? null,
      originalHeight: imageInfo?.originalHeight ?? null,
    });

  const handleExport = () => {
    downloadJSON(buildExportData(), `page-${String(pageNumber).padStart(3, "0")}.json`);
  };

  // ── settings export / import ─────────────────────────────────────────────────

  const handleExportSettings = () => {
    const data = exportAllData();
    const date = new Date().toISOString().slice(0, 10);
    downloadJSON(data, `quran-settings-${date}.json`);
  };

  const handleImportSettings = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        importAllData(data);
        // Refresh current page state from newly imported data
        const saved = loadPageData(pageNumber);
        const rects = saved?.rectangles ?? [];
        bumpUidCounter(Math.max(0, ...rects.map((r) => r.uid ?? 0)));
        setRectangles(rects);
        setYGuides(saved?.yGuides ?? []);
        setXGuides(saved?.xGuides ?? []);
        setSelectedIds([]);
        setSavedPages(getSavedPageNumbers());
        setGuideSnapshot(loadGuideSnapshot(pageNumber));
        try {
          const gs = localStorage.getItem("quran-guide-settings");
          if (gs) setGuideSettings({ ...DEFAULT_GUIDE_SETTINGS, ...JSON.parse(gs) });
        } catch { /* ignore */ }
      } catch {
        alert("Import failed: invalid or corrupted settings file.");
      }
    };
    reader.readAsText(file);
  };

  // ── JSON preview modal ────────────────────────────────────────────────────────
  const [previewJson, setPreviewJson] = useState(null); // null = hidden

  const handlePreview = () => setPreviewJson(JSON.stringify(buildExportData(), null, 2));
  const handlePreviewClose = () => setPreviewJson(null);

  // ── manual guide editing ──────────────────────────────────────────────────────

  const handleAddGuide = (axis, val) => {
    const setter = axis === "y" ? setYGuides : setXGuides;
    setter((prev) => [...prev, val].sort((a, b) => a - b));
  };

  const handleRemoveGuide = (axis, index) => {
    const setter = axis === "y" ? setYGuides : setXGuides;
    setter((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAdjustGuide = (axis, index, newVal) => {
    const setter = axis === "y" ? setYGuides : setXGuides;
    setter((prev) => prev.map((v, i) => (i === index ? newVal : v)).sort((a, b) => a - b));
  };

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div className="app-shell">
      <LeftSidebar
        pageNumber={pageNumber}
        onPageChange={handlePageChange}
        drawSettings={drawSettings}
        onDrawSettingsChange={setDrawSettings}
        yGuides={yGuides}
        xGuides={xGuides}
        onAddGuide={handleAddGuide}
        onRemoveGuide={handleRemoveGuide}
        onAdjustGuide={handleAdjustGuide}
        boxCount={rectangles.length}
        imageInfo={imageInfo}
        savedPages={savedPages}
        guideSettings={guideSettings}
        onGuideSettingsChange={handleGuideSettingsChange}
        onGenerateGuides={handleGenerateGuides}
        onCopyGuidesFromPrev={handleCopyGuidesFromPrev}
        onResetYGuides={handleResetYGuides}
        guideSnapshot={guideSnapshot}
        onSaveGuideSnapshot={handleSaveGuideSnapshot}
        onRestoreGuideSnapshot={handleRestoreGuideSnapshot}
        onCopyBoxesFromPage={handleCopyBoxesFromPage}
        onExportSettings={handleExportSettings}
        onImportSettings={handleImportSettings}
      />

      <main className="canvas-area">
        <div className="canvas-wrapper">
          <DrawingCanvas
            src={pageImageSrc}
            width={900}
            rectangles={rectangles}
            selectedIds={selectedIds}
            drawSettings={drawSettings}
            yGuides={yGuides}
            xGuides={xGuides}
            onRectCreate={handleRectCreate}
            onRectSelect={handleRectSelect}
            onRectMove={handleRectMove}
            onRectResize={handleRectResize}
            onGuideMove={handleAdjustGuide}
            onImageLoad={setImageInfo}
          />
        </div>
      </main>

      <EditorPanel
        rects={selectedRects}
        onUpdate={handleRectUpdate}
        onDelete={handleRectDelete}
        onDuplicate={handleRectDuplicate}
        onExport={handleExport}
        onPreview={handlePreview}
        onClearAll={handleClearAll}
      />

      {previewJson !== null && (
        <div className="json-modal-overlay" onClick={handlePreviewClose}>
          <div className="json-modal" onClick={(e) => e.stopPropagation()}>
            <div className="json-modal-header">
              <span className="json-modal-title">
                JSON — page {pageNumber} &nbsp;·&nbsp; {rectangles.length} box{rectangles.length !== 1 ? "es" : ""}
              </span>
              <div className="json-modal-actions">
                <button
                  className="json-action-btn"
                  onClick={() => navigator.clipboard.writeText(previewJson)}
                  title="Copy to clipboard"
                >
                  Copy
                </button>
                <button
                  className="json-action-btn json-action-btn--primary"
                  onClick={() => { handleExport(); handlePreviewClose(); }}
                >
                  Export
                </button>
                <button className="json-modal-close" onClick={handlePreviewClose} title="Close">✕</button>
              </div>
            </div>
            <pre className="json-modal-body">{previewJson}</pre>
          </div>
        </div>
      )}
    </div>
  );
}
