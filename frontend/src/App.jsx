import { Fragment, useMemo, useState } from "react";
import "./App.css";
import { Stage, Layer, Image as KonvaImage, Rect, Text } from "react-konva";
import useImage from "use-image";

// Simple incrementing UID — stable across re-renders
let _uidCounter = 1;
function nextUid() {
  return _uidCounter++;
}

// ─── PageImage ────────────────────────────────────────────────────────────────
// Renders the Konva stage + image + all rectangles with labels.
// Rectangle state lives in App; this component only handles drawing interaction.

function PageImage({ src, width, rectangles, selectedId, onRectCreate, onRectSelect }) {
  const [image] = useImage(src);
  const [isDrawing, setIsDrawing] = useState(false);
  const [newRect, setNewRect] = useState(null);

  const dimensions = useMemo(() => {
    if (!image) return { width: 0, height: 0, scale: 1 };
    const scale = width / image.width;
    return { width, height: image.height * scale, scale };
  }, [image, width]);

  if (!image) return <div className="image-loading">Loading image...</div>;

  const handleMouseDown = (e) => {
    // Don't start drawing if the user clicked an existing rectangle
    if (e.target.getClassName() === "Rect") return;

    const pos = e.target.getStage().getPointerPosition();
    setIsDrawing(true);
    setNewRect({ x: pos.x, y: pos.y, width: 0, height: 0 });
    onRectSelect(null); // clear selection when drawing
  };

  const handleMouseMove = (e) => {
    if (!isDrawing) return;
    const pos = e.target.getStage().getPointerPosition();
    setNewRect((prev) => ({
      ...prev,
      width: pos.x - prev.x,
      height: pos.y - prev.y,
    }));
  };

  const handleMouseUp = () => {
    if (!isDrawing) return;
    setIsDrawing(false);

    // Ignore tiny accidental clicks
    if (newRect && Math.abs(newRect.width) > 5 && Math.abs(newRect.height) > 5) {
      onRectCreate({
        uid: nextUid(),
        surah: 1,
        ayah: 1,
        word: 1,
        x: newRect.x,
        y: newRect.y,
        width: newRect.width,
        height: newRect.height,
      });
    }
    setNewRect(null);
  };

  return (
    <Stage
      width={dimensions.width}
      height={dimensions.height}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      <Layer>
        <KonvaImage image={image} width={dimensions.width} height={dimensions.height} />

        {/* Saved rectangles with labels */}
        {rectangles.map((rect) => {
          const isSelected = rect.uid === selectedId;
          const label = `${rect.surah}:${rect.ayah}:${rect.word}`;
          const color = isSelected ? "#facc15" : "#ef4444";

          return (
            <Fragment key={rect.uid}>
              <Text
                x={rect.x + 2}
                y={rect.y - 17}
                text={label}
                fontSize={12}
                fontStyle="bold"
                fill={color}
              />
              <Rect
                x={rect.x}
                y={rect.y}
                width={rect.width}
                height={rect.height}
                stroke={color}
                strokeWidth={isSelected ? 3 : 2}
                onClick={() => onRectSelect(rect.uid)}
              />
            </Fragment>
          );
        })}

        {/* In-progress rectangle while drawing */}
        {newRect && (
          <Rect
            x={newRect.x}
            y={newRect.y}
            width={newRect.width}
            height={newRect.height}
            stroke="#60a5fa"
            strokeWidth={2}
            dash={[6, 3]}
          />
        )}
      </Layer>
    </Stage>
  );
}

// ─── EditorPanel ──────────────────────────────────────────────────────────────
// Right sidebar. Shows metadata fields for the selected rectangle.

function EditorPanel({ rect, onUpdate, onDelete }) {
  if (!rect) {
    return (
      <aside className="editor-panel">
        <h2>Properties</h2>
        <p className="no-selection">Click a box to edit.</p>
      </aside>
    );
  }

  return (
    <aside className="editor-panel">
      <h2>Properties</h2>

      <div className="uid-display">UID: {rect.uid}</div>

      <div className="control-group">
        <label>Surah</label>
        <input
          type="number"
          min="1"
          max="114"
          value={rect.surah}
          onChange={(e) => onUpdate({ surah: Number(e.target.value) || 1 })}
        />
      </div>

      <div className="control-group">
        <label>Ayah</label>
        <input
          type="number"
          min="1"
          value={rect.ayah}
          onChange={(e) => onUpdate({ ayah: Number(e.target.value) || 1 })}
        />
      </div>

      <div className="control-group">
        <label>Word</label>
        <input
          type="number"
          min="1"
          value={rect.word}
          onChange={(e) => onUpdate({ word: Number(e.target.value) || 1 })}
        />
      </div>

      <div className="coord-display">
        <div className="coord-row">
          <span className="coord-label">x</span>
          <span className="coord-value">{Math.round(rect.x)}</span>
          <span className="coord-label">y</span>
          <span className="coord-value">{Math.round(rect.y)}</span>
        </div>
        <div className="coord-row">
          <span className="coord-label">w</span>
          <span className="coord-value">{Math.round(rect.width)}</span>
          <span className="coord-label">h</span>
          <span className="coord-value">{Math.round(rect.height)}</span>
        </div>
      </div>

      <button className="delete-btn" onClick={onDelete}>
        Delete Box
      </button>
    </aside>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────
// Root component. Owns all rectangle state and selection state.

export default function App() {
  const [pageNumber, setPageNumber] = useState(1);
  const [rectangles, setRectangles] = useState([]);
  const [selectedId, setSelectedId] = useState(null);

  const pageImageSrc = `/pages/${String(pageNumber).padStart(3, "0")}.png`;

  const selectedRect = rectangles.find((r) => r.uid === selectedId) ?? null;

  const handleRectCreate = (rect) => {
    setRectangles((prev) => [...prev, rect]);
    setSelectedId(rect.uid); // auto-select the newly drawn box
  };

  const handleRectUpdate = (changes) => {
    setRectangles((prev) =>
      prev.map((r) => (r.uid === selectedId ? { ...r, ...changes } : r))
    );
  };

  const handleRectDelete = () => {
    setRectangles((prev) => prev.filter((r) => r.uid !== selectedId));
    setSelectedId(null);
  };

  return (
    <div className="app-shell">
      {/* Left sidebar — page controls */}
      <aside className="sidebar">
        <h1>Quran Coordinate Generator</h1>

        <div className="control-group">
          <label>Page Number</label>
          <input
            type="number"
            min="1"
            max="610"
            value={pageNumber}
            onChange={(e) => setPageNumber(Number(e.target.value) || 1)}
          />
        </div>

        <p className="hint">Drag to draw a box. Click a box to select it.</p>

        <div className="box-count">
          {rectangles.length} box{rectangles.length !== 1 ? "es" : ""} on this page
        </div>
      </aside>

      {/* Center — Konva canvas */}
      <main className="canvas-area">
        <div className="canvas-wrapper">
          <PageImage
            src={pageImageSrc}
            width={900}
            rectangles={rectangles}
            selectedId={selectedId}
            onRectCreate={handleRectCreate}
            onRectSelect={setSelectedId}
          />
        </div>
      </main>

      {/* Right sidebar — metadata editor */}
      <EditorPanel
        rect={selectedRect}
        onUpdate={handleRectUpdate}
        onDelete={handleRectDelete}
      />
    </div>
  );
}
