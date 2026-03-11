import { useEffect, useMemo, useRef, useState } from "react";
import { Stage, Layer, Image as KonvaImage, Rect, Text, Line, Group } from "react-konva";
import useImage from "use-image";
import { normalizeRect, snapToNearestGuide, nextUid } from "../utils/rectUtils";

const SNAP_THRESHOLD        = 20;  // box-drag: pull-in radius
const STICKY_RELEASE        = 50;  // box-drag: release radius (raise = stickier)
const RESIZE_SNAP_THRESHOLD = 14;  // resize handle: pull-in radius (weaker than drag)
const RESIZE_STICKY_RELEASE = 28;  // resize handle: release radius
const DRAW_SNAP_THRESHOLD   = 8;   // live-draw trailing edge: pull-in radius (subtle)
const RH_W  = 10;          // resize handle short side (px)
const RH_L  = 24;          // resize handle long side (px)

function setCursor(e, cursor) {
  e.target.getStage().container().style.cursor = cursor;
}

// ─── DrawingCanvas ─────────────────────────────────────────────────────────────
// Props:
//   src, width
//   rectangles, selectedIds
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
  selectedIds,
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
  const [activeGuideX, setActiveGuideX] = useState(null);

  // ── which guide line is being dragged (for highlight) ───────────────────────
  const [draggingGuide, setDraggingGuide] = useState(null); // { axis, index }

  // ── resize preview — overrides the selected rect during a handle drag ────────
  const [resizePreview, setResizePreview] = useState(null); // { uid,x,y,w,h }
  const drawOrigin    = useRef(null);  // center-snapped mousedown position for drawing
  const resizeStart   = useRef(null);  // initial rect at drag-start
  const resizeSnapped = useRef({ x: null, y: null }); // sticky snap state per axis during resize
  // Sticky snap state — tracks the snapped node position per axis while dragging a box.
  // null = not snapped; number = the node x/y that corresponds to the snapped position.
  const snappedToY  = useRef(null);
  const snappedToX  = useRef(null);
  // Offset between pointer and node origin at drag-start — used to compute the true
  // "free" position from the pointer, independent of any snapping we applied.
  const dragOffset  = useRef({ x: 0, y: 0 });

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
  const applySnapY = (y) =>
    drawSettings.snapToLines && yGuides.length
      ? snapToNearestGuide(y, yGuides)
      : y;

  const applySnapX = (x) =>
    drawSettings.snapToLines && xGuides.length
      ? snapToNearestGuide(x, xGuides)
      : x;

  // ── drawing handlers ─────────────────────────────────────────────────────────
  const handleMouseDown = (e) => {
    const cls = e.target.getClassName();
    // Don't start drawing on existing boxes, guides, or resize handles
    if (cls === "Rect" || cls === "Line" || cls === "Group") return;

    const pos = e.target.getStage().getPointerPosition();
    const ox = applySnapX(pos.x), oy = applySnapY(pos.y);
    drawOrigin.current = { x: ox, y: oy };
    setIsDrawing(true);
    setDraft({ x: ox, y: oy, w: 0, h: 0 });
    onRectSelect(null, false);
  };

  const handleMouseMove = (e) => {
    if (!isDrawing || !draft || !drawOrigin.current) return;
    const pos = e.target.getStage().getPointerPosition();
    const H = 1; // strokeWidth(2) / 2 — outer-edge offset
    const dirX = pos.x >= drawOrigin.current.x ? 1 : -1;
    const dirY = pos.y >= drawOrigin.current.y ? 1 : -1;
    // Outer-correct the origin: shift it away from the trailing direction by H
    const originX = drawOrigin.current.x - dirX * H;
    const originY = drawOrigin.current.y - dirY * H;
    // Outer-correct the trailing edge: shift cursor toward guide by H before snapping
    const snappedX = drawSettings.snapToLines && xGuides.length
      ? snapToNearestGuide(pos.x + dirX * H, xGuides, DRAW_SNAP_THRESHOLD) - dirX * H
      : pos.x;
    const snappedY = drawSettings.snapToLines && yGuides.length
      ? snapToNearestGuide(pos.y + dirY * H, yGuides, DRAW_SNAP_THRESHOLD) - dirY * H
      : pos.y;
    setDraft({
      x: originX,
      y: originY,
      w: snappedX - originX,
      h: drawSettings.fixedHeight ? drawSettings.fixedHeightValue : snappedY - originY,
    });
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
    resizeSnapped.current = { x: null, y: null };
    setResizePreview({ ...rect });
    onRectSelect(rect.uid, false);
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
    resizeSnapped.current = { x: null, y: null };
  };

  // dragBoundFunc helpers — lock the non-resize axis and snap the free axis to guides.
  // pos is the RAW Konva-computed position (always fresh), so hysteresis works correctly here.

  // right / left handles — free axis is X, locked axis is Y
  const lockY = (pos) => {
    const s = resizeStart.current;
    if (!s) return pos;
    const lockedY = s.y + s.h / 2 - RH_L / 2;

    if (drawSettings.snapToLines && xGuides.length) {
      // handle center x = pos.x + RH_W/2 — that's the rect edge being dragged
      if (resizeSnapped.current.x !== null) {
        if (Math.abs(pos.x - resizeSnapped.current.x) > RESIZE_STICKY_RELEASE)
          resizeSnapped.current.x = null;
      }
      if (resizeSnapped.current.x === null) {
        let best = RESIZE_SNAP_THRESHOLD + 1, snap = null;
        for (const g of xGuides) {
          const d = Math.abs(pos.x + RH_W / 2 - g);
          if (d < best) { best = d; snap = g - RH_W / 2; }
        }
        if (snap !== null) resizeSnapped.current.x = snap;
      }
      if (resizeSnapped.current.x !== null)
        return { x: resizeSnapped.current.x, y: lockedY };
    }
    return { x: pos.x, y: lockedY };
  };

  // bottom handle — free axis is Y, locked axis is X
  const lockX = (pos) => {
    const s = resizeStart.current;
    if (!s) return pos;
    const lockedX = s.x + s.w / 2 - RH_L / 2;

    if (drawSettings.snapToLines && yGuides.length) {
      // handle center y = pos.y + RH_W/2 — that's the rect bottom edge
      if (resizeSnapped.current.y !== null) {
        if (Math.abs(pos.y - resizeSnapped.current.y) > RESIZE_STICKY_RELEASE)
          resizeSnapped.current.y = null;
      }
      if (resizeSnapped.current.y === null) {
        let best = RESIZE_SNAP_THRESHOLD + 1, snap = null;
        for (const g of yGuides) {
          const d = Math.abs(pos.y + RH_W / 2 - g);
          if (d < best) { best = d; snap = g - RH_W / 2; }
        }
        if (snap !== null) resizeSnapped.current.y = snap;
      }
      if (resizeSnapped.current.y !== null)
        return { x: lockedX, y: resizeSnapped.current.y };
    }
    return { x: lockedX, y: pos.y };
  };

  // top handle — free axis is Y (x movement is ignored by moveResize)
  const lockYTop = (pos) => {
    const s = resizeStart.current;
    if (!s) return pos;

    if (drawSettings.snapToLines && yGuides.length) {
      // handle center y = pos.y + RH_W/2 — that's the rect top edge
      if (resizeSnapped.current.y !== null) {
        if (Math.abs(pos.y - resizeSnapped.current.y) > RESIZE_STICKY_RELEASE)
          resizeSnapped.current.y = null;
      }
      if (resizeSnapped.current.y === null) {
        let best = RESIZE_SNAP_THRESHOLD + 1, snap = null;
        for (const g of yGuides) {
          const d = Math.abs(pos.y + RH_W / 2 - g);
          if (d < best) { best = d; snap = g - RH_W / 2; }
        }
        if (snap !== null) resizeSnapped.current.y = snap;
      }
      if (resizeSnapped.current.y !== null)
        return { x: pos.x, y: resizeSnapped.current.y };
    }
    return { x: pos.x, y: pos.y };
  };

  // The rect dimensions used for rendering the selected box and handles
  // Only show resize handles when exactly 1 rect is selected
  const selectedRectObj = selectedIds.length === 1
    ? rectangles.find((r) => r.uid === selectedIds[0]) ?? null
    : null;
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
            const color      = active ? "#ffffff" : "#38bdf8";
            return (
              <Group
                key={`y-${i}`}
                draggable
                dragBoundFunc={(pos) => ({ x: 0, y: pos.y })}
                onMouseEnter={(e) => setCursor(e, "ns-resize")}
                onMouseLeave={(e) => setCursor(e, "default")}
                onDragStart={() => setDraggingGuide({ axis: "y", index: i })}
                onDragEnd={(e) => {
                  onGuideMove("y", i, Math.max(0, Math.round(yPos + e.target.y())));
                  e.target.y(0);
                  setDraggingGuide(null);
                }}
              >
                <Line
                  points={[0, yPos, dimensions.width, yPos]}
                  stroke={color}
                  strokeWidth={active ? 2 : 1}
                  dash={active ? [] : [10, 5]}
                  opacity={active ? 1 : 0.6}
                  listening={false}
                />
                <Text
                  x={4} y={yPos - 12}
                  text={String(i + 1)}
                  fontSize={10} fontStyle="bold"
                  fill={color}
                  opacity={active ? 1 : 0.75}
                  listening={false}
                />
              </Group>
            );
          })}

        {/* ── X guides (vertical, orange) — draggable horizontally ── */}
        {drawSettings.showGuides &&
          xGuides.map((xPos, i) => {
            const isSnapped  = xPos === activeGuideX;
            const isDragging = draggingGuide?.axis === "x" && draggingGuide?.index === i;
            const active     = isSnapped || isDragging;
            const color      = active ? "#ffffff" : "#f97316";
            return (
              <Group
                key={`x-${i}`}
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
              >
                <Line
                  points={[xPos, 0, xPos, dimensions.height]}
                  stroke={color}
                  strokeWidth={active ? 2 : 1}
                  dash={active ? [] : [10, 5]}
                  opacity={active ? 1 : 0.6}
                  listening={false}
                />
                <Text
                  x={xPos + 4} y={4}
                  text={String(i + 1)}
                  fontSize={10} fontStyle="bold"
                  fill={color}
                  opacity={active ? 1 : 0.75}
                  listening={false}
                />
              </Group>
            );
          })}

        {/* ── rectangles ── */}
        {rectangles.map((rect) => {
          const isSelected  = selectedIds.includes(rect.uid);
          const color       = isSelected ? "#facc15" : "#ef4444";
          // Use resize preview dimensions for the selected box while handle is dragged
          const disp = (resizePreview?.uid === rect.uid) ? resizePreview : rect;

          return (
            <Group
              key={rect.uid}
              x={disp.x}
              y={disp.y}
              draggable
              onDragStart={(e) => {
                if (!selectedIds.includes(rect.uid)) {
                  onRectSelect(rect.uid, false);
                }
                snappedToY.current = null;
                snappedToX.current = null;
                // Record pointer-to-node offset so we can recover the true free position later
                const ptr = e.target.getStage().getPointerPosition();
                dragOffset.current = { x: ptr.x - e.target.x(), y: ptr.y - e.target.y() };
              }}
              onDragMove={(e) => {
                // Compute the TRUE free position from the raw pointer, not from e.target.x/y()
                // (e.target.x/y already reflects our previous snap override, so it's useless here)
                const ptr = e.target.getStage().getPointerPosition();
                const pos = {
                  x: ptr.x - dragOffset.current.x,
                  y: ptr.y - dragOffset.current.y,
                };

                if (drawSettings.snapToLines) {
                  // ── Y axis (horizontal guides) ──────────────────────────────
                  if (snappedToY.current !== null) {
                    // Already snapped — release only if raw pos drifted beyond STICKY_RELEASE
                    if (Math.abs(pos.y - snappedToY.current) > STICKY_RELEASE) {
                      snappedToY.current = null;
                    }
                  }
                  if (snappedToY.current === null) {
                    // Not snapped — check if any guide edge is within pull-in radius
                    let best = SNAP_THRESHOLD + 1, snapNodeY = null;
                    for (const g of yGuides) {
                      const dTop = Math.abs(pos.y - g);
                      if (dTop < best) { best = dTop; snapNodeY = g; }
                      const dBot = Math.abs(pos.y + disp.h - g);
                      if (dBot < best) { best = dBot; snapNodeY = g - disp.h; }
                    }
                    if (snapNodeY !== null) snappedToY.current = snapNodeY;
                  }

                  // ── X axis (vertical guides) ────────────────────────────────
                  if (snappedToX.current !== null) {
                    if (Math.abs(pos.x - snappedToX.current) > STICKY_RELEASE) {
                      snappedToX.current = null;
                    }
                  }
                  if (snappedToX.current === null) {
                    let best = SNAP_THRESHOLD + 1, snapNodeX = null;
                    for (const g of xGuides) {
                      const dLeft = Math.abs(pos.x - g);
                      if (dLeft < best) { best = dLeft; snapNodeX = g; }
                      const dRight = Math.abs(pos.x + disp.w - g);
                      if (dRight < best) { best = dRight; snapNodeX = g - disp.w; }
                    }
                    if (snapNodeX !== null) snappedToX.current = snapNodeX;
                  }
                }

                // Apply final position
                if (snappedToY.current !== null) e.target.y(snappedToY.current);
                if (snappedToX.current !== null) e.target.x(snappedToX.current);

                // Highlight the snapped guide lines
                const ny = snappedToY.current !== null ? snappedToY.current : pos.y;
                const nx = snappedToX.current !== null ? snappedToX.current : pos.x;
                setActiveGuideY(yGuides.find((g) =>
                  Math.abs(ny - g) <= 1 || Math.abs(ny + disp.h - g) <= 1) ?? null);
                setActiveGuideX(xGuides.find((g) =>
                  Math.abs(nx - g) <= 1 || Math.abs(nx + disp.w - g) <= 1) ?? null);
              }}
              onDragEnd={(e) => {
                snappedToY.current = null;
                snappedToX.current = null;
                setActiveGuideY(null);
                setActiveGuideX(null);
                onRectMove(rect.uid, {
                  x: Math.round(e.target.x()),
                  y: Math.round(e.target.y()),
                });
              }}
              onClick={(e) => onRectSelect(rect.uid, e.evt.ctrlKey || e.evt.metaKey)}
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
