// Search preview patch: cached, section-scoped hover previews (fixes 4 + 5).
//
// The upstream @quartz-community/search bundle keeps its preview state in
// closure scope, so it can neither be imported nor subclassed. This patch
// works at the DOM contract level instead and touches only
// `.search*` / `.result-card` / `.preview*` nodes (no TOC selectors).
//
// - Fix 4 (cache, keyed by URL+hash): the capture-phase mouseover guard lives in
//   the toc.inline bundle (single mouseover owner, R19) and records the hovered
//   result's href on `document`. When the hovered card is already the focused
//   one, propagation stops before the bundle's bubble-phase results listener
//   can re-run setFocus/updatePreview, so re-hovering never re-clones the
//   ~833KB preview. Fresh fills are additionally cached per key (capped Map)
//   and restored verbatim when the same target re-renders.
// - Fix 5 (section scope): a MutationObserver trims every fresh
//   `.preview-inner` fill to the focused result's URL hash — the `#<hash>`
//   heading plus following siblings up to the next equal/higher-level
//   heading. Unknown anchors keep the whole-article fallback (defensive; every

import {
  FOCUSED_CARD_SELECTOR,
  PREVIEW_CONTAINER_CLASS,
  PREVIEW_INNER_CLASS,
  PREVIEW_SCOPE_SELECTOR,
  readSearchHoverKey,
  resultCardKey,
} from "./search-selectors";
import { applySearchPlaceholder } from "./search-placeholder";

const PREVIEW_CACHE_LIMIT = 20;
const SCOPED_ATTR = "data-scoped";

const previewHtmlCache = new Map<string, string>();

function currentPreviewKey(): string | null {
  const focused = document.querySelector(FOCUSED_CARD_SELECTOR);
  if (focused) return resultCardKey(focused);
  return readSearchHoverKey();
}

function hashCandidates(href: string): string[] {
  const raw = href.split("#")[1] ?? "";
  if (!raw) return [];
  try {
    const decoded = decodeURIComponent(raw);
    return decoded === raw ? [raw] : [raw, decoded];
  } catch {
    return [raw];
  }
}

function findAnchor(root: ParentNode, ids: string[]): Element | null {
  if (ids.length === 0) return null;
  const want = new Set(ids);
  const nodes = root.querySelectorAll("[id]");
  for (const el of Array.from(nodes)) {
    const id = el.getAttribute("id");
    if (id !== null && want.has(id)) return el;
  }
  return null;
}

function headingLevel(tag: string): number | null {
  const m = /^H([1-6])$/.exec(tag.toUpperCase());
  return m ? parseInt(m[1], 10) : null;
}

// Heading plus following siblings up to the next equal/higher-level heading.
// A non-heading anchor stops at any heading (level-7 boundary).
function collectSection(anchor: Element): Element[] {
  const level = headingLevel(anchor.tagName) ?? 7;
  const nodes: Element[] = [anchor];
  let sib = anchor.nextElementSibling;
  while (sib) {
    const sibLevel = headingLevel(sib.tagName);
    if (sibLevel !== null && sibLevel <= level) break;
    nodes.push(sib);
    sib = sib.nextElementSibling;
  }
  return nodes;
}

function clearChildren(el: Element): void {
  while (el.firstChild) el.removeChild(el.firstChild);
}

function scopeFreshPreview(preview: Element): void {
  const inners = Array.from(preview.children).filter(
    (child) =>
      child.classList.contains(PREVIEW_INNER_CLASS) &&
      !child.hasAttribute(SCOPED_ATTR),
  );
  for (const inner of inners) {
    const key = currentPreviewKey();
    if (key === null) {
      inner.setAttribute(SCOPED_ATTR, "unknown");
      continue;
    }
    const cached = previewHtmlCache.get(key);
    if (cached !== undefined) {
      inner.innerHTML = cached;
      inner.setAttribute(SCOPED_ATTR, key);
      preview.scrollTop = 0;
      continue;
    }
    const anchor = findAnchor(inner, hashCandidates(key));
    if (anchor === null) {
      // No hash (lead page entry) or unknown anchor: whole-article fallback.
      inner.setAttribute(SCOPED_ATTR, "full");
      continue;
    }
    const section = collectSection(anchor);
    const frag = document.createDocumentFragment();
    for (const node of section) frag.appendChild(node);
    clearChildren(inner);
    inner.appendChild(frag);
    inner.setAttribute(SCOPED_ATTR, key);
    if (previewHtmlCache.size >= PREVIEW_CACHE_LIMIT) {
      for (const oldest of previewHtmlCache.keys()) {
        previewHtmlCache.delete(oldest);
        break;
      }
    }
    previewHtmlCache.set(key, inner.innerHTML);
    preview.scrollTop = 0;
  }
}

function armPreviewPatch(): void {
  const doc = document as Document & { __searchPreviewPatchBound?: boolean };
  if (doc.__searchPreviewPatchBound) return;
  doc.__searchPreviewPatchBound = true;

  // Single MutationObserver owner (R19): cache and section-scope every fresh
  new MutationObserver((mutations) => {
    const previews = new Set<Element>();
    for (const mutation of mutations) {
      for (const node of Array.from(mutation.addedNodes)) {
        if (!(node instanceof Element)) continue;
        if (node.classList.contains(PREVIEW_CONTAINER_CLASS)) {
          previews.add(node);
        } else if (node.classList.contains(PREVIEW_INNER_CLASS)) {
          if (node.parentElement) previews.add(node.parentElement);
        } else {
          const nested = node.querySelectorAll(PREVIEW_SCOPE_SELECTOR);
          for (const el of Array.from(nested)) {
            previews.add(
              el.classList.contains(PREVIEW_INNER_CLASS) && el.parentElement
                ? el.parentElement
                : el,
            );
          }
        }
      }
    }
    for (const preview of previews) scopeFreshPreview(preview);
    applySearchPlaceholder();
  }).observe(document.documentElement, { childList: true, subtree: true });
}

armPreviewPatch();
