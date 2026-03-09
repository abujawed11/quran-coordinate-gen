import { useState } from "react";
import "./App.css";

import DrawingCanvas from "./components/DrawingCanvas";
import EditorPanel   from "./components/EditorPanel";
import LeftSidebar   from "./components/LeftSidebar";
import { exportGroupedJSON, downloadJSON, nextUid } from "./utils/rectUtils";

// ─── Default drawing settings ─────────────────────────────────────────────────
const DEFAULT_DRAW_SETTINGS = {
  fixedHeight:      true,   // use a fixed box height instead of free drag
  fixedHeightValue: 61,     // default line height in px (canvas coords)
  snapToLines:      false,  // snap the box's Y to the nearest line guide
  showGuides:       true,   // render guide lines on the canvas
};

// ─── App ──────────────────────────────────────────────────────────────────────
// Owns all state. Passes focused slices down to each child.
//
// Rectangle data shape:
//   { uid, surah, ayah, x, y, w, h }
//
// All coordinates are canvas-space integers.
// Original-image conversion (divide by scale) can be added in exportGroupedJSON
// or as a post-processing step when the image dimensions are known.

export default function App() {
  const [pageNumber,   setPageNumber]   = useState(1);
  const [rectangles,   setRectangles]   = useState([]);
  const [selectedId,   setSelectedId]   = useState(null);
  const [drawSettings, setDrawSettings] = useState(DEFAULT_DRAW_SETTINGS);
  const [lineGuides,   setLineGuides]   = useState([]);

  // Tracks the last-used surah/ayah so new boxes default to the same ayah.
  // This is ideal for Quran layout: draw all lines of one ayah, then increment.
  const [lastLabel, setLastLabel] = useState({ surah: 1, ayah: 1 });

  const pageImageSrc = `/pages/${String(pageNumber).padStart(3, "0")}.png`;

  const selectedRect = rectangles.find((r) => r.uid === selectedId) ?? null;

  // ── Rectangle CRUD ──────────────────────────────────────────────────────────

  const handleRectCreate = (rect) => {
    // Attach the current label defaults; user can edit after drawing
    const newRect = { ...rect, surah: lastLabel.surah, ayah: lastLabel.ayah };
    setRectangles((prev) => [...prev, newRect]);
    setSelectedId(newRect.uid);
  };

  const handleRectUpdate = (changes) => {
    setRectangles((prev) =>
      prev.map((r) => (r.uid === selectedId ? { ...r, ...changes } : r))
    );
    // Mirror surah/ayah changes into lastLabel so the next drawn box inherits them
    if (changes.surah !== undefined || changes.ayah !== undefined) {
      setLastLabel((prev) => ({ ...prev, ...changes }));
    }
  };

  const handleRectMove = (uid, { x, y }) => {
    setRectangles((prev) =>
      prev.map((r) => (r.uid === uid ? { ...r, x, y } : r))
    );
  };

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
      y: selectedRect.y + selectedRect.h + 4, // place just below the original
    };
    setRectangles((prev) => [...prev, dup]);
    setSelectedId(dup.uid);
  };

  const handleClearAll = () => {
    setRectangles([]);
    setSelectedId(null);
  };

  // ── Export ──────────────────────────────────────────────────────────────────

  const handleExport = () => {
    const grouped = exportGroupedJSON(rectangles);
    downloadJSON(grouped, `page-${String(pageNumber).padStart(3, "0")}.json`);
  };

  // ── Line guides ─────────────────────────────────────────────────────────────

  const handleAddGuide = (y) =>
    setLineGuides((prev) => [...prev, y].sort((a, b) => a - b));

  const handleRemoveGuide = (i) =>
    setLineGuides((prev) => prev.filter((_, idx) => idx !== i));

  // ────────────────────────────────────────────────────────────────────────────

  return (
    <div className="app-shell">
      {/* Left: page controls + drawing settings + guide manager */}
      <LeftSidebar
        pageNumber={pageNumber}
        onPageChange={setPageNumber}
        drawSettings={drawSettings}
        onDrawSettingsChange={setDrawSettings}
        lineGuides={lineGuides}
        onAddGuide={handleAddGuide}
        onRemoveGuide={handleRemoveGuide}
        boxCount={rectangles.length}
      />

      {/* Center: Konva canvas */}
      <main className="canvas-area">
        <div className="canvas-wrapper">
          <DrawingCanvas
            src={pageImageSrc}
            width={900}
            rectangles={rectangles}
            selectedId={selectedId}
            drawSettings={drawSettings}
            lineGuides={lineGuides}
            onRectCreate={handleRectCreate}
            onRectSelect={setSelectedId}
            onRectMove={handleRectMove}
          />
        </div>
      </main>

      {/* Right: metadata editor + export */}
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
