import { useEffect, useRef, useState } from "react";
import "./App.css";

import DrawingCanvas from "./components/DrawingCanvas";
import EditorPanel   from "./components/EditorPanel";
import LeftSidebar   from "./components/LeftSidebar";
import { exportGroupedJSON, downloadJSON, nextUid, bumpUidCounter } from "./utils/rectUtils";
import { savePageData, loadPageData, getSavedPageNumbers } from "./utils/storageUtils";

const DEFAULT_DRAW_SETTINGS = {
  fixedHeight:      true,
  fixedHeightValue: 61,
  snapToLines:      false,
  showGuides:       true,
};

export default function App() {
  const [pageNumber,   setPageNumber]   = useState(1);
  const [rectangles,   setRectangles]   = useState([]);
  const [selectedId,   setSelectedId]   = useState(null);
  const [drawSettings, setDrawSettings] = useState(DEFAULT_DRAW_SETTINGS);
  const [yGuides,      setYGuides]      = useState([]);
  const [xGuides,      setXGuides]      = useState([]);
  const [lastLabel,    setLastLabel]    = useState({ surah: 1, ayah: 1 });

  // Populated by DrawingCanvas when image loads: { originalWidth, originalHeight,
  // displayWidth, displayHeight, scaleX, scaleY }
  const [imageInfo, setImageInfo] = useState(null);

  // Uploaded images: Map<pageNumber, objectURL> — in-memory only (lost on refresh)
  const [uploadedImages, setUploadedImages] = useState(() => new Map());

  // Sorted list of page numbers that have saved boxes in localStorage
  const [savedPages, setSavedPages] = useState(() => getSavedPageNumbers());

  const pageImageSrc = uploadedImages.get(pageNumber)
    ?? `/pages/${String(pageNumber).padStart(3, "0")}.png`;

  const selectedRect = rectangles.find((r) => r.uid === selectedId) ?? null;

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
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── auto-save on every data change ───────────────────────────────────────────
  // Skip the very first execution (which fires with the pre-load empty state).
  const skipFirstSave = useRef(true);
  useEffect(() => {
    if (skipFirstSave.current) { skipFirstSave.current = false; return; }
    savePageData(pageNumber, { rectangles, yGuides, xGuides });
    setSavedPages(getSavedPageNumbers());
  }, [rectangles, yGuides, xGuides, pageNumber]);

  // ── page change ──────────────────────────────────────────────────────────────
  const handlePageChange = (newPage) => {
    if (newPage === pageNumber) return;
    // Save current page explicitly before switching
    savePageData(pageNumber, { rectangles, yGuides, xGuides });

    const saved  = loadPageData(newPage);
    const rects  = saved?.rectangles ?? [];
    bumpUidCounter(Math.max(0, ...rects.map((r) => r.uid ?? 0)));

    // Batch all state updates — React renders once
    setPageNumber(newPage);
    setRectangles(rects);
    setYGuides(saved?.yGuides ?? []);
    setXGuides(saved?.xGuides ?? []);
    setSelectedId(null);
    setImageInfo(null); // will be re-populated by DrawingCanvas for the new image
  };

  // ── image upload ─────────────────────────────────────────────────────────────
  const handleImageUpload = (file) => {
    const prev = uploadedImages.get(pageNumber);
    if (prev) URL.revokeObjectURL(prev);

    const url = URL.createObjectURL(file);
    setUploadedImages((m) => { const n = new Map(m); n.set(pageNumber, url); return n; });
    setImageInfo(null); // reset so DrawingCanvas re-fires onImageLoad for new image
  };

  // ── rectangle CRUD ───────────────────────────────────────────────────────────

  const handleRectCreate = (rect) => {
    const newRect = { ...rect, surah: lastLabel.surah, ayah: lastLabel.ayah };
    setRectangles((prev) => [...prev, newRect]);
    setSelectedId(newRect.uid);
  };

  const handleRectUpdate = (changes) => {
    setRectangles((prev) =>
      prev.map((r) => (r.uid === selectedId ? { ...r, ...changes } : r))
    );
    if (changes.surah !== undefined || changes.ayah !== undefined) {
      setLastLabel((prev) => ({ ...prev, ...changes }));
    }
  };

  const handleRectMove = (uid, { x, y }) =>
    setRectangles((prev) => prev.map((r) => (r.uid === uid ? { ...r, x, y } : r)));

  const handleRectResize = (uid, changes) =>
    setRectangles((prev) => prev.map((r) => (r.uid === uid ? { ...r, ...changes } : r)));

  const handleRectDelete = () => {
    setRectangles((prev) => prev.filter((r) => r.uid !== selectedId));
    setSelectedId(null);
  };

  const handleRectDuplicate = () => {
    if (!selectedRect) return;
    const dup = {
      ...selectedRect,
      uid: nextUid(),
      x: selectedRect.x + 10,
      y: selectedRect.y + selectedRect.h + 4,
    };
    setRectangles((prev) => [...prev, dup]);
    setSelectedId(dup.uid);
  };

  const handleClearAll = () => { setRectangles([]); setSelectedId(null); };

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

  // ── guides ───────────────────────────────────────────────────────────────────

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
        onImageUpload={handleImageUpload}
      />

      <main className="canvas-area">
        <div className="canvas-wrapper">
          <DrawingCanvas
            src={pageImageSrc}
            width={900}
            rectangles={rectangles}
            selectedId={selectedId}
            drawSettings={drawSettings}
            yGuides={yGuides}
            xGuides={xGuides}
            onRectCreate={handleRectCreate}
            onRectSelect={setSelectedId}
            onRectMove={handleRectMove}
            onRectResize={handleRectResize}
            onGuideMove={handleAdjustGuide}
            onImageLoad={setImageInfo}
          />
        </div>
      </main>

      <EditorPanel
        rect={selectedRect}
        onUpdate={handleRectUpdate}
        onDelete={handleRectDelete}
        onDuplicate={handleRectDuplicate}
        onExport={handleExport}
        onClearAll={handleClearAll}
      />
    </div>
  );
}
