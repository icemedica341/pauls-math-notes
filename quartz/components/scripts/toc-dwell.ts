// toc-dwell.ts — 450ms dwell overlay for TRUNCATED entries only.
// Fixed overlay with the full entry text, font-weight normal, zero layout
// shift. Bundled into the toc.inline.ts entry by the inline-script esbuild
// pipeline.
const DWELL_DELAY_MS = 450;

let dwellTimer: number | null = null;
let dwellOverlay: HTMLDivElement | null = null;
let dwellTarget: HTMLAnchorElement | null = null;

export function clearDwell(): void {
  if (dwellTimer !== null) {
    window.clearTimeout(dwellTimer);
    dwellTimer = null;
  }
  dwellOverlay?.remove();
  dwellOverlay = null;
  dwellTarget = null;
}

/** True while the dwell overlay (or a pending dwell) owns this link. */
export function isDwellTarget(link: HTMLAnchorElement): boolean {
  return link === dwellTarget;
}

function isTruncated(link: HTMLAnchorElement): boolean {
  return link.scrollWidth > link.clientWidth + 1;
}

/** Fixed overlay aligned exactly over the row: same row styling, weight normal. */
function showDwellOverlay(link: HTMLAnchorElement): void {
  clearDwell();
  const rect = link.getBoundingClientRect();
  const cs = window.getComputedStyle(link);
  const overlay = document.createElement("div");
  overlay.className = "toc-dwell-inline";
  overlay.textContent = link.textContent ?? "";
  overlay.style.left = `${rect.left}px`;
  overlay.style.top = `${rect.top}px`;
  overlay.style.height = `${rect.height}px`;
  overlay.style.font = cs.font;
  overlay.style.fontWeight = "normal";
  overlay.style.color = cs.color;
  overlay.style.background = cs.backgroundColor;
  overlay.style.paddingLeft = cs.paddingLeft;
  overlay.style.paddingRight = "0px";
  overlay.setAttribute("aria-hidden", "true");
  document.body.appendChild(overlay);
  dwellOverlay = overlay;
  dwellTarget = link;
}

export function armDwell(link: HTMLAnchorElement): void {
  clearDwell();
  // Touch / coarse pointers have no hover dwell.
  if (window.matchMedia("(hover: none)").matches) return;
  dwellTarget = link;
  dwellTimer = window.setTimeout(() => {
    dwellTimer = null;
    if (isTruncated(link)) showDwellOverlay(link);
  }, DWELL_DELAY_MS);
}
