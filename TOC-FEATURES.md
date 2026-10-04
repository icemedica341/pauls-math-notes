# Paul's Math Notes — TOC Features (TOC-as-Explorer)

The left sidebar is a Table of Contents styled and behaving like the cs-notes
explorer. Single-note site: the TOC replaces the explorer entirely.
Order is fixed (no sorting). This file is the contract: every item below
MUST hold, manually verified in the browser at 1280px and 1920px (no committed test suite; see ADR).

## F1 — Structure

- 117 entries total. Depth-0 entries WITH children are collapsible groups.
- Childless entries (leaves, empty groups) show NO chevron and NO toggle.
- Collapse-all / Expand-all toolbar buttons exist. NO sort toggle anywhere.

## F2 — Dwell popup

- Hovering a TRUNCATED entry (scrollWidth > clientWidth) for ~450ms shows a
  fixed-position, single-line (`nowrap`) popup with the full entry text.
- Fully-visible entries NEVER show a popup, no matter how long the hover.
- Mouse-leave cancels a pending or visible popup. Touch behavior unchanged.
- Popup causes ZERO layout shift (overlay, not in-flow).

## F3 — Chevron

- cs-notes-style SVG chevron, ONLY on collapsible groups.
- Click toggles collapse/expand of that group. Collapsed state is memory-only:
  it resets on every load/navigation (no localStorage). Scrollspy auto-expands
  the active entry's group.

## F4 — Indent guides

- Depth-1+ entries carry left indent guides: 1px solid `#eee7dd`,
  6px margin, 0.8rem padding — identical to the cs-notes explorer per depth.

## F5 — Scroll

- The TOC pane scrolls independently (`overflow: hidden auto` + max-height).
- Page scroll position is never moved by TOC behavior.

## F6 — Scrollspy

- Exactly ONE entry highlighted (the section in view). Highlight follows
  scrolling dynamically (single-active, not cumulative).
- The TOC pane auto-nudges (nearest-edge) to keep the active entry visible.

## F7 — Toolbar

- Collapse-all and Expand-all buttons work across all groups.
- No A-Z/Z-A control (order is fixed by document structure).

## F8 — Build

- `npx quartz build` exits 0 and emits 51 files (53 pre-R8 minus the 2 suppressed stock TOC script bundles).

## Verify (Playwright)

Per item: F1 count chevrons == collapsible groups; F2 hover visible entry
(0 popups) + hover truncated entry (popup after ~450ms, exact text);
F3 click toggles (in-session only; state resets on reload); F4 computed-style guides per depth;
F5 TOC pane scrolls while page stays; F6 scroll page → single highlight
moves + pane nudges; F8 build EXIT 0 + file count.
