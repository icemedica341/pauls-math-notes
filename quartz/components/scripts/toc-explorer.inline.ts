// toc-explorer: make the left TOC behave like an explorer (cs-notes port).
// - Depth-0 entries (H1 groups, e.g. ALGEBRA + PRELIMINARIES siblings) get a
//   chevron and collapse/expand their section (following li until the next
//   depth-0). Collapsed groups persist via localStorage.
// - Toolbar with Collapse all / Expand all + A-Z / Z-A sort toggle (cs-notes
//   explorer-loop6/loop7 port). Sort orders sibling entries alphabetically at
//   each level within a group; groups keep document order; dir persists.
const TOC_GROUPS_KEY = "tocGroupsCollapsed"
const TOC_SORT_KEY = "tocSortDir"

function depthOf(li: HTMLLIElement): number {
  const m = Array.from(li.classList).find((c) => /^depth-\d+$/.test(c))
  return m ? Number(m.slice("depth-".length)) : 0
}

function tocList(): HTMLUListElement | null {
  return document.querySelector("ul.toc-content.overflow")
}

function readCollapsed(): Set<string> {
  try {
    const raw = JSON.parse(localStorage.getItem(TOC_GROUPS_KEY) ?? "[]")
    return new Set(Array.isArray(raw) ? raw.filter((s) => typeof s === "string") : [])
  } catch {
    return new Set()
  }
}

function writeCollapsed(set: Set<string>): void {
  try {
    localStorage.setItem(TOC_GROUPS_KEY, JSON.stringify([...set]))
  } catch {
    /* storage unavailable */
  }
}

function readSortDir(): 1 | -1 {
  try {
    return localStorage.getItem(TOC_SORT_KEY) === "desc" ? -1 : 1
  } catch {
    return 1
  }
}

function writeSortDir(dir: 1 | -1): void {
  try {
    localStorage.setItem(TOC_SORT_KEY, dir < 0 ? "desc" : "asc")
  } catch {
    /* storage unavailable */
  }
}

function groupFor(li: HTMLLIElement): HTMLLIElement | null {
  // Nearest preceding li with depth 0 (or itself when depth 0).
  let el: Element | null = li
  if (depthOf(li) === 0) return li
  el = li.previousElementSibling
  while (el) {
    if (el.tagName === "LI" && depthOf(el as HTMLLIElement) === 0) return el as HTMLLIElement
    el = el.previousElementSibling
  }
  return null
}

function applyCollapsed(list: HTMLUListElement, collapsed: Set<string>): void {
  const items = Array.from(list.children).filter(
    (el): el is HTMLLIElement => el.tagName === "LI" && !el.classList.contains("overflow-end"),
  )
  let hidden = false
  for (const li of items) {
    if (depthOf(li) === 0) {
      const slug = li.querySelector(":scope > a[data-for]")?.getAttribute("data-for") ?? ""
      hidden = collapsed.has(slug)
      li.classList.toggle("toc-group", true)
      li.classList.toggle("toc-collapsed", hidden)
      li.classList.remove("toc-hidden")
    } else {
      li.classList.toggle("toc-hidden", hidden)
    }
  }
}

function setGroupCollapsed(list: HTMLUListElement, group: HTMLLIElement, shut: boolean): void {
  const collapsed = readCollapsed()
  const slug = group.querySelector(":scope > a[data-for]")?.getAttribute("data-for") ?? ""
  if (!slug) return
  if (shut) collapsed.add(slug)
  else collapsed.delete(slug)
  writeCollapsed(collapsed)
  applyCollapsed(list, collapsed)
}

function ensureFoldButtons(list: HTMLUListElement): void {
  const items = Array.from(list.children).filter(
    (el): el is HTMLLIElement => el.tagName === "LI" && !el.classList.contains("overflow-end"),
  )
  for (const li of items) {
    if (depthOf(li) !== 0 || li.querySelector(":scope > button.toc-fold")) continue
    const fold = document.createElement("button")
    fold.type = "button"
    fold.className = "toc-fold"
    fold.setAttribute("aria-label", "Toggle section")
    fold.textContent = "▸"
    fold.addEventListener("click", (ev) => {
      ev.preventDefault()
      ev.stopPropagation()
      setGroupCollapsed(list, li, !li.classList.contains("toc-collapsed"))
    })
    li.prepend(fold)
  }
}

// Sort siblings (same depth, same parent) alphabetically; groups keep order.
function applySort(list: HTMLUListElement, dir: 1 | -1, collapsed: Set<string>): void {
  const items = Array.from(list.children).filter(
    (el): el is HTMLLIElement => el.tagName === "LI" && !el.classList.contains("overflow-end"),
  )
  if (items.length < 2) return
  // Build node records with subtree spans: each li owns following lis with greater depth.
  type Node = { li: HTMLLIElement; depth: number; name: string; kids: Node[] }
  const cmp = (a: string, b: string): number => {
    const c = a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" })
    if (c !== 0) return dir < 0 ? -c : c
    if (a === b) return 0
    return (a < b ? -1 : 1) * dir
  }
  const roots: Node[] = []
  const stack: Node[] = []
  for (const li of items) {
    const depth = depthOf(li)
    const name = (li.querySelector(":scope > a")?.textContent ?? "").trim()
    const node: Node = { li, depth, name, kids: [] }
    while (stack.length > 0 && stack[stack.length - 1].depth >= depth) stack.pop()
    if (stack.length === 0) roots.push(node)
    else stack[stack.length - 1].kids.push(node)
    stack.push(node)
  }
  const sortKids = (nodes: Node[]): void => {
    const groups: Node[][] = []
    // Only sort runs of siblings sharing the same depth; depth-0 roots keep order.
    for (const n of nodes) {
      const g = groups[groups.length - 1]
      if (g && g[0].depth === n.depth) g.push(n)
      else groups.push([n])
    }
    for (const g of groups) {
      if (g.length > 1 && g[0].depth > 0) g.sort((a, b) => cmp(a.name, b.name))
      for (const n of g) sortKids(n.kids)
    }
    nodes.length = 0
    for (const g of groups) nodes.push(...g)
  }
  for (const r of roots) sortKids(r.kids)
  const ordered: HTMLLIElement[] = []
  const walk = (nodes: Node[]): void => {
    for (const n of nodes) {
      ordered.push(n.li)
      walk(n.kids)
    }
  }
  walk(roots)
  const end = list.querySelector(".overflow-end")
  for (const li of ordered) list.insertBefore(li, end)
  applyCollapsed(list, collapsed)
}

function allShut(list: HTMLUListElement): boolean {
  const groups = Array.from(list.children).filter(
    (el): el is HTMLLIElement =>
      el.tagName === "LI" && depthOf(el) === 0 && !el.classList.contains("overflow-end"),
  )
  return groups.length > 0 && groups.every((g) => g.classList.contains("toc-collapsed"))
}

function refreshToolbar(bar: HTMLElement, list: HTMLUListElement): void {
  const toggle = bar.querySelector('[data-toc="toggle-all"]')
  if (toggle) {
    const shut = allShut(list)
    toggle.textContent = shut ? "Expand all" : "Collapse all"
    toggle.setAttribute("aria-pressed", shut ? "false" : "true")
  }
  const sort = bar.querySelector('[data-toc="toggle-sort"]')
  if (sort) {
    const desc = readSortDir() < 0
    sort.textContent = desc ? "Z-A" : "A-Z"
    sort.setAttribute("aria-pressed", desc ? "true" : "false")
  }
}

function ensureToolbar(list: HTMLUListElement): void {
  const toc = list.closest("div.toc")
  if (!toc) return
  let bar = toc.querySelector(":scope > .toc-explorer-toolbar")
  if (!bar) {
    bar = document.createElement("div")
    bar.className = "toc-explorer-toolbar"
    bar.setAttribute("role", "toolbar")
    bar.setAttribute("aria-label", "Table of contents view options")
    const toggle = document.createElement("button")
    toggle.type = "button"
    toggle.className = "toc-explorer-btn"
    toggle.setAttribute("data-toc", "toggle-all")
    toggle.addEventListener("click", (ev) => {
      ev.stopPropagation()
      const collapsed = readCollapsed()
      const groups = Array.from(list.children).filter(
        (el): el is HTMLLIElement => el.tagName === "LI" && depthOf(el) === 0,
      )
      const shut = !allShut(list)
      for (const g of groups) {
        const slug = g.querySelector(":scope > a[data-for]")?.getAttribute("data-for") ?? ""
        if (!slug) continue
        if (shut) collapsed.add(slug)
        else collapsed.delete(slug)
      }
      writeCollapsed(collapsed)
      applyCollapsed(list, collapsed)
      refreshToolbar(bar as HTMLElement, list)
    })
    const sort = document.createElement("button")
    sort.type = "button"
    sort.className = "toc-explorer-btn"
    sort.setAttribute("data-toc", "toggle-sort")
    sort.title = "Toggle sort direction"
    sort.addEventListener("click", (ev) => {
      ev.stopPropagation()
      const next: 1 | -1 = readSortDir() < 0 ? 1 : -1
      writeSortDir(next)
      ensureFoldButtons(list)
      applySort(list, next, readCollapsed())
      refreshToolbar(bar as HTMLElement, list)
    })
    bar.append(toggle, sort)
    const header = toc.querySelector(":scope > button.toc-header")
    if (header?.nextSibling) header.parentNode?.insertBefore(bar, header.nextSibling)
    else toc.prepend(bar)
  }
  refreshToolbar(bar as HTMLElement, list)
}

function bindTocExplorer(): void {
  const list = tocList()
  if (!list || list.dataset.explorerBound) return
  list.dataset.explorerBound = "1"
  ensureFoldButtons(list)
  ensureToolbar(list)
  const collapsed = readCollapsed()
  const dir = readSortDir()
  if (dir < 0) applySort(list, dir, collapsed)
  else applyCollapsed(list, collapsed)
  // Reveal the active entry's group so scrollspy targets never hide.
  const showActive = (): void => {
    const active = list.querySelector("a.in-view")
    const li = active?.closest("li")
    if (!li) return
    const group = groupFor(li as HTMLLIElement)
    if (group?.classList.contains("toc-collapsed")) {
      setGroupCollapsed(list, group, false)
      const bar = list.closest("div.toc")?.querySelector(":scope > .toc-explorer-toolbar")
      if (bar) refreshToolbar(bar as HTMLElement, list)
    }
  }
  document.addEventListener("nav", showActive)
  new MutationObserver(() => {
    const bar = list.closest("div.toc")?.querySelector(":scope > .toc-explorer-toolbar")
    if (bar) refreshToolbar(bar as HTMLElement, list)
  }).observe(list, { attributes: true, subtree: true, attributeFilter: ["class"] })
  showActive()
}

document.addEventListener("nav", bindTocExplorer)
document.addEventListener("render", bindTocExplorer)
bindTocExplorer()
