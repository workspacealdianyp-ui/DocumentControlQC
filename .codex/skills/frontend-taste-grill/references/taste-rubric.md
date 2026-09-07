# Taste rubric

Score each category from 0 to 2. A changed screen should reach at least 16/20 with no zero.

| Category | 0 | 1 | 2 |
|---|---|---|---|
| Purpose | The screen's job is unclear | Purpose is discoverable | Purpose and next action are immediate |
| Hierarchy | Everything competes | Some prioritization | One clear reading order |
| Domain fit | Generic SaaS decoration | Some QC language | Visual structure expresses inspection work |
| Typography | Arbitrary sizes/weights | Mostly consistent | Deliberate scale with readable dense data |
| Rhythm | Uneven spacing/alignment | Minor inconsistencies | Strong grid and repeated spacing logic |
| Color | Decorative or ambiguous | Mostly semantic | Accent and status colors have stable jobs |
| States | Happy path only | Common states covered | Empty, loading, error, disabled, focus, and long data work |
| Responsiveness | Clipping or shrinking | Layout technically fits | Layout reprioritizes for each viewport |
| Accessibility | Inoperable or illegible | Basic labels/contrast | Keyboard, focus, semantics, contrast, and motion are intentional |
| Restraint | Effects compete with content | Some excess | Detail supports comprehension without visual noise |

## Automatic rejection checks

Reject and revise when any applies:

- A second primary action competes with the actual primary action.
- Status is communicated by color alone.
- A desktop table is merely squeezed onto a phone.
- Important controls appear only on hover.
- Decorative copy replaces useful labels.
- New colors, radii, or shadows bypass existing tokens without a reason.
- Empty data leaves a blank panel.
- Animation delays a frequent operational action.
- A visual change breaks print output or dark mode.
- Placeholder content makes the result look better than real long, missing, or adverse data.
