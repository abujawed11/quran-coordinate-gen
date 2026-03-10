import { useEffect, useMemo, useRef, useState } from "react";
import { Stage, Layer, Image as KonvaImage, Rect, Text, Line, Group } from "react-konva";
import useImage from "use-image";
import { normalizeRect, snapToNearestGuide, nextUid } from "../utils/rectUtils";

const SNAP_THRESHOLD = 14; // px — pull-in radius while box-dragging
const RH_W  = 10;          // resize handle short side (px)
const RH_L  = 24;          // resize handle long side (px)

function setCursor(e, cursor) {
  e.target.getStage().container().style.cursor = cursor;
}

// ─── DrawingCanvas ─────────────────────────────────────────────────────────────
// Props:
//   src, width
//   rectangles, selectedId
//   drawSettings  – { fixedHeight, fixedHeightValue, snapToLines, showGuides }
//   yGuides       – horizontal guide Y values
//   xGuides       – vertical guide X values
//   onRectCreate, onRectSelect, onRectMove
//   onRectResize  – (uid, { x?, y?, w?, h? }) => void
//   onGuideMove   – (axis 'x'|'y', index, newValue) => void
//   onImageLoad   – (info) => void  fired when image resolves; info =
//                   { originalWidth, originalHeight, displayWidth, displayHeight, scaleX, scaleY }

export default function DrawingCanvas({
  src,
  width,
  rectangles,
  selectedId,
  drawSettings,
  yGuides,
  xGuides,
  onRectCreate,
  onRectSelect,
  onRectMove,
  onRectResize,
  onGuideMove,
  onImageLoad,
}) {
  const [image] = useImage(src);

  // ── drawing state ────────────────────────────────────────────────────────────
  const [isDrawing,    setIsDrawing]    = useState(false);
  const [draft,        setDraft]        = useState(null);

  // ── snap-highlight while box is dragged ──────────────────────────────────────
  const [activeGuideY, setActiveGuideY] = useState(null);

  // ── which guide line is being dragged (for highlight) ───────────────────────
  const [draggingGuide, setDraggingGuide] = useState(null); // { axis, index }

  // ── resize preview — overrides the selected rect during a handle drag ────────
  const [resizePreview, setResizePreview] = useState(null); // { uid,x,y,w,h }
  const resizeStart = useRef(null);                         // initial rect at drag-start

  // ── image dimensions ─────────────────────────────────────────────────────────
  const dimensions = useMemo(() => {
    if (!image) return { width: 0, height: 0, scale: 1 };
    const scale = width / image.width;
    return { width, height: image.height * scale, scale };
  }, [image, width]);

  // ── notify parent of original vs display dimensions whenever image changes ──
  // Must be before the early return so hook order is always consistent.
  useEffect(() => {
    if (!image || !onImageLoad) return;
    const displayW = width;
    const displayH = Math.round(image.height * (displayW / image.width));
    onImageLoad({
      originalWidth:  image.width,
      originalHeight: image.height,
      displayWidth:   displayW,
      displayHeight:  displayH,
      scaleX: image.width  / displayW,   // multiply display coord → original
      scaleY: image.height / displayH,
    });
  }, [image, width]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!image) return <div className="image-loading">Loading image…</div>;

  // ── helpers ──────────────────────────────────────────────────────────────────
  const applySnap = (y) =>
    drawSettings.snapToLines && yGuides.length
      ? snapToNearestGuide(y, yGuides)
      : y;

  // ── drawing handlers ─────────────────────────────────────────────────────────
  const handleMouseDown = (e) => {
    const cls = e.target.getClassName();
    // Don't start drawing on existing boxes, guides, or resize handles
    if (cls === "Rect" || cls === "Line" || cls === "Group") return;

    const pos = e.target.getStage().getPointerPosition();
    setIsDrawing(true);
    setDraft({ x: pos.x, y: applySnap(pos.y), w: 0, h: 0 });
    onRectSelect(null);
  };

  const handleMouseMove = (e) => {
    if (!isDrawing || !draft) return;
    const pos = e.target.getStage().getPointerPosition();
    setDraft((prev) => ({
      ...prev,
      w: pos.x - prev.x,
      h: drawSettings.fixedHeight ? drawSettings.fixedHeightValue : pos.y - prev.y,
    }));
  };

  const handleMouseUp = () => {
    if (!isDrawing || !draft) return;
    setIsDrawing(false);
    const norm = normalizeRect(draft.x, draft.y, draft.w, draft.h);
    if (norm.w > 5 && norm.h > 5) onRectCreate({ uid: nextUid(), ...norm });
    setDraft(null);
  };

  const draftDisplay = draft ? normalizeRect(draft.x, draft.y, draft.w, draft.h) : null;

  // ── resize handle logic ──────────────────────────────────────────────────────
  // All handle coordinates are in Layer (= absolute canvas) space because
  // the handle Rects are direct Layer children, not inside any Group.

  const startResize = (rect, which) => {
    resizeStart.current = { ...rect, which };
    setResizePreview({ ...rect });
    onRectSelect(rect.uid);
  };

  const moveResize = (e, which) => {
    const s = resizeStart.current;
    if (!s) return;
    // e.target.x/y() returns the node's LOCAL position.
    // Handles are Layer children so local == absolute.
    const nx = e.target.x(), ny = e.target.y();
    switch (which) {
      case "right": {
        // Handle left-edge is at (rect.x + rect.w - RH_W/2). Center: nx + RH_W/2
        const newW = Math.max(10, Math.round(nx + RH_W / 2 - s.x));
        setResizePreview((p) => ({ ...p, w: newW }));
        break;
      }
      case "left": {
        // Handle center x = nx + RH_W/2 → new rect left edge
        const newX = Math.round(nx + RH_W / 2);
        const newW = Math.max(10, s.x + s.w - newX);
        setResizePreview((p) => ({ ...p, x: newX, w: newW }));
        break;
      }
      case "bottom": {
        // Handle center y = ny + RH_W/2 → new rect bottom edge
        const newH = Math.max(10, Math.round(ny + RH_W / 2 - s.y));
        setResizePreview((p) => ({ ...p, h: newH }));
        break;
      }
      case "top": {
        const newY = Math.round(ny + RH_W / 2);
        const newH = Math.max(10, s.y + s.h - newY);
        setResizePreview((p) => ({ ...p, y: newY, h: newH }));
        break;
      }
    }
  };

  const endResize = () => {
    if (resizePreview) onRectResize(resizePreview.uid, resizePreview);
    setResizePreview(null);
    resizeStart.current = null;
  };

  // dragBoundFunc helpers — lock the non-resize axis using the captured start state
  const lockY = (pos) => {
    const s = resizeStart.current;
    if (!s) return pos;
    return { x: pos.x, y: s.y + s.h / 2 - RH_L / 2 };
  };
  const lockX = (pos) => {
    const s = resizeStart.current;
    if (!s) return pos;
    return { x: s.x + s.w / 2 - RH_L / 2, y: pos.y };
  };
  const lockYTop = (pos) => {
    const s = resizeStart.current;
    if (!s) return pos;
    return { x: pos.x, y: pos.y }; // top handle: free vertical, lock horizontal
  };

  // The rect dimensions used for rendering the selected box and handles
  const selectedRectObj   = rectangles.find((r) => r.uid === selectedId) ?? null;
  const selectedDisplay   = selectedRectObj
    ? (resizePreview?.uid === selectedRectObj.uid ? resizePreview : selectedRectObj)
    : null;

  // Shared handle style
  const HS = { fill: "#facc15", stroke: "#111", strokeWidth: 1, opacity: 0.92 };

  return (
    <Stage
      width={dimensions.width}
      height={dimensions.height}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      <Layer>
        {/* ── background image ── */}
        <KonvaImage image={image} width={dimensions.width} height={dimensions.height} />

        {/* ── Y guides (horizontal, cyan) — draggable vertically ── */}
        {drawSettings.showGuides &&
          yGuides.map((yPos, i) => {
            const isSnapped  = yPos === activeGuideY;
            const isDragging = draggingGuide?.axis === "y" && draggingGuide?.index === i;
            const active     = isSnapped || isDragging;
            return (
              <Line
                key={`y-${i}`}
                points={[0, yPos, dimensions.width, yPos]}
                stroke={active ? "#ffffff" : "#38bdf8"}
                strokeWidth={active ? 2 : 1}
                dash={active ? [] : [10, 5]}
                opacity={active ? 1 : 0.6}
                draggable
                dragBoundFunc={(pos) => ({ x: 0, y: pos.y })}
                onMouseEnter={(e) => setCursor(e, "ns-resize")}
                onMouseLeave={(e) => setCursor(e, "default")}
                onDragStart={() => setDraggingGuide({ axis: "y", index: i })}
                onDragEnd={(e) => {
                  onGuideMove("y", i, Math.max(0, Math.round(yPos + e.target.y())));
                  e.target.y(0); // reset node — guide position lives in points
                  setDraggingGuide(null);
                }}
              />
            );
          })}

        {/* ── X guides (vertical, orange) — draggable horizontally ── */}
        {drawSettings.showGuides &&
          xGuides.map((xPos, i) => {
            const isDragging = draggingGuide?.axis === "x" && draggingGuide?.index === i;
            return (
              <Line
                key={`x-${i}`}
                points={[xPos, 0, xPos, dimensions.height]}
                stroke={isDragging ? "#ffffff" : "#f97316"}
                strokeWidth={isDragging ? 2 : 1}
                dash={isDragging ? [] : [10, 5]}
                opacity={isDragging ? 1 : 0.6}
                draggable
                dragBoundFunc={(pos) => ({ x: pos.x, y: 0 })}
                onMouseEnter={(e) => setCursor(e, "ew-resize")}
                onMouseLeave={(e) => setCursor(e, "default")}
                onDragStart={() => setDraggingGuide({ axis: "x", index: i })}
                onDragEnd={(e) => {
                  onGuideMove("x", i, Math.max(0, Math.round(xPos + e.target.x())));
                  e.target.x(0);
                  setDraggingGuide(null);
                }}
              />
            );
          })}

        {/* ── rectangles ── */}
        {rectangles.map((rect) => {
          const isSelected  = rect.uid === selectedId;
          const color       = isSelected ? "#facc15" : "#ef4444";
          // Use resize preview dimensions for the selected box while handle is dragged
          const disp = (resizePreview?.uid === rect.uid) ? resizePreview : rect;

          const dragBoundFunc = (pos) => {
            if (!yGuides.length) return pos;
            for (const g of yGuides) {
              if (Math.abs(pos.y - g) <= SNAP_THRESHOLD) return { x: pos.x, y: g };
            }
            return pos;
          };

          return (
            <Group
              key={rect.uid}
              x={disp.x}
              y={disp.y}
              draggable
              dragBoundFunc={dragBoundFunc}
              onDragStart={() => onRectSelect(rect.uid)}
              onDragMove={(e) => {
                const snapped = yGuides.find((g) => Math.abs(e.target.y() - g) <= 2) ?? null;
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
              <Text
                x={2} y={-15}
                text={`${rect.surah}:${rect.ayah}`}
                fontSize={11} fontStyle="bold" fill={color}
                listening={false}
              />
              <Rect
                x={0} y={0}
                width={disp.w} height={disp.h}
                stroke={color}
                strokeWidth={isSelected ? 3 : 2}
              />
            </Group>
          );
        })}

        {/* ── resize handles — only for the selected box ── */}
        {selectedDisplay && (() => {
          const { x, y, w, h } = selectedDisplay;
          const uid = selectedRectObj.uid;

          // Right edge  ┤
          const rightX = x + w - RH_W / 2;
          const rightY = y + h / 2 - RH_L / 2;

          // Left edge   ├
          const leftX  = x - RH_W / 2;
          const leftY  = rightY;

          // Bottom edge ┴
          const botX   = x + w / 2 - RH_L / 2;
          const botY   = y + h - RH_W / 2;

          // Top edge    ┬
          const topX   = botX;
          const topY   = y - RH_W / 2;

          return (
            <>
              {/* right */}
              <Rect {...HS} x={rightX} y={rightY} width={RH_W} height={RH_L}
                draggable dragBoundFunc={lockY}
                onMouseEnter={(e) => setCursor(e, "ew-resize")}
                onMouseLeave={(e) => setCursor(e, "default")}
                onDragStart={() => startResize(selectedRectObj, "right")}
                onDragMove={(e) => moveResize(e, "right")}
                onDragEnd={endResize}
              />
              {/* left */}
              <Rect {...HS} x={leftX} y={leftY} width={RH_W} height={RH_L}
                draggable dragBoundFunc={lockY}
                onMouseEnter={(e) => setCursor(e, "ew-resize")}
                onMouseLeave={(e) => setCursor(e, "default")}
                onDragStart={() => startResize(selectedRectObj, "left")}
                onDragMove={(e) => moveResize(e, "left")}
                onDragEnd={endResize}
              />
              {/* bottom */}
              <Rect {...HS} x={botX} y={botY} width={RH_L} height={RH_W}
                draggable dragBoundFunc={lockX}
                onMouseEnter={(e) => setCursor(e, "ns-resize")}
                onMouseLeave={(e) => setCursor(e, "default")}
                onDragStart={() => startResize(selectedRectObj, "bottom")}
                onDragMove={(e) => moveResize(e, "bottom")}
                onDragEnd={endResize}
              />
              {/* top */}
              <Rect {...HS} x={topX} y={topY} width={RH_L} height={RH_W}
                draggable dragBoundFunc={lockYTop}
                onMouseEnter={(e) => setCursor(e, "ns-resize")}
                onMouseLeave={(e) => setCursor(e, "default")}
                onDragStart={() => startResize(selectedRectObj, "top")}
                onDragMove={(e) => moveResize(e, "top")}
                onDragEnd={endResize}
              />
            </>
          );
        })()}

        {/* ── in-progress draft ── */}
        {draftDisplay && (
          <Rect
            x={draftDisplay.x} y={draftDisplay.y}
            width={draftDisplay.w} height={draftDisplay.h}
            stroke="#60a5fa" strokeWidth={2} dash={[6, 3]}
            listening={false}
          />
        )}
      </Layer>
    </Stage>
  );
}
