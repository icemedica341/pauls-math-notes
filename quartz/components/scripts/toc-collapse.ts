// toc-collapse.ts — TOC entry model + chevron collapse/expand + toolbar.
// Owns the in-memory collapsed-group state for this page view (empty at load,
// never persisted). Bundled into the toc.inline.ts entry by the inline-script
// esbuild pipeline.
export type TOCEntry = {
  li: HTMLLIElement;
  link: HTMLAnchorElement;
  depth: number;
  id: string;
};

// In-memory only: collapsed entry slugs for this page view. Empty at load.
let collapsedGroups = new Set<string>();

/** Reset collapse state for a fresh page view (replaces direct reassignment). */
export function resetCollapseState(): void {
  collapsedGroups = new Set<string>();
}

const OVERFLOW_END = "overflow-end";

/** TOC list box (single hoisted const; ROW_SELECTOR derives from it). */
export const LIST_SELECTOR = "ul.toc-content.overflow";

/** Row selector for TOC entry links (single hoisted const). */
export const ROW_SELECTOR = `${LIST_SELECTOR} > li > a[data-for]`;

/** Expand every collapsed ancestor of entries[index] (loop7 expandAncestors). */
export function expandAncestors(
  entries: TOCEntry[],
  parentOf: (number | null)[],
  index: number,
): void {
  let p = parentOf[index];
  while (p !== null) {
    collapsedGroups.delete(entries[p].id);
    p = parentOf[p];
  }
}

/** The collapse/expand toolbar container for a TOC list, if present. */
function getToolbar(list: HTMLUListElement): HTMLDivElement | null {
  const pane = list.closest(".toc") as HTMLElement | null;
  return pane?.querySelector(
    ":scope > .toc-explorer-toolbar",
  ) as HTMLDivElement | null;
}

/** True when every collapsible group is collapsed (and at least one exists). */
function allGroupsCollapsed(entries: TOCEntry[]): boolean {
  const parents = parentIds(entries);
  return parents.length > 0 && parents.every((id) => collapsedGroups.has(id));
}

/** TOC labels must not show the `--- ` section-marker prefix (content keeps it). */
function stripMarkerPrefix(label: string): string {
  return label.replace(/^(\s*)---\s+/, "$1");
}

export function normalizeLabels(list: HTMLUListElement): void {
  for (const entry of collectEntries(list)) {
    const text = entry.link.textContent ?? "";
    const stripped = stripMarkerPrefix(text);
    if (stripped !== text) entry.link.textContent = stripped;
  }
}

function isOverflowEnd(li: HTMLLIElement): boolean {
  return li.classList.contains(OVERFLOW_END);
}

function depthOf(li: HTMLLIElement): number {
  for (const cls of Array.from(li.classList)) {
    const m = /^depth-(\d+)$/.exec(cls);
    if (m) return parseInt(m[1], 10);
  }
  return 0;
}

/** Flat rows of one TOC list, in document order. */
export function collectEntries(list: HTMLUListElement): TOCEntry[] {
  const out: TOCEntry[] = [];
  for (const child of Array.from(list.children)) {
    if (!(child instanceof HTMLLIElement) || isOverflowEnd(child)) continue;
    const link = child.querySelector(
      ":scope > a[data-for]",
    ) as HTMLAnchorElement | null;
    if (!link) continue;
    const id = link.dataset.for ?? "";
    if (!id) continue;
    out.push({ li: child, link, depth: depthOf(child), id });
  }
  return out;
}

/**
 * Stack-based parent map: parentOf[i] is the nearest preceding row with a
 * smaller depth that owns row i, or null for top-level rows. A row owns
 * children (is a collapsible parent) when the next row is deeper.
 */
export function buildParents(entries: TOCEntry[]): (number | null)[] {
  const parentOf: (number | null)[] = new Array(entries.length).fill(null);
  const stack: number[] = [];
  entries.forEach((entry, i) => {
    while (
      stack.length > 0 &&
      entries[stack[stack.length - 1]].depth >= entry.depth
    ) {
      stack.pop();
    }
    parentOf[i] = stack.length > 0 ? stack[stack.length - 1] : null;
    stack.push(i);
  });
  return parentOf;
}

function ownsChildren(entries: TOCEntry[], index: number): boolean {
  return (
    index + 1 < entries.length &&
    entries[index + 1].depth > entries[index].depth
  );
}

function parentIds(entries: TOCEntry[]): string[] {
  const ids: string[] = [];
  entries.forEach((entry, i) => {
    if (ownsChildren(entries, i)) ids.push(entry.id);
  });
  return ids;
}

/** A row is hidden when any ancestor group is collapsed. */
function isHiddenByAncestor(
  entries: TOCEntry[],
  parentOf: (number | null)[],
  index: number,
): boolean {
  let p = parentOf[index];
  while (p !== null) {
    if (collapsedGroups.has(entries[p].id)) return true;
    p = parentOf[p];
  }
  return false;
}

// --- collapse / expand ------------------------------------------------------
export function refreshList(list: HTMLUListElement): void {
  const entries = collectEntries(list);
  const parentOf = buildParents(entries);
  entries.forEach((entry, i) => {
    const isParent = ownsChildren(entries, i);
    entry.li.classList.toggle(
      "toc-collapsed",
      isParent && collapsedGroups.has(entry.id),
    );
    entry.li.classList.toggle(
      "toc-hidden",
      isHiddenByAncestor(entries, parentOf, i),
    );
    const fold = entry.li.querySelector(
      ":scope > button.toc-fold",
    ) as HTMLButtonElement | null;
    if (fold)
      fold.setAttribute(
        "aria-expanded",
        String(!(isParent && collapsedGroups.has(entry.id))),
      );
  });
  refreshToolbarLabel(list);
}

function setGroupCollapsed(
  list: HTMLUListElement,
  groupId: string,
  collapsed: boolean,
): void {
  if (collapsed) collapsedGroups.add(groupId);
  else collapsedGroups.delete(groupId);
  refreshList(list);
}

function collapseAll(list: HTMLUListElement): void {
  for (const id of parentIds(collectEntries(list))) collapsedGroups.add(id);
  refreshList(list);
}

function expandAll(list: HTMLUListElement): void {
  collapsedGroups.clear();
  refreshList(list);
}

// --- chevron fold buttons (copies the cs-notes explorer chevron verbatim:
// 12x12 svg, viewBox "5 8 14 8", polyline "6 9 12 15 18 9") ------------------
const CHEVRON_SVG =
  `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="5 8 14 8" ` +
  `fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" ` +
  `stroke-linejoin="round" class="toc-fold-icon"><polyline points="6 9 12 15 18 9"></polyline></svg>`;

export function ensureFoldButtons(list: HTMLUListElement): void {
  const entries = collectEntries(list);
  entries.forEach((entry, i) => {
    const isParent = ownsChildren(entries, i);
    const existing = entry.li.querySelector(
      ":scope > button.toc-fold",
    ) as HTMLButtonElement | null;
    if (!isParent) {
      existing?.remove();
      return;
    }
    if (existing) return;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "toc-fold";
    btn.setAttribute("aria-label", "Toggle section");
    btn.setAttribute("aria-expanded", "true");
    btn.innerHTML = CHEVRON_SVG;
    btn.addEventListener("click", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      setGroupCollapsed(list, entry.id, !collapsedGroups.has(entry.id));
    });
    entry.li.prepend(btn);
  });
}

// --- Collapse all / Expand all toolbar (loop6 flip-label pattern, no sort) --
// Sits directly UNDER the title, like the loop6 toolbar under Explorer.
export function ensureToolbar(list: HTMLUListElement): void {
  const pane = list.closest(".toc") as HTMLElement | null;
  if (!pane) return;
  let bar = getToolbar(list);
  if (!bar) {
    bar = document.createElement("div");
    bar.className = "toc-explorer-toolbar";
    bar.setAttribute("role", "toolbar");
    bar.setAttribute("aria-label", "Explorer view options");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "toc-explorer-btn";
    btn.addEventListener("click", () => {
      const allCollapsed = allGroupsCollapsed(collectEntries(list));
      if (allCollapsed) expandAll(list);
      else collapseAll(list);
    });
    bar.appendChild(btn);
    // Directly underneath the title (cs-notes parity): header first, toolbar second.
    const header = pane.querySelector(
      ":scope > button.toc-header",
    ) as HTMLElement | null;
    if (header) header.after(bar);
    else pane.prepend(bar);
  }
}

function refreshToolbarLabel(list: HTMLUListElement): void {
  const btn = getToolbar(list)?.querySelector(
    ":scope > .toc-explorer-btn",
  ) as HTMLButtonElement | null;
  if (!btn) return;
  const allCollapsed = allGroupsCollapsed(collectEntries(list));
  btn.textContent = allCollapsed ? "Expand all" : "Collapse all";
}
