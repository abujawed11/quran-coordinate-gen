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

// ─── Named layouts ────────────────────────────────────────────────────────────
// Key format: "quran-layout-<name>"
// Value: { name, rectangles, savedAt }

const LAYOUT_PREFIX = "quran-layout-";

export function saveLayout(name, rectangles) {
  try {
    localStorage.setItem(
      `${LAYOUT_PREFIX}${name}`,
      JSON.stringify({ name, rectangles, savedAt: Date.now() })
    );
  } catch (e) {
    console.warn("localStorage write failed:", e);
  }
}

export function loadAllLayouts() {
  const layouts = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key?.startsWith(LAYOUT_PREFIX)) continue;
    try {
      const data = JSON.parse(localStorage.getItem(key));
      if (data?.name && Array.isArray(data.rectangles)) layouts.push(data);
    } catch { /* skip corrupted */ }
  }
  return layouts.sort((a, b) => a.name.localeCompare(b.name));
}

export function deleteLayout(name) {
  localStorage.removeItem(`${LAYOUT_PREFIX}${name}`);
}

// ─── Full data export / import ────────────────────────────────────────────────

export function exportAllData() {
  const result = {
    version: 1,
    exportedAt: Date.now(),
    guideSettings: null,
    pages: {},
    guideSnaps: {},
    layouts: {},
  };
  try {
    const gs = localStorage.getItem("quran-guide-settings");
    result.guideSettings = gs ? JSON.parse(gs) : null;
  } catch { /* ignore */ }
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    try {
      if (key?.startsWith(PREFIX)) {
        const pageNum = parseInt(key.slice(PREFIX.length), 10);
        result.pages[pageNum] = JSON.parse(localStorage.getItem(key));
      } else if (key?.startsWith(SNAP_PREFIX)) {
        const pageNum = parseInt(key.slice(SNAP_PREFIX.length), 10);
        result.guideSnaps[pageNum] = JSON.parse(localStorage.getItem(key));
      } else if (key?.startsWith(LAYOUT_PREFIX)) {
        const name = key.slice(LAYOUT_PREFIX.length);
        result.layouts[name] = JSON.parse(localStorage.getItem(key));
      }
    } catch { /* skip corrupted */ }
  }
  return result;
}

export function importAllData(data) {
  if (!data || typeof data !== "object") throw new Error("Invalid data");
  if (data.guideSettings) {
    localStorage.setItem("quran-guide-settings", JSON.stringify(data.guideSettings));
  }
  for (const [pageNum, pageData] of Object.entries(data.pages ?? {})) {
    localStorage.setItem(`${PREFIX}${pageNum}`, JSON.stringify(pageData));
  }
  for (const [pageNum, snapData] of Object.entries(data.guideSnaps ?? {})) {
    localStorage.setItem(`${SNAP_PREFIX}${pageNum}`, JSON.stringify(snapData));
  }
  for (const [name, layoutData] of Object.entries(data.layouts ?? {})) {
    localStorage.setItem(`${LAYOUT_PREFIX}${name}`, JSON.stringify(layoutData));
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
