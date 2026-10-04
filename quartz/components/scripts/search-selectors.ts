// search-selectors.ts — stock search DOM contract in one place.
//
// The class names below come from the @quartz-community/search@1.0.0 result
// markup (verified in its dist bundle); bump the version pin if upgrading the
// upstream package renames them. Bundled into the search inline scripts by
// the inline-script esbuild pipeline.
export const SEARCH_INPUT_SELECTOR = "input.search-bar[placeholder]";
// --- upstream @quartz-community/search@1.0.0 contract (pin; update on bump) ---
export const RESULT_CARD_SELECTOR =
  ".search-layout .result-card:not(.no-match)";
export const FOCUSED_CARD_SELECTOR = ".search-layout .result-card.focus";
export const PREVIEW_CONTAINER_CLASS = "preview-container";
export const PREVIEW_INNER_CLASS = "preview-inner";
export const PREVIEW_SCOPE_SELECTOR =
  ".preview-container, .preview-inner:not([data-scoped])";

// Hover-key store (R19): the capture-mouseover guard lives in the toc.inline
// bundle while the preview cache lives in the search-preview-patch bundle, so
// the last-hovered result key crosses bundles on `document`, not module state.
export function resultCardKey(card: Element): string | null {
  return card.getAttribute("href") || card.id || null;
}

export function recordSearchHoverKey(key: string): void {
  const doc = document as Document & { __searchHoverKey?: string | null };
  doc.__searchHoverKey = key;
}

export function readSearchHoverKey(): string | null {
  const doc = document as Document & { __searchHoverKey?: string | null };
  return doc.__searchHoverKey ?? null;
}
