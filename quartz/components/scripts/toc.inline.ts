// TOC explorer: faithful flat-list port of the cs-notes explorer stack
// (upstream @quartz-community/explorer + explorer-loop6 index.js toolbar +
// explorer-loop7 loop7.js locate+centre), adapted to the Quartz
// table-of-contents list: ul.toc-content.overflow > li.depth-N.
//
// Entry point only: behavior lives in toc-collapse.ts (entries, chevron
// collapse/expand, toolbar), toc-dwell.ts (450ms truncated-entry overlay) and
// toc-scrollspy.ts (single-active spy, pane centering, click-flight lock),
// bundled here by the inline-script esbuild pipeline.
//
// Behaviors (ported, not reinvented):
//  (a) chevron collapse/expand on EVERY parent row at any depth — a row owns
//      children when the next row is deeper (recursive ownsChildren);
//      leaf rows get no chevron (explorer template-file vs template-folder).
//  (b) Collapse all / Expand all flip toolbar, order fixed, no sort
//      (loop6 ensureToolbar/refreshToolbar minus the loop7 sort toggle).
//  (c) 450ms dwell overlay for TRUNCATED entries only, full text,
//      font-weight normal, zero layout shift.
//  (d) single-active scrollspy; on activation the pane smooth-scrolls from
//      its CURRENT position so the entry lands in the vertical middle
//      (loop7 centreLink math, smooth behavior), ancestors auto-expanded
//      (loop7 expandAncestors). The page itself is never scrolled and no
//      scroll position is ever stored or reused.
// Starts fully expanded on every load. No localStorage, no sessionStorage.
import {
  LIST_SELECTOR,
  ROW_SELECTOR,
  buildParents,
  collectEntries,
  ensureFoldButtons,
  ensureToolbar,
  expandAncestors,
  normalizeLabels,
  refreshList,
  resetCollapseState,
} from "./toc-collapse";
import { armDwell, clearDwell, isDwellTarget } from "./toc-dwell";
import {
  CLICK_LAND_OFFSET_PX,
  armMaxTimer,
  armSettleTimer,
  beginFlight,
  cancelFlight,
  centreActiveEntry,
  clampPageScroll,
  inFlight,
  requestSpyTick,
} from "./toc-scrollspy";
import {
  RESULT_CARD_SELECTOR,
  recordSearchHoverKey,
  resultCardKey,
} from "./search-selectors";
import { applySearchPlaceholder } from "./search-placeholder";

// --- boot -------------------------------------------------------------------
function resetForPage(): void {
  resetCollapseState();
  clearDwell();
}

function initTocExplorer(): void {
  resetForPage();
  const lists = Array.from(
    document.querySelectorAll(LIST_SELECTOR),
  ) as HTMLUListElement[];
  for (const list of lists) {
    ensureFoldButtons(list);
    normalizeLabels(list);
    ensureToolbar(list);
    refreshList(list);
  }
  requestSpyTick();
  applySearchPlaceholder();
}

function bindGlobalOnce(): void {
  const doc = document as Document & { __tocExplorerBound?: boolean };
  if (doc.__tocExplorerBound) return;
  doc.__tocExplorerBound = true;

  // Delegated dwell: fires only for truncated entries, in place.
  document.addEventListener(
    "mouseover",
    (ev) => {
      const link = (ev.target as HTMLElement | null)?.closest?.(
        ROW_SELECTOR,
      ) as HTMLAnchorElement | null;
      if (!link || isDwellTarget(link)) return;
      armDwell(link);
    },
    true,
  );
  document.addEventListener(
    "mouseout",
    (ev) => {
      const link = (ev.target as HTMLElement | null)?.closest?.(
        ROW_SELECTOR,
      ) as HTMLAnchorElement | null;
      if (link && isDwellTarget(link)) clearDwell();
    },
    true,
  );

  // Single capture-mouseover owner (R19): the search preview-guard lives here
  // beside dwell (the preview-patch bundle owns only the MutationObserver).
  // Same-target hovers never reach the upstream bundle's results listener.
  document.addEventListener(
    "mouseover",
    (ev) => {
      const target = ev.target as Element | null;
      const card = target?.closest?.(RESULT_CARD_SELECTOR);
      if (!card) return;
      const key = resultCardKey(card);
      if (key) recordSearchHoverKey(key);
      if (card.classList.contains("focus")) ev.stopPropagation();
    },
    true,
  );
  document.addEventListener("scroll", clearDwell, true);
  document.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape") clearDwell();
  });

  window.addEventListener("scroll", requestSpyTick, { passive: true });
  // A quiet window means the flight has landed: re-arm on every scroll.
  window.addEventListener(
    "scroll",
    () => {
      if (inFlight()) armSettleTimer();
    },
    { passive: true },
  );
  window.addEventListener("resize", requestSpyTick);

  // Click flight: engage the lock (highlight frozen + pane-follow suppressed
  // so scrollspy ticks cannot touch the highlight or fight the animation),
  // smooth-scroll the pane from its
  // CURRENT position to centre the target AND smooth-scroll the page to
  // the section (both targets clamped). The lock releases when the flight
  // settles, at an absolute cap, or on user input (user wins); on release
  // the follow resyncs to the settled section.
  document.addEventListener("click", (ev) => {
    const link = (ev.target as HTMLElement | null)?.closest?.(
      ROW_SELECTOR,
    ) as HTMLAnchorElement | null;
    if (!link) return;
    const section = document.getElementById(link.dataset.for ?? "");
    if (!section) return;
    ev.preventDefault();
    // Stock SPA router (spa.inline.ts) also listens for same-page hash clicks
    // and fires an instant scrollIntoView that would abort this smooth flight
    // mid-animation; keep it out so the lock owns both scrollers.
    ev.stopPropagation();
    beginFlight();
    const list = link.closest(LIST_SELECTOR) as HTMLUListElement | null;
    if (list) {
      const entries = collectEntries(list);
      const idx = entries.findIndex((entry) => entry.link === link);
      if (idx >= 0) {
        const parentOf = buildParents(entries);
        expandAncestors(entries, parentOf, idx);
        refreshList(list);
      }
      for (const entry of entries) {
        entry.link.classList.toggle("active", entry.link === link);
      }
      centreActiveEntry(list, link);
    }
    const top =
      section.getBoundingClientRect().top +
      window.scrollY -
      CLICK_LAND_OFFSET_PX;
    window.scrollTo({ top: clampPageScroll(top), behavior: "smooth" });
    try {
      history.replaceState(null, "", `#${link.dataset.for ?? ""}`);
    } catch {
      // URL sync is cosmetic; the scroll is the contract.
    }
    armSettleTimer();
    armMaxTimer();
  });
  window.addEventListener("wheel", cancelFlight, {
    passive: true,
    capture: true,
  });
  window.addEventListener("touchmove", cancelFlight, {
    passive: true,
    capture: true,
  });
  // Grabbing the pane (scrollbar drag, text tap) mid-flight cancels too.
  document.addEventListener(
    "pointerdown",
    (ev) => {
      const pane = (ev.target as HTMLElement | null)?.closest?.("div.toc");
      if (!pane) return;
      cancelFlight();
    },
    { passive: true, capture: true },
  );
  // Scroll keys hand control back to the user.
  document.addEventListener("keydown", (ev) => {
    if (
      ev.key !== "ArrowUp" &&
      ev.key !== "ArrowDown" &&
      ev.key !== "ArrowLeft" &&
      ev.key !== "ArrowRight" &&
      ev.key !== "PageUp" &&
      ev.key !== "PageDown" &&
      ev.key !== "Home" &&
      ev.key !== "End" &&
      ev.key !== " "
    )
      return;
    const t = ev.target as HTMLElement | null;
    if (
      t &&
      (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)
    )
      return;
    cancelFlight();
  });
  document.addEventListener("nav", () => {
    initTocExplorer();
  });
  document.addEventListener("prenav", () => {
    clearDwell();
  });
}

bindGlobalOnce();
initTocExplorer();
