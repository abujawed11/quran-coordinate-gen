// ─── Rect normalization ───────────────────────────────────────────────────────
// Ensures x/y are always the top-left corner and w/h are always positive.
// Call this before saving any drawn rectangle.

export function normalizeRect(x, y, w, h) {
  return {
    x: Math.round(w < 0 ? x + w : x),
    y: Math.round(h < 0 ? y + h : y),
    w: Math.round(Math.abs(w)),
    h: Math.round(Math.abs(h)),
  };
}

// ─── Snap to nearest line guide ───────────────────────────────────────────────
// Returns the Y value of the closest guide, or the original y if no guides.

export function snapToNearestGuide(y, guides) {
  if (!guides.length) return y;
  return guides.reduce(
    (best, g) => (Math.abs(g - y) < Math.abs(best - y) ? g : best),
    guides[0]
  );
}

// ─── Export helpers ───────────────────────────────────────────────────────────
// Groups rectangle array by "surah:ayah" key.
// Output: { "2:255": [{x,y,w,h}, ...], ... }
//
// scale — { x: scaleX, y: scaleY } where scale = originalDim / displayDim.
// Rectangles are stored in display-canvas coordinates; multiply by scale to
// convert to original-image coordinates before export.
// Pass scale = { x: 1, y: 1 } (or omit) to export raw display coordinates.

export function exportGroupedJSON(rectangles, { scale = { x: 1, y: 1 }, page = null, originalWidth = null, originalHeight = null } = {}) {
  const ayahs = {};
  for (const r of rectangles) {
    const key = `${r.surah}:${r.ayah}`;
    if (!ayahs[key]) ayahs[key] = [];
    ayahs[key].push({
      x: Math.round(r.x * scale.x),
      y: Math.round(r.y * scale.y),
      w: Math.round(r.w * scale.x),
      h: Math.round(r.h * scale.y),
    });
  }
  return {
    page,
    image: { width: originalWidth, height: originalHeight },
    ayahs,
  };
}

export function downloadJSON(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── UID generator ────────────────────────────────────────────────────────────
let _uid = 1;
export function nextUid() {
  return _uid++;
}
