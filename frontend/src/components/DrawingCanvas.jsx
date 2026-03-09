import { useMemo, useState } from "react";
import { Stage, Layer, Image as KonvaImage, Rect, Text, Line, Group } from "react-konva";
import useImage from "use-image";
import { normalizeRect, snapToNearestGuide, nextUid } from "../utils/rectUtils";

const SNAP_THRESHOLD = 14; // px — pull-in radius while dragging

// ─── DrawingCanvas ────────────────────────────────────────────────────────────
// Renders the Konva stage: background image, line guides, saved rectangles,
// and the in-progress draft rectangle while the user is drawing.
//
// Props:
//   src            – image URL
//   width          – display width in px (height is computed from aspect ratio)
//   rectangles     – saved rect array [{ uid, surah, ayah, x, y, w, h }]
//   selectedId     – uid of currently selected rect (or null)
//   drawSettings   – { fixedHeight, fixedHeightValue, snapToLines, showGuides }
//   lineGuides     – array of Y positions for horizontal guide lines
//   onRectCreate   – (rect) => void  called with normalized rect (no uid metadata yet)
//   onRectSelect   – (uid | null) => void
//   onRectMove     – (uid, { x, y }) => void  called after a drag ends

export default function DrawingCanvas({
  src,
  width,
  rectangles,
  selectedId,
  drawSettings,
  lineGuides,
  onRectCreate,
  onRectSelect,
  onRectMove,
}) {
  const [image] = useImage(src);
  const [isDrawing, setIsDrawing] = useState(false);
  // draft stores the raw (possibly negative w/h) in-progress rect
  const [draft, setDraft] = useState(null);
  // Y value of the guide currently being snapped to during drag (null = none)
  const [activeGuideY, setActiveGuideY] = useState(null);

  const dimensions = useMemo(() => {
    if (!image) return { width: 0, height: 0, scale: 1 };
    const scale = width / image.width;
    return { width, height: image.height * scale, scale };
  }, [image, width]);

  if (!image) return <div className="image-loading">Loading image…</div>;

  // Apply snap to a Y value if snap mode is enabled
  const applySnap = (y) => {
    if (drawSettings.snapToLines && lineGuides.length > 0) {
      return snapToNearestGuide(y, lineGuides);
    }
    return y;
  };

  const handleMouseDown = (e) => {
    // Clicking an existing Rect triggers its own onClick; don't also start drawing
    if (e.target.getClassName() === "Rect") return;

    const pos = e.target.getStage().getPointerPosition();
    const snappedY = applySnap(pos.y);

    setIsDrawing(true);
    setDraft({ x: pos.x, y: snappedY, w: 0, h: 0 });
    onRectSelect(null); // deselect on new draw
  };

  const handleMouseMove = (e) => {
    if (!isDrawing || !draft) return;
    const pos = e.target.getStage().getPointerPosition();
    setDraft((prev) => ({
      ...prev,
      w: pos.x - prev.x,
      // In fixed-height mode the vertical drag is ignored
      h: drawSettings.fixedHeight ? drawSettings.fixedHeightValue : pos.y - prev.y,
    }));
  };

  const handleMouseUp = () => {
    if (!isDrawing || !draft) return;
    setIsDrawing(false);

    const norm = normalizeRect(draft.x, draft.y, draft.w, draft.h);

    // Discard accidental tiny clicks
    if (norm.w > 5 && norm.h > 5) {
      onRectCreate({ uid: nextUid(), ...norm });
    }
    setDraft(null);
  };

  // Normalize draft for display (handles negative w/h during left-drag)
  const draftDisplay = draft ? normalizeRect(draft.x, draft.y, draft.w, draft.h) : null;

  return (
    <Stage
      width={dimensions.width}
      height={dimensions.height}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      <Layer>
        {/* Background image */}
        <KonvaImage image={image} width={dimensions.width} height={dimensions.height} />

        {/* Horizontal line guides */}
        {drawSettings.showGuides &&
          lineGuides.map((yPos, i) => {
            const isActive = yPos === activeGuideY;
            return (
              <Line
                key={i}
                points={[0, yPos, dimensions.width, yPos]}
                stroke={isActive ? "#ffffff" : "#38bdf8"}
                strokeWidth={isActive ? 2 : 1}
                dash={isActive ? [] : [10, 5]}
                opacity={isActive ? 1 : 0.6}
                listening={false}
              />
            );
          })}

        {/* Saved rectangles — each is a draggable Group so label moves with box */}
        {rectangles.map((rect) => {
          const isSelected = rect.uid === selectedId;
          const color = isSelected ? "#facc15" : "#ef4444";

          // Called on every drag frame. Snaps Y to the nearest guide when close enough.
          const dragBoundFunc = (pos) => {
            if (!lineGuides.length) return pos;
            for (const guideY of lineGuides) {
              if (Math.abs(pos.y - guideY) <= SNAP_THRESHOLD) {
                return { x: pos.x, y: guideY };
              }
            }
            return pos;
          };

          return (
            <Group
              key={rect.uid}
              x={rect.x}
              y={rect.y}
              draggable
              dragBoundFunc={dragBoundFunc}
              onDragStart={() => onRectSelect(rect.uid)}
              onDragMove={(e) => {
                // Highlight the guide we're currently snapped to
                const y = e.target.y();
                const snapped = lineGuides.find((g) => Math.abs(y - g) <= 2) ?? null;
                setActiveGuideY(snapped);
              }}
              onDragEnd={(e) => {
                setActiveGuideY(null);
                onRectMove(rect.uid, {
                  x: Math.round(e.target.x()),
                  y: Math.round(e.target.y()),
                });
              }}
              onClick={() => onRectSelect(rect.uid)}
            >
              {/* Label sits above the box; x/y are relative to the group */}
              <Text
                x={2}
                y={-15}
                text={`${rect.surah}:${rect.ayah}`}
                fontSize={11}
                fontStyle="bold"
                fill={color}
                listening={false}
              />
              <Rect
                x={0}
                y={0}
                width={rect.w}
                height={rect.h}
                stroke={color}
                strokeWidth={isSelected ? 3 : 2}
              />
            </Group>
          );
        })}

        {/* In-progress draft */}
        {draftDisplay && (
          <Rect
            x={draftDisplay.x}
            y={draftDisplay.y}
            width={draftDisplay.w}
            height={draftDisplay.h}
            stroke="#60a5fa"
            strokeWidth={2}
            dash={[6, 3]}
            listening={false}
          />
        )}
      </Layer>
    </Stage>
  );
}
