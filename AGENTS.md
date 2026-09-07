# DocumentControlQC agent guide

## Product

This is an industrial quality-control and document-control application. Optimize for inspectors, QA leads, and read-only viewers completing accurate work under time pressure. Preserve evidence, traceability, and report-printing behavior over visual novelty.

## Frontend direction

- Use `.codex/skills/frontend-taste-grill/SKILL.md` for redesigns, new screens, and visual polish.
- Preserve the graphite, warm-white, and safety-orange identity defined in `src/styles.css`.
- Reuse semantic CSS tokens and existing components before introducing new styles or dependencies.
- Keep the interface precise, calm, information-dense, and industrial. Avoid generic glassmorphism, gratuitous gradients, excessive pills, and decorative animation.
- Keep React and Vite unless a separate architecture task approves a migration.
- Keep status logic centralized in `src/lib/status.js` and persistence logic out of presentation components.

## Required verification

- Run `npm run build` after code changes.
- For perceptible UI changes, run the app and capture screenshots at 1440, 820, and 390 px.
- Check light and dark themes, horizontal overflow, keyboard focus, browser-console errors, and relevant admin/inspector/viewer permissions.
- Exercise the changed workflow with realistic long, empty, and adverse data—not only the ideal state.
- Preserve printable report and MDR pagination when touching shared styles or report components.

## Change discipline

- Make one coherent product slice per change.
- Explain why in comments; do not narrate obvious code.
- Do not hide or delete recorded evidence as a side effect of editing a job order.
- Do not treat `localStorage` as production-safe persistence for documents or approvals.
