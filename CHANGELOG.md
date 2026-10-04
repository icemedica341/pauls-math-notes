# Changelog — deviations from the author's original notes

This log records every edit made to the original Feb–Mar 2025 study notes during the Markdown/Quartz conversion and later correction passes. One line per change: what was wrong → what it is now.

## 2026-10-03 — math corrections (commit 44877f1, 29 fixes)

- Equivalence relation: bare `f(a)=f(b) → a=b` → added plain-words gloss (never repeats an output / horizontal-line test forces `a=b`).
- Fraction equation restriction: `x ≠ 1, x ≠ 0` → `x ≠ -1, x ≠ 0` (denominator `x+1`).
- Follow-up check: `x = 1` does not violate `x ≠ 1` → does not violate `x ≠ -1`.
- Triangle inequality note: added "(equality only for a degenerate flat triangle — a straight line with no height, not a proper triangle)".
- Integer-exponent example chain: author's working replaced with `1/(4a⁶b²)·1/(6a⁶) = 1/(24a¹²b²)` (LATER CORRECTED — see 2026-10-03 batch below).
- Vieta sum of roots: `b/a = x₁+x₂` → `-b/a = x₁+x₂`.
- Imaginary-number warning: `√ab ≠ √((-a)(-b))` → `√(-a)·√(-b) ≠ √ab (for a,b>0)`.
- False identity removed: deleted `--√ab = √((-a)(b)) = √((a)(-b))`.
- Complex modulus trivial case: "will just be a or b itself" → `|a+0i|=|a|`, `|0+bi|=|b|`.
- Rational-expression zeros: `t ≠ -4, t → -1` → `t=-4, t=-1` (these are the excluded values/solutions, not fresh restrictions).
- Set-minus notation: `ℝ \ x ≠ 1` → `ℝ\{1}`.
- Parabola coefficient: "Slope is `a`" → "`a` determines steepness and opening direction (steep vs gentle, up vs down)".
- Perpendicular slope: author's sentence extended with "and reciprocal magnitude, i.e. `m⊥ = -1/m`" (LATER REWORDED — see 2026-10-03 batch below).
- Finding range: author's "no domain restrictions → no range restrictions, i.e. ℝ" → "A domain of ℝ doesn't guarantee a range of ℝ (e.g. `y=x²` has range `[0,∞)`) — check the shape" (LATER REWORDED — see 2026-10-03 batch below).
- Inverse-function principal ranges: vague "`-π/2` to `π/2`" → arcsin `[-π/2,π/2]`, arccos `[0,π]`, arctan `(-π/2,π/2)`.
- Parabola vertex: `(c-b²)/(4a)` "x part of the vertex" → `xᵥ=-b/(2a)`, `yᵥ=(4ac-b²)/(4a)`.
- Even-root note: "Where `n` is a multiple of 2" → "Where `k` is even".
- `√(-x)` mention: plain text → `$\sqrt{-x}$` math formatting.
- Odd radicals: `y = nx` typo → `y = ⁿ√x`.
- Inverse composition: `G⁻¹G = 1` removed, kept `G⁻¹G(w) = w`.
- Inverse procedure: "let `x = f⁻¹(x)`" → "solve `y=f(x)` for `x`, then swap `x` and `y`".
- Symmetry example: "examples such as 1x" → "examples such as `y=x`".
- Asymptote limit testing: "as `y` tends to `∞`" → "as `x → ±∞`".
- Asymptote approximations: `y ≈ x as y → ∞` → `y ≈ x` (no asymptote); `y ≈ 1/x as y → 0` → `y ≈ 1/x → 0` (i.e. `y → 0` as `x → ∞`).
- Graph parity at roots: "annotate even-powered factors because polarity changes" → odd-powered factors cross the x-axis, even-powered touch and stay.
- Partial fractions (repeated quadratic): `Bx+C` second numerator → `Cx+D` (two lines).
- Partial-fraction coefficient: `C + 0 = 16 → C = 16` → `C + 16 = 16 → C = 0`.
- Euler's number digits: `2.18281828459045…` → `2.7182818284…`.
- Circle area formula: `r²` → `πr²`.
- Radian bound: "angle is less than 2" → "less than `2π`" (with modulo into `2π`).
- Degree/radian conversion: second line `180/π · Degrees = Radians` → `180/π · Radians = Degrees`.

## 2026-10-03 — content-only correction batch

- Integer exponents: reverted the `1/(24a¹²b²)` rewrite; restored the author's original chain `(2a³b⁻²)²·(3a⁻¹b³/18a⁵b⁻⁴) = 4a⁶b⁻⁴·3a⁻¹b³/18a⁵b⁻⁴ = … = 2b³/3`, adding only `\;` spacing around `=` signs. Final `2b³/3` stands.
- Finding range: replaced the prior-pass deletion with the author's-voice reword "Knowing x can be anything tells you nothing about y. To find the range, look at the shape of the graph — its lowest and highest points, and where it goes. (e.g. `y=x²`: x can be anything, but y never goes below 0.)".
- Perpendicular slope: kept the author's "A perpendicular line has slope of opposite direction and magnitude" and appended "i.e. if one line has slope `m`, the perpendicular has slope `−1/m`."
- Disclaimer added (README.md and top of content/index.md as a `[!note]` callout): "These are my personal study notes — my understanding at the time, not a textbook. Some of it has mistakes; use at your own discretion."

## 2026-10-04 — TOC refactor + dark-mode restore + dead-file removal

- TOC script split: `toc.inline.ts` is now the entry over `toc-collapse.ts` / `toc-dwell.ts` / `toc-scrollspy.ts`; stock TOC `afterDOMLoaded` suppressed in `componentResources.ts` so the custom script owns the pane (build now emits 51 files, was 53).
- Single-page layout narrowed: 2-column grid without `!important`, mobile stack restored; `.center` 900px cap restored via scoped `min-width: 0`; `a.internal` pill reset; deep headings sized via CSS (h4 1.15rem, h5 1.05rem, h6 1rem).
- Dark-mode body background restored (dropped in refactor merge): `[saved-theme="dark"] body` now follows `var(--light)`.
- Dead files removed per knip: `quartz/util/emoji.ts`, `quartz/util/jsx.tsx` (zero imports); `knip.json` + `dupes` gates added (`TOC-FEATURES.md` F8 corrected to 51 files).
