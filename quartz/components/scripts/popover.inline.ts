import { computePosition, flip, inline, shift } from "@floating-ui/dom";
import { normalizeRelativeURLs } from "../../util/path";
import { fetchCanonical } from "./util";

const p = new DOMParser();
let activeAnchor: HTMLAnchorElement | null = null;

async function mouseEnterHandler(
  this: HTMLAnchorElement,
  { clientX, clientY }: { clientX: number; clientY: number },
) {
  const link = (activeAnchor = this);
  if (link.dataset.noPopover === "true") {
    return;
  }

  async function setPosition(popoverElement: HTMLElement) {
    const { x, y } = await computePosition(link, popoverElement, {
      strategy: "fixed",
      middleware: [inline({ x: clientX, y: clientY }), shift(), flip()],
    });
    Object.assign(popoverElement.style, {
      transform: `translate(${x.toFixed()}px, ${y.toFixed()}px)`,
    });
  }

  function showPopover(popoverElement: HTMLElement) {
    clearActivePopover();
    popoverElement.classList.add("active-popover");
    setPosition(popoverElement as HTMLElement);

    if (hash !== "") {
      const inner = popoverElement.querySelector(
        ".popover-inner",
      ) as HTMLElement | null;
      if (inner) {
        // The cached popover holds the whole article, so restore the full
        // content first: re-hovering another section must start unpruned.
        if (popoverElement.dataset.fullHtml !== undefined) {
          inner.innerHTML = popoverElement.dataset.fullHtml;
        }
        const targetAnchor = `#popover-internal-${hash.slice(1)}`;
        const heading = inner.querySelector(targetAnchor) as HTMLElement | null;
        if (heading) {
          if (popoverElement.dataset.fullHtml === undefined) {
            popoverElement.dataset.fullHtml = inner.innerHTML;
          }
          // Show only this section: drop everything before the target
          // heading and everything from the next same-or-higher-level
          // heading onward. Falls back to scroll-to-heading for
          // non-heading anchors (callouts, tables, ...).
          if (scopeToSection(inner, heading)) {
            inner.scroll({ top: 0, behavior: "instant" });
          } else {
            // leave ~12px of buffer when scrolling to a heading
            inner.scroll({ top: heading.offsetTop - 12, behavior: "instant" });
          }
        }
      }
    }
  }

  // Prune the popover clone down to the section owned by `heading`:
  // the heading plus following siblings up to (excluding) the next
  // heading of the same or higher level. `<hr>` separators carry no
  // section semantics and never terminate. Returns false when `heading`
  // is not a heading element (caller keeps the old scroll behavior).
  function scopeToSection(inner: HTMLElement, heading: HTMLElement): boolean {
    const m = heading.tagName.match(/^H([1-6])$/i);
    if (!m) return false;
    const level = Number(m[1]);
    const parent = heading.parentElement;
    if (!parent) return false;
    const kids = [...parent.children];
    const start = kids.indexOf(heading);
    if (start === -1) return false;
    let end = kids.length;
    for (let i = start + 1; i < kids.length; i++) {
      const mm = kids[i].tagName.match(/^H([1-6])$/i);
      if (mm && Number(mm[1]) <= level) {
        end = i;
        break;
      }
    }
    for (let i = kids.length - 1; i >= end; i--) kids[i].remove();
    for (let i = start - 1; i >= 0; i--) kids[i].remove();
    void inner;
    return true;
  }

  const targetUrl = new URL(link.href);
  const hash = decodeURIComponent(targetUrl.hash);
  targetUrl.hash = "";
  targetUrl.search = "";
  const popoverId = `popover-${link.pathname}`;
  const prevPopoverElement = document.getElementById(popoverId);

  // dont refetch if there's already a popover
  if (!!document.getElementById(popoverId)) {
    showPopover(prevPopoverElement as HTMLElement);
    return;
  }

  const response = await fetchCanonical(targetUrl).catch((err) => {
    console.error(err);
  });

  if (!response) return;
  const rawContentType = response.headers.get("Content-Type");
  if (!rawContentType) return;
  const [contentType] = rawContentType.split(";");
  const [contentTypeCategory, typeInfo] = contentType.split("/");

  const popoverElement = document.createElement("div");
  popoverElement.id = popoverId;
  popoverElement.classList.add("popover");
  const popoverInner = document.createElement("div");
  popoverInner.classList.add("popover-inner");
  popoverInner.dataset.contentType = contentType ?? undefined;
  popoverElement.appendChild(popoverInner);

  switch (contentTypeCategory) {
    case "image":
      const img = document.createElement("img");
      img.src = targetUrl.toString();
      img.alt = targetUrl.pathname;

      popoverInner.appendChild(img);
      break;
    case "application":
      switch (typeInfo) {
        case "pdf":
          const pdf = document.createElement("iframe");
          pdf.src = targetUrl.toString();
          popoverInner.appendChild(pdf);
          break;
        default:
          break;
      }
      break;
    default:
      const contents = await response.text();
      const html = p.parseFromString(contents, "text/html");
      normalizeRelativeURLs(html, targetUrl);
      // prepend all IDs inside popovers to prevent duplicates
      html.querySelectorAll("[id]").forEach((el) => {
        const targetID = `popover-internal-${el.id}`;
        el.id = targetID;
      });
      const elts = [...html.getElementsByClassName("popover-hint")];
      if (elts.length === 0) return;

      elts.forEach((elt) => popoverInner.appendChild(elt));
  }

  if (!!document.getElementById(popoverId)) {
    return;
  }

  document.body.appendChild(popoverElement);
  if (activeAnchor !== this) {
    return;
  }

  showPopover(popoverElement);
}

function clearActivePopover() {
  activeAnchor = null;
  const allPopoverElements = document.querySelectorAll(".popover");
  allPopoverElements.forEach((popoverElement) =>
    popoverElement.classList.remove("active-popover"),
  );
}

function setupPopovers() {
  const links = [
    ...document.querySelectorAll("a.internal"),
  ] as HTMLAnchorElement[];
  for (const link of links) {
    link.addEventListener("mouseenter", mouseEnterHandler);
    link.addEventListener("mouseleave", clearActivePopover);
    window.addCleanup(() => {
      link.removeEventListener("mouseenter", mouseEnterHandler);
      link.removeEventListener("mouseleave", clearActivePopover);
    });
  }
}

document.addEventListener("nav", setupPopovers);
document.addEventListener("render", setupPopovers);
