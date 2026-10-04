// toc-single-active: highlight ONLY the single section currently in view.
//
// The stock TOC observer marks a whole stack of sections above the viewport
// bottom, so several entries stay highlighted and unhighlight intermittently.
// This enforcer runs rAF-throttled on scroll (IO callbacks fire before rAF
// in the same frame, so we always apply after the stock observer) plus on
// SPA nav/render, keeping exactly one `.in-view` link: the last heading
// at/above the viewport threshold, else the first heading.
const TOC_ACTIVE_THRESHOLD = 140

function currentTocTarget(): string | null {
  const headings = Array.from(
    document.querySelectorAll<HTMLElement>("h1[id], h2[id], h3[id], h4[id], h5[id], h6[id]"),
  )
  let current: string | null = null
  for (const h of headings) {
    if (!h.id) continue
    if (h.getBoundingClientRect().top <= TOC_ACTIVE_THRESHOLD) current = h.id
  }
  if (current === null) {
    const first = headings.find((h) => h.id)
    if (first) current = first.id
  }
  return current
}

function enforceSingleActiveToc(): void {
  const links = Array.from(
    document.querySelectorAll<HTMLAnchorElement>("ul.toc-content.overflow > li > a[data-for]"),
  )
  if (links.length === 0) return
  const current = currentTocTarget()
  for (const a of links) {
    a.classList.toggle("in-view", a.dataset.for === current)
  }
  keepActiveTocVisible(links, current)
}

let tocEnforceQueued = false
function queueTocEnforce(): void {
  if (tocEnforceQueued) return
  tocEnforceQueued = true
  requestAnimationFrame(() => {
    tocEnforceQueued = false
    enforceSingleActiveToc()
  })
}

window.addEventListener("scroll", queueTocEnforce, { passive: true })
document.addEventListener("nav", queueTocEnforce)
document.addEventListener("render", queueTocEnforce)
enforceSingleActiveToc()

// Keep the active entry visible inside the TOC pane only (nearest-edge
// nudge via the list's own scrollTop — window scroll is never touched).
// Runs solely on section change, so it cannot fight manual pane scrolling.
let lastTocTarget: string | null = null

function keepActiveTocVisible(links: HTMLAnchorElement[], current: string | null): void {
  if (current === lastTocTarget) return
  lastTocTarget = current
  const active = links.find((a) => a.dataset.for === current)
  const list = active?.closest("ul.toc-content.overflow") as HTMLElement | null
  if (!active || !list) return
  const linkRect = active.getBoundingClientRect()
  const listRect = list.getBoundingClientRect()
  if (linkRect.top < listRect.top) {
    list.scrollTop -= listRect.top - linkRect.top
  } else if (linkRect.bottom > listRect.bottom) {
    list.scrollTop += linkRect.bottom - listRect.bottom
  }
}
