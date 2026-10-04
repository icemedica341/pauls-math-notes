// toc-scrollspy.ts — single-active scrollspy + pane centering + click flight.
// (loop7 locateCentre/centreLink ported to the TOC pane: native smooth
// scrollTo from the CURRENT pane position, page scroll never touched, no
// stored positions ever reused.) Bundled into the toc.inline.ts entry by the
// inline-script esbuild pipeline.
import {
  buildParents,
  collectEntries,
  expandAncestors,
  LIST_SELECTOR,
  refreshList,
} from "./toc-collapse";

const SCROLLSPY_THRESHOLD_PX = 140;
// Click flight: a TOC click owns both scrollers until the flight ends.
// The lock freezes the highlight on the clicked row AND suppresses
// pane-follow (full scrollspy suppression); it releases when scrolling
// settles, at an absolute cap, or the moment the user grabs
// input (wheel/touch/pointerdown/scroll-keys) — the user always wins.
const FLIGHT_SETTLE_MS = 160;
/** Absolute cap for a click flight (also used by the entry for its backup timer). */
const FLIGHT_MAX_MS = 3000;
// The clicked heading lands this far below the viewport top: inside the
// scrollspy threshold so the settled-section resync selects the clicked row.
export const CLICK_LAND_OFFSET_PX = 120;
let clickFlightUntil = 0;
let flightSettleTimer: number | null = null;
let flightMaxTimer: number | null = null;

let spyTicking = false;

export function centreActiveEntry(
  list: HTMLUListElement,
  link: HTMLAnchorElement,
): void {
  // The entry lands on the whole LEFT SIDEBAR column's midpoint, not the
  // TOC list box's middle. Native smooth scrollTo from the CURRENT pane
  // position; the page scroll is never touched.
  try {
    const side = list.closest(".sidebar.left") as HTMLElement | null;
    const refRect = (side ?? list).getBoundingClientRect();
    const linkRect = link.getBoundingClientRect();
    const target =
      list.scrollTop +
      (linkRect.top + linkRect.height / 2) -
      (refRect.top + refRect.height / 2);
    const max = list.scrollHeight - list.clientHeight;
    const clamped = clampScroll(target, max);
    list.scrollTo({ top: clamped, behavior: "smooth" });
  } catch {
    // Pane centering is best-effort; the highlight is the contract.
  }
}

/** Clamp a scroll target into [0, max] (non-finite targets pin to 0). */
function clampScroll(target: number, max: number): number {
  return Math.max(0, Math.min(isFinite(target) ? target : 0, Math.max(0, max)));
}

/** Clamp a page scroll target into the valid range so nothing overshoots. */
export function clampPageScroll(target: number): number {
  return clampScroll(
    target,
    document.documentElement.scrollHeight - window.innerHeight,
  );
}

export function inFlight(): boolean {
  return Date.now() < clickFlightUntil;
}

/** Engage the click-flight lock (clears stale timers first, as before). */
export function beginFlight(): void {
  clearFlightTimers();
  clickFlightUntil = Date.now() + FLIGHT_MAX_MS;
}

/** Backup cap timer: releases the flight even if no scroll settles it. */
export function armMaxTimer(): void {
  if (flightMaxTimer !== null) window.clearTimeout(flightMaxTimer);
  flightMaxTimer = window.setTimeout(() => {
    flightMaxTimer = null;
    if (inFlight()) releaseFlight();
  }, FLIGHT_MAX_MS + 50);
}

function clearFlightTimers(): void {
  if (flightSettleTimer !== null) {
    window.clearTimeout(flightSettleTimer);
    flightSettleTimer = null;
  }
  if (flightMaxTimer !== null) {
    window.clearTimeout(flightMaxTimer);
    flightMaxTimer = null;
  }
}

/** Release the lock and resync follow to the settled section. */
function releaseFlight(): void {
  clearFlightTimers();
  clickFlightUntil = 0;
  requestSpyTick();
}

/** No scroll events for a beat means the flight has landed. */
export function armSettleTimer(): void {
  if (flightSettleTimer !== null) window.clearTimeout(flightSettleTimer);
  flightSettleTimer = window.setTimeout(() => {
    flightSettleTimer = null;
    if (inFlight()) releaseFlight();
  }, FLIGHT_SETTLE_MS);
}

/**
 * User wheel/touch/pointer/key input cancels a click flight: the user owns
 * scroll. In-flight smooth scrolls are aborted by snapping to the current
 * position, then follow resyncs to wherever the user left things.
 */
export function cancelFlight(): void {
  if (!inFlight()) return;
  const list = document.querySelector(LIST_SELECTOR) as HTMLUListElement | null;
  try {
    // Snapping to the current position aborts an in-flight smooth scroll.
    if (list)
      list.scrollTo({
        top: clampScroll(list.scrollTop, list.scrollHeight - list.clientHeight),
        behavior: "auto",
      });
    window.scrollTo({ top: clampPageScroll(window.scrollY), behavior: "auto" });
  } catch {
    // Best-effort only.
  }
  releaseFlight();
}

function scrollSpyTick(): void {
  spyTicking = false;
  // Click-flight hard freeze: the highlight is locked to the clicked row
  // for the whole flight — zero scrollspy updates until release.
  if (inFlight()) return;
  const list = document.querySelector(LIST_SELECTOR) as HTMLUListElement | null;
  if (!list) return;
  const entries = collectEntries(list);
  if (entries.length === 0) return;
  const targets: { id: string; top: number }[] = [];
  for (const entry of entries) {
    const el = document.getElementById(entry.id);
    if (!el) continue;
    targets.push({ id: entry.id, top: el.getBoundingClientRect().top });
  }
  if (targets.length === 0) return;
  let current = targets[0].id;
  for (const t of targets) {
    if (t.top <= SCROLLSPY_THRESHOLD_PX) current = t.id;
  }
  let changed = false;
  for (const entry of entries) {
    const active = entry.id === current;
    if (entry.link.classList.contains("active") !== active) {
      entry.link.classList.toggle("active", active);
      changed = true;
    }
  }
  if (!changed) return;
  // Pane-follow only: the highlight above is already final; centre it.
  // Expand ancestors of the newly-active entry (loop7 expandAncestors) so the
  // centred row is always visible, then centre it in the pane only.
  const activeIndex = entries.findIndex((entry) => entry.id === current);
  if (activeIndex >= 0) {
    const parentOf = buildParents(entries);
    expandAncestors(entries, parentOf, activeIndex);
    refreshList(list);
  }
  const activeLink = list.querySelector(
    "a[data-for].active",
  ) as HTMLAnchorElement | null;
  if (!activeLink) return;
  centreActiveEntry(list, activeLink);
}

export function requestSpyTick(): void {
  if (spyTicking) return;
  spyTicking = true;
  window.requestAnimationFrame(scrollSpyTick);
}
