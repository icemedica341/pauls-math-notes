// TOC explorer: faithful flat-list port of the cs-notes explorer stack
// (upstream @quartz-community/explorer + explorer-loop6 index.js toolbar +
// explorer-loop7 loop7.js locate+centre), adapted to the Quartz
// table-of-contents list: ul.toc-content.overflow > li.depth-N.
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
type TOCEntry = { li: HTMLLIElement; link: HTMLAnchorElement; depth: number; id: string }

// In-memory only: collapsed entry slugs for this page view. Empty at load.
let collapsedGroups = new Set<string>()

const OVERFLOW_END = "overflow-end"
const DWELL_DELAY_MS = 450
const SCROLLSPY_THRESHOLD_PX = 140
// Click flight: a TOC click owns both scrollers until the flight ends.
// The lock freezes the highlight on the clicked row AND suppresses
// pane-follow (full scrollspy suppression); it releases when scrolling
// settles, at an absolute cap, or the moment the user grabs
// input (wheel/touch/pointerdown/scroll-keys) — the user always wins.
// The lock suppresses pane-follow (scrollspy still highlights); it releases
// when scrolling settles, at an absolute cap, or the moment the user grabs
// input (wheel/touch/pointerdown/scroll-keys) — the user always wins.
const FLIGHT_SETTLE_MS = 160
const FLIGHT_MAX_MS = 3000
// The clicked heading lands this far below the viewport top: inside the
// scrollspy threshold so the settled-section resync selects the clicked row.
const CLICK_LAND_OFFSET_PX = 120
let clickFlightUntil = 0
let flightSettleTimer: number | null = null
let flightMaxTimer: number | null = null

/** TOC labels must not show the `--- ` section-marker prefix (content keeps it). */
function stripMarkerPrefix(label: string): string {
  return label.replace(/^(\s*)---\s+/, "$1")
}

function normalizeLabels(list: HTMLUListElement): void {
  for (const entry of collectEntries(list)) {
    const text = entry.link.textContent ?? ""
    const stripped = stripMarkerPrefix(text)
    if (stripped !== text) entry.link.textContent = stripped
  }
}

function isOverflowEnd(li: HTMLLIElement): boolean {
  return li.classList.contains(OVERFLOW_END)
}

function depthOf(li: HTMLLIElement): number {
  for (const cls of Array.from(li.classList)) {
    const m = /^depth-(\d+)$/.exec(cls)
    if (m) return parseInt(m[1], 10)
  }
  return 0
}

/** Flat rows of one TOC list, in document order. */
function collectEntries(list: HTMLUListElement): TOCEntry[] {
  const out: TOCEntry[] = []
  for (const child of Array.from(list.children)) {
    if (!(child instanceof HTMLLIElement) || isOverflowEnd(child)) continue
    const link = child.querySelector(":scope > a[data-for]") as HTMLAnchorElement | null
    if (!link) continue
    const id = link.dataset.for ?? ""
    if (!id) continue
    out.push({ li: child, link, depth: depthOf(child), id })
  }
  return out
}

/**
 * Stack-based parent map: parentOf[i] is the nearest preceding row with a
 * smaller depth that owns row i, or null for top-level rows. A row owns
 * children (is a collapsible parent) when the next row is deeper.
 */
function buildParents(entries: TOCEntry[]): (number | null)[] {
  const parentOf: (number | null)[] = new Array(entries.length).fill(null)
  const stack: number[] = []
  entries.forEach((entry, i) => {
    while (stack.length > 0 && entries[stack[stack.length - 1]].depth >= entry.depth) {
      stack.pop()
    }
    parentOf[i] = stack.length > 0 ? stack[stack.length - 1] : null
    stack.push(i)
  })
  return parentOf
}

function ownsChildren(entries: TOCEntry[], index: number): boolean {
  return index + 1 < entries.length && entries[index + 1].depth > entries[index].depth
}

function parentIds(entries: TOCEntry[]): string[] {
  const ids: string[] = []
  entries.forEach((entry, i) => {
    if (ownsChildren(entries, i)) ids.push(entry.id)
  })
  return ids
}

/** A row is hidden when any ancestor group is collapsed. */
function isHiddenByAncestor(
  entries: TOCEntry[],
  parentOf: (number | null)[],
  index: number,
): boolean {
  let p = parentOf[index]
  while (p !== null) {
    if (collapsedGroups.has(entries[p].id)) return true
    p = parentOf[p]
  }
  return false
}

// --- collapse / expand ------------------------------------------------------
function refreshList(list: HTMLUListElement): void {
  const entries = collectEntries(list)
  const parentOf = buildParents(entries)
  entries.forEach((entry, i) => {
    const isParent = ownsChildren(entries, i)
    entry.li.classList.toggle("toc-collapsed", isParent && collapsedGroups.has(entry.id))
    entry.li.classList.toggle("toc-hidden", isHiddenByAncestor(entries, parentOf, i))
    const fold = entry.li.querySelector(":scope > button.toc-fold") as HTMLButtonElement | null
    if (fold) fold.setAttribute("aria-expanded", String(!(isParent && collapsedGroups.has(entry.id))))
  })
  refreshToolbarLabel(list)
}

function setGroupCollapsed(list: HTMLUListElement, groupId: string, collapsed: boolean): void {
  if (collapsed) collapsedGroups.add(groupId)
  else collapsedGroups.delete(groupId)
  refreshList(list)
}

function collapseAll(list: HTMLUListElement): void {
  for (const id of parentIds(collectEntries(list))) collapsedGroups.add(id)
  refreshList(list)
}

function expandAll(list: HTMLUListElement): void {
  collapsedGroups.clear()
  refreshList(list)
}

// --- chevron fold buttons (copies the cs-notes explorer chevron verbatim:
// 12x12 svg, viewBox "5 8 14 8", polyline "6 9 12 15 18 9") ------------------
const CHEVRON_SVG =
  `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="5 8 14 8" ` +
  `fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" ` +
  `stroke-linejoin="round" class="toc-fold-icon"><polyline points="6 9 12 15 18 9"></polyline></svg>`

function ensureFoldButtons(list: HTMLUListElement): void {
  const entries = collectEntries(list)
  entries.forEach((entry, i) => {
    const isParent = ownsChildren(entries, i)
    const existing = entry.li.querySelector(":scope > button.toc-fold") as HTMLButtonElement | null
    if (!isParent) {
      existing?.remove()
      return
    }
    if (existing) return
    const btn = document.createElement("button")
    btn.type = "button"
    btn.className = "toc-fold"
    btn.setAttribute("aria-label", "Toggle section")
    btn.setAttribute("aria-expanded", "true")
    btn.innerHTML = CHEVRON_SVG
    btn.addEventListener("click", (ev) => {
      ev.preventDefault()
      ev.stopPropagation()
      setGroupCollapsed(list, entry.id, !collapsedGroups.has(entry.id))
    })
    entry.li.prepend(btn)
  })
}

// --- Collapse all / Expand all toolbar (loop6 flip-label pattern, no sort) --
// Sits directly UNDER the title, like the loop6 toolbar under Explorer.
function ensureToolbar(list: HTMLUListElement): void {
  const pane = list.closest(".toc") as HTMLElement | null
  if (!pane) return
  let bar = pane.querySelector(":scope > .toc-explorer-toolbar") as HTMLDivElement | null
  if (!bar) {
    bar = document.createElement("div")
    bar.className = "toc-explorer-toolbar"
    bar.setAttribute("role", "toolbar")
    bar.setAttribute("aria-label", "Explorer view options")
    const btn = document.createElement("button")
    btn.type = "button"
    btn.className = "toc-explorer-btn"
    btn.addEventListener("click", () => {
      const entries = collectEntries(list)
      const allCollapsed = parentIds(entries).every((id) => collapsedGroups.has(id))
      if (allCollapsed) expandAll(list)
      else collapseAll(list)
    })
    bar.appendChild(btn)
    // Directly underneath the title (cs-notes parity): header first, toolbar second.
    const header = pane.querySelector(":scope > button.toc-header") as HTMLElement | null
    if (header) header.after(bar)
    else pane.prepend(bar)
  }
}

function refreshToolbarLabel(list: HTMLUListElement): void {
  const pane = list.closest(".toc") as HTMLElement | null
  const btn = pane?.querySelector(":scope > .toc-explorer-toolbar > .toc-explorer-btn") as
    | HTMLButtonElement
    | null
  if (!btn) return
  const entries = collectEntries(list)
  const parents = parentIds(entries)
  const allCollapsed = parents.length > 0 && parents.every((id) => collapsedGroups.has(id))
  btn.textContent = allCollapsed ? "Expand all" : "Collapse all"
}

// --- dwell: overlay with the full text of TRUNCATED entries only -------------
let dwellTimer: number | null = null
let dwellOverlay: HTMLDivElement | null = null
let dwellTarget: HTMLAnchorElement | null = null

function clearDwell(): void {
  if (dwellTimer !== null) {
    window.clearTimeout(dwellTimer)
    dwellTimer = null
  }
  dwellOverlay?.remove()
  dwellOverlay = null
  dwellTarget = null
}

function isTruncated(link: HTMLAnchorElement): boolean {
  return link.scrollWidth > link.clientWidth + 1
}

/** Fixed overlay aligned exactly over the row: same row styling, weight normal. */
function showDwellOverlay(link: HTMLAnchorElement): void {
  clearDwell()
  const rect = link.getBoundingClientRect()
  const cs = window.getComputedStyle(link)
  const overlay = document.createElement("div")
  overlay.className = "toc-dwell-inline"
  overlay.textContent = link.textContent ?? ""
  overlay.style.left = `${rect.left}px`
  overlay.style.top = `${rect.top}px`
  overlay.style.height = `${rect.height}px`
  overlay.style.font = cs.font
  overlay.style.fontWeight = "normal"
  overlay.style.color = cs.color
  overlay.style.background = cs.backgroundColor
  overlay.style.paddingLeft = cs.paddingLeft
  overlay.style.paddingRight = "0px"
  overlay.setAttribute("aria-hidden", "true")
  document.body.appendChild(overlay)
  dwellOverlay = overlay
  dwellTarget = link
}

function armDwell(link: HTMLAnchorElement): void {
  clearDwell()
  // Touch / coarse pointers have no hover dwell.
  if (window.matchMedia("(hover: none)").matches) return
  dwellTarget = link
  dwellTimer = window.setTimeout(() => {
    dwellTimer = null
    if (isTruncated(link)) showDwellOverlay(link)
  }, DWELL_DELAY_MS)
}

// --- scrollspy: single active highlight, pane centres the active entry ------
// (loop7 locateCentre/centreLink ported to the TOC pane: native smooth
// scrollTo from the CURRENT pane position, page scroll never touched, no
// stored positions ever reused).
let spyTicking = false

function centreActiveEntry(list: HTMLUListElement, link: HTMLAnchorElement): void {
  // The entry lands on the whole LEFT SIDEBAR column's midpoint, not the
  // TOC list box's middle. Native smooth scrollTo from the CURRENT pane
  // position; the page scroll is never touched.
  try {
    const side = list.closest(".sidebar.left") as HTMLElement | null
    const refRect = (side ?? list).getBoundingClientRect()
    const linkRect = link.getBoundingClientRect()
    const target =
      list.scrollTop +
      (linkRect.top + linkRect.height / 2) -
      (refRect.top + refRect.height / 2)
    const max = list.scrollHeight - list.clientHeight
    const clamped = Math.max(0, Math.min(isFinite(target) ? target : 0, Math.max(0, max)))
    list.scrollTo({ top: clamped, behavior: "smooth" })
  } catch {
    // Pane centering is best-effort; the highlight is the contract.
  }
}

function clampPaneScroll(list: HTMLUListElement, target: number): number {
  const max = list.scrollHeight - list.clientHeight
  return Math.max(0, Math.min(isFinite(target) ? target : 0, Math.max(0, max)))
}

/** Clamp a page scroll target into the valid range so nothing overshoots. */
function clampPageScroll(target: number): number {
  const max = document.documentElement.scrollHeight - window.innerHeight
  return Math.max(0, Math.min(isFinite(target) ? target : 0, Math.max(0, max)))
}

function inFlight(): boolean {
  return Date.now() < clickFlightUntil
}

function clearFlightTimers(): void {
  if (flightSettleTimer !== null) {
    window.clearTimeout(flightSettleTimer)
    flightSettleTimer = null
  }
  if (flightMaxTimer !== null) {
    window.clearTimeout(flightMaxTimer)
    flightMaxTimer = null
  }
}

/** Release the lock and resync follow to the settled section. */
function releaseFlight(): void {
  clearFlightTimers()
  clickFlightUntil = 0
  requestSpyTick()
}

/** No scroll events for a beat means the flight has landed. */
function armSettleTimer(): void {
  if (flightSettleTimer !== null) window.clearTimeout(flightSettleTimer)
  flightSettleTimer = window.setTimeout(() => {
    flightSettleTimer = null
    if (inFlight()) releaseFlight()
  }, FLIGHT_SETTLE_MS)
}

/**
 * User wheel/touch/pointer/key input cancels a click flight: the user owns
 * scroll. In-flight smooth scrolls are aborted by snapping to the current
 * position, then follow resyncs to wherever the user left things.
 */
function cancelFlight(): void {
  if (!inFlight()) return
  const list = document.querySelector("ul.toc-content.overflow") as HTMLUListElement | null
  try {
    // Snapping to the current position aborts an in-flight smooth scroll.
    if (list) list.scrollTo({ top: clampPaneScroll(list, list.scrollTop), behavior: "auto" })
    window.scrollTo({ top: clampPageScroll(window.scrollY), behavior: "auto" })
  } catch {
    // Best-effort only.
  }
  releaseFlight()
}

function scrollSpyTick(): void {
  spyTicking = false
  // Click-flight hard freeze: the highlight is locked to the clicked row
  // for the whole flight — zero scrollspy updates until release.
  if (inFlight()) return
  const list = document.querySelector("ul.toc-content.overflow") as HTMLUListElement | null
  if (!list) return
  const entries = collectEntries(list)
  if (entries.length === 0) return
  const targets: { id: string; top: number }[] = []
  for (const entry of entries) {
    const el = document.getElementById(entry.id)
    if (!el) continue
    targets.push({ id: entry.id, top: el.getBoundingClientRect().top })
  }
  if (targets.length === 0) return
  let current = targets[0].id
  for (const t of targets) {
    if (t.top <= SCROLLSPY_THRESHOLD_PX) current = t.id
  }
  let changed = false
  for (const entry of entries) {
    const active = entry.id === current
    if (entry.link.classList.contains("active") !== active) {
      entry.link.classList.toggle("active", active)
      changed = true
    }
  }
  if (!changed) return
  // Pane-follow only: the highlight above is already final; centre it.
  // Expand ancestors of the newly-active entry (loop7 expandAncestors) so the
  // centred row is always visible, then centre it in the pane only.
  const activeIndex = entries.findIndex((entry) => entry.id === current)
  if (activeIndex >= 0) {
    const parentOf = buildParents(entries)
    let p = parentOf[activeIndex]
    while (p !== null) {
      collapsedGroups.delete(entries[p].id)
      p = parentOf[p]
    }
    refreshList(list)
  }
  const activeLink = list.querySelector("a[data-for].active") as HTMLAnchorElement | null
  if (!activeLink) return
  centreActiveEntry(list, activeLink)
}

function requestSpyTick(): void {
  if (spyTicking) return
  spyTicking = true
  window.requestAnimationFrame(scrollSpyTick)
}

// --- boot -------------------------------------------------------------------
function resetForPage(): void {
  collapsedGroups = new Set<string>()
  clearDwell()
}

function initTocExplorer(): void {
  resetForPage()
  const lists = Array.from(
    document.querySelectorAll("ul.toc-content.overflow"),
  ) as HTMLUListElement[]
  for (const list of lists) {
    ensureFoldButtons(list)
    normalizeLabels(list)
    ensureToolbar(list)
    refreshList(list)
  }
  requestSpyTick()
}

function bindGlobalOnce(): void {
  const doc = document as Document & { __tocExplorerBound?: boolean }
  if (doc.__tocExplorerBound) return
  doc.__tocExplorerBound = true

  // Delegated dwell: fires only for truncated entries, in place.
  document.addEventListener(
    "mouseover",
    (ev) => {
      const link = (ev.target as HTMLElement | null)?.closest?.(
        "ul.toc-content.overflow > li > a[data-for]",
      ) as HTMLAnchorElement | null
      if (!link || link === dwellTarget) return
      armDwell(link)
    },
    true,
  )
  document.addEventListener(
    "mouseout",
    (ev) => {
      const link = (ev.target as HTMLElement | null)?.closest?.(
        "ul.toc-content.overflow > li > a[data-for]",
      ) as HTMLAnchorElement | null
      if (link && link === dwellTarget) clearDwell()
    },
    true,
  )
  document.addEventListener("scroll", clearDwell, true)
  document.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape") clearDwell()
  })

  window.addEventListener("scroll", requestSpyTick, { passive: true })
  // A quiet window means the flight has landed: re-arm on every scroll.
  window.addEventListener(
    "scroll",
    () => {
      if (inFlight()) armSettleTimer()
    },
    { passive: true },
  )
  window.addEventListener("resize", requestSpyTick)

  // Click flight: engage the lock (highlight frozen + pane-follow suppressed
  // so scrollspy ticks cannot touch the highlight or fight the animation),
  // ticks cannot fight the animation), smooth-scroll the pane from its
  // CURRENT position to centre the target AND smooth-scroll the page to
  // the section (both targets clamped). The lock releases when the flight
  // settles, at an absolute cap, or on user input (user wins); on release
  // the follow resyncs to the settled section.
  document.addEventListener("click", (ev) => {
    const link = (ev.target as HTMLElement | null)?.closest?.(
      "ul.toc-content.overflow > li > a[data-for]",
    ) as HTMLAnchorElement | null
    if (!link) return
    const section = document.getElementById(link.dataset.for ?? "")
    if (!section) return
    ev.preventDefault()
    // Stock SPA router (spa.inline.ts) also listens for same-page hash clicks
    // and fires an instant scrollIntoView that would abort this smooth flight
    // mid-animation; keep it out so the lock owns both scrollers.
    ev.stopPropagation()
    clearFlightTimers()
    clickFlightUntil = Date.now() + FLIGHT_MAX_MS
    const list = link.closest("ul.toc-content.overflow") as HTMLUListElement | null
    if (list) {
      const entries = collectEntries(list)
      const idx = entries.findIndex((entry) => entry.link === link)
      if (idx >= 0) {
        const parentOf = buildParents(entries)
        let p = parentOf[idx]
        while (p !== null) {
          collapsedGroups.delete(entries[p].id)
          p = parentOf[p]
        }
        refreshList(list)
      }
      for (const entry of entries) {
        entry.link.classList.toggle("active", entry.link === link)
      }
      centreActiveEntry(list, link)
    }
    const top = section.getBoundingClientRect().top + window.scrollY - CLICK_LAND_OFFSET_PX
    window.scrollTo({ top: clampPageScroll(top), behavior: "smooth" })
    try {
      history.replaceState(null, "", `#${link.dataset.for ?? ""}`)
    } catch {
      // URL sync is cosmetic; the scroll is the contract.
    }
    armSettleTimer()
    flightMaxTimer = window.setTimeout(() => {
      flightMaxTimer = null
      if (inFlight()) releaseFlight()
    }, FLIGHT_MAX_MS + 50)
  })
  window.addEventListener("wheel", cancelFlight, { passive: true, capture: true })
  window.addEventListener("touchmove", cancelFlight, { passive: true, capture: true })
  // Grabbing the pane (scrollbar drag, text tap) mid-flight cancels too.
  document.addEventListener(
    "pointerdown",
    (ev) => {
      const pane = (ev.target as HTMLElement | null)?.closest?.("div.toc")
      if (!pane) return
      cancelFlight()
    },
    { passive: true, capture: true },
  )
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
      return
    const t = ev.target as HTMLElement | null
    if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return
    cancelFlight()
  })
  document.addEventListener("nav", () => {
    initTocExplorer()
  })
  document.addEventListener("prenav", () => {
    clearDwell()
  })
}

bindGlobalOnce()
initTocExplorer()
