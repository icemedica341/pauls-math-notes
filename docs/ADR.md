# ADR

Load bearing decisions. One line of rationale each.

- Quartz copy of cs-notes, not Hugo: keeps the proven explorer behavior portable without a second stack.
- Single page TOC as explorer, no sort, starts expanded, no memory: document order is the navigation, so persistence would only surprise.
- 450ms dwell, truncated entries only: full text on demand without penalizing readable rows or shifting layout.
- Flight lock scroll ownership: clicks own the pane until settle so scrollspy never fights the user.
- CSS resize over heading promotion: deep headings stay semantic while reading larger.
- P(x) generalization: one notation covers all polynomial cases instead of repeating per degree.
- Short disclaimer framing: personal notes warn once, then stay out of the way.
- Keep author dates truthful: Feb Mar 2025 provenance is fact, conversion dates stay separate.
- Section search, not page search: one long note means ranking pages is meaningless, sections are the unit.
- Whole-page hit removed: the bare page entry duplicated what the reader already sees.
- Single hover ownership: one capture-mouseover guard so preview and dwell never fight.
- Slug alignment: plugin uses the TOC slug rule so every heading has exactly one anchor.
- Honest plugin build: dist is regenerated from src with a drift gate, never hand-edited.
- No committed e2e suite: claims say manually verified; a suite nobody maintains is worse than an honest sentence.
