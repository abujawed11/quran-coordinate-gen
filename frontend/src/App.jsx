import { useMemo, useState } from "react";
import "./App.css";
import { Stage, Layer, Image as KonvaImage, Rect } from "react-konva";
import useImage from "use-image";

function PageImage({ src, width }) {
  const [image] = useImage(src);

  const [rectangles, setRectangles] = useState([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [newRect, setNewRect] = useState(null);

  const dimensions = useMemo(() => {
    if (!image) return { width: 0, height: 0, scale: 1 };

    const scale = width / image.width;

    return {
      width,
      height: image.height * scale,
      scale,
    };
  }, [image, width]);

  if (!image) return <div className="image-loading">Loading image...</div>;

  const handleMouseDown = (e) => {
    const pos = e.target.getStage().getPointerPosition();

    setIsDrawing(true);

    setNewRect({
      x: pos.x,
      y: pos.y,
      width: 0,
      height: 0,
    });
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

    setRectangles((prev) => [...prev, newRect]);

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
        <KonvaImage
          image={image}
          width={dimensions.width}
          height={dimensions.height}
        />

        {/* Existing rectangles */}
        {rectangles.map((rect, i) => (
          <Rect
            key={i}
            x={rect.x}
            y={rect.y}
            width={rect.width}
            height={rect.height}
            stroke="red"
            strokeWidth={2}
          />
        ))}

        {/* Currently drawing rectangle */}
        {newRect && (
          <Rect
            x={newRect.x}
            y={newRect.y}
            width={newRect.width}
            height={newRect.height}
            stroke="blue"
            strokeWidth={2}
          />
        )}
      </Layer>
    </Stage>
  );
}

export default function App() {
  const [pageNumber, setPageNumber] = useState(1);

  const pageImageSrc = `/pages/${String(pageNumber).padStart(3, "0")}.png`;

  return (
    <div className="app-shell">
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

        <p>Draw rectangles by dragging the mouse.</p>
      </aside>

      <main className="canvas-area">
        <div className="canvas-wrapper">
          <PageImage src={pageImageSrc} width={900} />
        </div>
      </main>
    </div>
  );
}