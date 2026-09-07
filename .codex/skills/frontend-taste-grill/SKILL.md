---
name: frontend-taste-grill
description: Interrogate vague frontend requests, establish a distinctive visual direction, implement polished React interfaces, and verify responsive, accessible behavior. Use for redesigns, new screens, UI polish, design-system work, or requests to make DocumentControlQC beautiful, premium, modern, usable, or production-ready.
---

# Frontend Taste & Grill

Finish the frontend through evidence-driven design, not decoration. Preserve the product's industrial QC character and operational clarity.

## Workflow

### 1. Read before proposing

- Read the nearest `AGENTS.md`, `src/styles.css`, affected components, and `tasks/plan.md`.
- Run the current app and inspect the affected routes at desktop and phone widths.
- Reuse established tokens and components before adding dependencies or new patterns.

### 2. Grill the brief

Ask only questions whose answers materially change the design. Cover these uncertainties in one compact round when they are not already answered:

1. Primary user and the decision they must make on this screen.
2. Most important action and most dangerous action.
3. Information that must remain visible under time pressure.
4. Desired character, plus interfaces the user likes or rejects.
5. Device, environment, accessibility, and print constraints.

If the user asks Codex to proceed without answering, state the assumptions and continue. Never use questioning to avoid making progress.

### 3. Set the direction

Before a broad redesign, present one recommended direction and at most two alternatives. For each, explain hierarchy, typography, density, color, motion, and the operational tradeoff. Prefer a small representative slice over a full speculative rewrite.

Apply the taste rubric in [references/taste-rubric.md](references/taste-rubric.md). Reject generic dashboard habits that do not encode meaning.

### 4. Implement one coherent slice

- Keep React and Vite; do not migrate frameworks for visual work.
- Keep domain state in the existing status and store helpers instead of duplicating it in components.
- Use semantic HTML and accessible primitives. Add a UI dependency only when it solves a difficult behavior better than the existing code.
- Preserve light/dark themes, touch targets, keyboard operation, reduced motion, and print rules.
- Use progressive disclosure on dense screens. Make the primary action unmistakable and destructive actions quiet until needed.
- Use image generation only for raster artwork, textures, or visual exploration—not text, controls, tables, icons, or layout.

### 5. Prove the result

- Run `npm run build`.
- Exercise the affected workflow, not only the landing state.
- Check 1440, 820, and 390 px; light and dark themes; long/empty/error data; and relevant roles.
- Check keyboard focus, horizontal overflow, browser-console errors, and meaningful accessible names.
- Capture before/after screenshots for perceptible application changes.
- Review the screenshots against the taste rubric. Fix obvious hierarchy, rhythm, clipping, and contrast problems before reporting completion.

## Output contract

For design work, report:

1. **Brief** — user, job, constraints, and assumptions.
2. **Direction** — the chosen visual idea and why it fits.
3. **Changes** — files and behaviors changed.
4. **Proof** — commands, viewports, themes, roles, and screenshots checked.
5. **Remaining debt** — real limitations only; do not manufacture follow-up work.

Do not call a screen premium merely because it has gradients, glass, shadows, large radii, or animation. Quality comes from hierarchy, restraint, precise states, and task completion.
