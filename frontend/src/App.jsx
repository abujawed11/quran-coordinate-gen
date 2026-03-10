import { useEffect, useRef, useState } from "react";
import "./App.css";

import DrawingCanvas from "./components/DrawingCanvas";
import EditorPanel   from "./components/EditorPanel";
import LeftSidebar   from "./components/LeftSidebar";
import { exportGroupedJSON, downloadJSON, nextUid, bumpUidCounter } from "./utils/rectUtils";
import { savePageData, loadPageData, getSavedPageNumbers, saveGuideSnapshot, loadGuideSnapshot } from "./utils/storageUtils";

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

  const handleExport = () => {
    const data = exportGroupedJSON(rectangles, {
      scale:          imageInfo ? { x: imageInfo.scaleX, y: imageInfo.scaleY } : { x: 1, y: 1 },
      page:           pageNumber,
      originalWidth:  imageInfo?.originalWidth  ?? null,
      originalHeight: imageInfo?.originalHeight ?? null,
    });
    downloadJSON(data, `page-${String(pageNumber).padStart(3, "0")}.json`);
  };

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
        onClearAll={handleClearAll}
      />
    </div>
  );
}
