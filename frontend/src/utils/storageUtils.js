// ─── Per-page localStorage helpers ───────────────────────────────────────────
// Key format: "quran-page-1", "quran-page-2", …
// Value: { rectangles, yGuides, xGuides, savedAt }
//
// Guide snapshots: "quran-guide-snap-1", "quran-guide-snap-2", …
// Value: { yGuides, xGuides, savedAt }

const PREFIX = "quran-page-";

export function savePageData(pageNumber, { rectangles, yGuides, xGuides }) {
  try {
    localStorage.setItem(
      `${PREFIX}${pageNumber}`,
      JSON.stringify({ rectangles, yGuides, xGuides, savedAt: Date.now() })
    );
  } catch (e) {
    console.warn("localStorage write failed:", e);
  }
}

export function loadPageData(pageNumber) {
  try {
    const raw = localStorage.getItem(`${PREFIX}${pageNumber}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

const SNAP_PREFIX = "quran-guide-snap-";

export function saveGuideSnapshot(pageNumber, { yGuides, xGuides }) {
  try {
    localStorage.setItem(
      `${SNAP_PREFIX}${pageNumber}`,
      JSON.stringify({ yGuides, xGuides, savedAt: Date.now() })
    );
  } catch (e) {
    console.warn("localStorage write failed:", e);
  }
}

export function loadGuideSnapshot(pageNumber) {
  try {
    const raw = localStorage.getItem(`${SNAP_PREFIX}${pageNumber}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// Returns sorted list of page numbers that have at least one saved box.
export function getSavedPageNumbers() {
  const pages = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key?.startsWith(PREFIX)) continue;
    try {
      const data = JSON.parse(localStorage.getItem(key));
      if (data?.rectangles?.length > 0) {
        pages.push(parseInt(key.slice(PREFIX.length), 10));
      }
    } catch { /* skip corrupted entries */ }
  }
  return pages.sort((a, b) => a - b);
}
