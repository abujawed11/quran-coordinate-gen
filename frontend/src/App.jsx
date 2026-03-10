import { useRef, useState } from "react";
import "./App.css";

import DrawingCanvas from "./components/DrawingCanvas";
import EditorPanel   from "./components/EditorPanel";
import LeftSidebar   from "./components/LeftSidebar";
import { exportGroupedJSON, downloadJSON, nextUid } from "./utils/rectUtils";

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

  // Guides — Y = horizontal lines, X = vertical lines
  const [yGuides, setYGuides] = useState([]);
  const [xGuides, setXGuides] = useState([]);

  // Image scale info — populated by DrawingCanvas when each page image loads.
  // { originalWidth, originalHeight, displayWidth, displayHeight, scaleX, scaleY }
  const [imageInfo, setImageInfo] = useState(null);

  const [lastLabel, setLastLabel] = useState({ surah: 1, ayah: 1 });

  const pageImageSrc  = `/pages/${String(pageNumber).padStart(3, "0")}.png`;
  const selectedRect  = rectangles.find((r) => r.uid === selectedId) ?? null;

  // Clear stale image info whenever the page changes; it will be re-populated
  // as soon as DrawingCanvas fires onImageLoad for the new image.
  const prevPageRef = useRef(pageNumber);
  if (prevPageRef.current !== pageNumber) {
    prevPageRef.current = pageNumber;
    setImageInfo(null);
  }

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

  const handleRectMove = (uid, { x, y }) => {
    setRectangles((prev) =>
      prev.map((r) => (r.uid === uid ? { ...r, x, y } : r))
    );
  };

  // Called by resize handles — changes may include any subset of { x, y, w, h }
  const handleRectResize = (uid, changes) => {
    setRectangles((prev) =>
      prev.map((r) => (r.uid === uid ? { ...r, ...changes } : r))
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
      y: selectedRect.y + selectedRect.h + 4,
    };
    setRectangles((prev) => [...prev, dup]);
    setSelectedId(dup.uid);
  };

  const handleClearAll = () => {
    setRectangles([]);
    setSelectedId(null);
  };

  // ── export ───────────────────────────────────────────────────────────────────
  // Rectangles are stored in display-canvas coordinates.
  // Convert to original-image coordinates using imageInfo.scaleX/Y on export.

  const handleExport = () => {
    const scale = imageInfo
      ? { x: imageInfo.scaleX, y: imageInfo.scaleY }
      : { x: 1, y: 1 };
    const grouped = exportGroupedJSON(rectangles, scale);
    downloadJSON(grouped, `page-${String(pageNumber).padStart(3, "0")}.json`);
  };

  // ── guides ───────────────────────────────────────────────────────────────────

  // Add a new guide (called from sidebar)
  const handleAddGuide = (axis, val) => {
    const setter = axis === "y" ? setYGuides : setXGuides;
    setter((prev) => [...prev, val].sort((a, b) => a - b));
  };

  // Remove guide by index
  const handleRemoveGuide = (axis, index) => {
    const setter = axis === "y" ? setYGuides : setXGuides;
    setter((prev) => prev.filter((_, i) => i !== index));
  };

  // Adjust guide value in-place (used by: scroll wheel in sidebar, drag on canvas)
  const handleAdjustGuide = (axis, index, newVal) => {
    const setter = axis === "y" ? setYGuides : setXGuides;
    setter((prev) =>
      prev.map((v, i) => (i === index ? newVal : v)).sort((a, b) => a - b)
    );
  };

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div className="app-shell">
      <LeftSidebar
        pageNumber={pageNumber}
        onPageChange={setPageNumber}
        drawSettings={drawSettings}
        onDrawSettingsChange={setDrawSettings}
        yGuides={yGuides}
        xGuides={xGuides}
        onAddGuide={handleAddGuide}
        onRemoveGuide={handleRemoveGuide}
        onAdjustGuide={handleAdjustGuide}
        boxCount={rectangles.length}
        imageInfo={imageInfo}
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
