// Search placeholder patch: the @quartz-community/search factory's
// `searchPlaceholder` YAML option never reaches it (the YAML loader drops
// the `options:` key), so the input keeps the stock i18n placeholder.
// This post-render patch sets our faint tip text directly.
// Pure apply fn (R19): called on every page init from toc.inline and on every
// mutation batch by the single MutationObserver owner (search-preview-patch);
// this module owns no listeners and no observer.
import { SEARCH_INPUT_SELECTOR } from "./search-selectors";

const TEXT = "Search sections\u2026 (tip: Ctrl+F finds words on this page)";

export function applySearchPlaceholder(): void {
  const input = document.querySelector(
    SEARCH_INPUT_SELECTOR,
  ) as HTMLInputElement | null;
  if (input && input.placeholder !== TEXT) input.placeholder = TEXT;
}
