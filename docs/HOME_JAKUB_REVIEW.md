# Home interface review — Jakub guidance

Scope: Home only, React/Vite, existing CSS tokens and SVG icon set. References: AGENTS.md, frontend-taste-grill, better-interface and its six domain skills. Base: main d1f296f; its tree matches the starting local code exactly. No assumptions about production account data or SharePoint configuration were introduced.

| Domain | Evidence inspected | Result |
| --- | --- | --- |
| Accessibility | Home native controls, decorative SVGs, focus styles, measured token contrast | Light-theme focus and kicker corrected; browser evidence below |
| Layout | Home grid, banner media bounds, responsive rules | Natural greeting wrapping; media gets reserved phone space |
| Writing | Action labels, scope notes, empty states | Existing operational wording retained |
| Typography | Heading, numeric metrics, wrapping rules | Forced greeting break removed; tabular numbers retained |
| Colors | Shared light/dark tokens, Home backgrounds and primary action | Theme-aware surfaces; one filled banner action |
| UI | Existing icons and component states | Consistent icons, neutral matching queue headers |

| Severity | Domain | Location | Before | After | Why |
| --- | --- | --- | --- | --- | --- |
| HIGH, fixed | Accessibility | src/components/Home.css, banner kicker/focus | Pale text and white focus on light banner | Theme-aware foreground tokens | Text and keyboard location remain visible |
| MEDIUM, fixed | Layout | src/components/Home.jsx, welcome heading | Explicit line break | Natural wrapping | Uses available width before adding a line |
| MEDIUM, fixed | Colors | src/components/Home.css, resource links | Every resource filled with action accent | Quiet neutral resource surfaces | Keeps the primary action distinct |
| MEDIUM, fixed | Layout | src/components/Home.css, mobile artwork | Media competed with greeting | Media placed above the text area | Prevents artwork from obscuring text |
| LOW, fixed | UI | src/components/Home.jsx, Home controls | Text-only controls and inconsistent headers | Existing SVG icon set; matching review/attention header structure | Improves recognition without losing labels |

Verification:
- `npm run check`: 209 tests passed; lint has 0 errors and 83 existing warnings; production build and bundle budget passed.
- Entry JS: 184.5 KB gzip / 200 KB. CSS: 42.3 KB gzip / 45 KB.
- Calculated contrast, light/dark respectively: kicker on surface 5.37/8.10; primary label on primary fill 5.82/5.31; secondary text on secondary surface 4.71/6.80.
- Workspace browser installation timed out; browser checks run in GitHub Actions instead.
- GitHub Actions run 34795742777: 175 browser checks passed, no page errors; 30 screenshots generated across five roles, three widths and two themes. First visual review found the visible artwork still inside the banner; its position was corrected. Final run must confirm this correction.
- Not verified: screen-reader output, Windows forced-colors rendering, production account data, 200% zoom and 320 px viewport. These are not claimed by the automated 1440/820/390 px checks.

Verdict: pending final artwork screenshot. No merge performed.
