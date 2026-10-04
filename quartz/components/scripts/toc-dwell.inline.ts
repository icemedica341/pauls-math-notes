// toc-dwell: reveal a TOC entry's full name only after ~450ms of continuous
// hover (dwell = intent). The timer is cancelled on mouseleave before it
// fires, so quick passes never expand. Touch taps are untouched: bindings
// apply only when the primary input can hover.
//
// The full name renders in a fixed-position popup on ONE line
// (white-space:nowrap): it expands in place over the entry without wrapping
// and without shifting surrounding layout (absolute overlay, never in-flow).
const TOC_DWELL_MS = 450
const TOC_DWELL_POPUP_CLASS = "toc-dwell-popup"

function removeTocDwellPopup(): void {
  document.querySelectorAll(`.${TOC_DWELL_POPUP_CLASS}`).forEach((el) => el.remove())
}

function showTocDwellPopup(a: HTMLAnchorElement): void {
  removeTocDwellPopup()
  const text = (a.textContent ?? "").trim()
  if (!text) return
  const rect = a.getBoundingClientRect()
  const popup = document.createElement("div")
  popup.className = TOC_DWELL_POPUP_CLASS
  popup.textContent = text
  popup.style.left = `${rect.left}px`
  popup.style.top = `${rect.top}px`
  document.body.appendChild(popup)
}

function bindTocDwell(): void {
  if (!window.matchMedia("(hover: hover)").matches) return
  const links = Array.from(
    document.querySelectorAll<HTMLAnchorElement>("ul.toc-content.overflow > li > a"),
  )
  for (const a of links) {
    if (a.dataset.dwellBound) continue
    a.dataset.dwellBound = "1"
    let timer: number | undefined
    a.addEventListener("mouseenter", () => {
      window.clearTimeout(timer)
      timer = window.setTimeout(() => showTocDwellPopup(a), TOC_DWELL_MS)
    })
    a.addEventListener("mouseleave", () => {
      window.clearTimeout(timer)
      removeTocDwellPopup()
    })
  }
}

document.addEventListener("nav", () => {
  removeTocDwellPopup()
  bindTocDwell()
})
document.addEventListener("render", bindTocDwell)
bindTocDwell()
