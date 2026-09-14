# Current Home refinement — 14 September 2026

The current implementation is code-first; Figma is not a dependency. The historical blueprint below records the first redesign. This section supersedes its graphite-only banner and artwork notes.

- Banner surfaces and copy follow the selected light/dark theme. Existing safety-orange tokens preserve the repository identity.
- Transparent mining artwork extends above the border; at phone widths it has a separate reserved area before the greeting.
- Greetings wrap naturally without an explicit line break. The runtime clock determines the greeting; offline samples use a fixed demonstration date.
- Home buttons have decorative SVG icons and retain their text labels. Review and attention headers share a neutral surface and brand edge; semantic report colors remain unchanged.
- Existing account-specific queues, permissions, report scope and equal-height grid rows remain intact.
- Workspace skills from https://jakub.kr/skills are installed under `.codex/skills`, with upstream provenance and MIT license alongside them. No runtime dependency was added.
- Artwork is a decorative AI-derived cutout, not inspection evidence.

Verification is recorded in `HOME_JAKUB_REVIEW.md`. No merge is performed by this revision.

---

# Home by account

The Home screen puts the signed-in person's next inspection task first. A compact industrial banner follows the supplied mining-equipment reference: graphite background, yellow edge and primary action, equipment on the right, greeting and actions on the left. The yellow accent is specific to this approved banner; the rest of the application retains its existing semantic colors.

## Layout

- Banner, four account-specific readings, and Dashboard / NCR / SharePoint access.
- One primary row of work and attention panels, followed by supporting information.
- Twelve-pixel gaps, compact record rows, a maximum of five reports/jobs per panel, and four customer/workload summaries.
- Panels in the same row stretch to equal height; footers align at their lower edge. There are no fixed-height empty panel placeholders.
- Below 1080px, work panels stack. Below 760px, banner artwork stays beside the greeting, metrics use two columns, and actions have 44px touch targets.
- Names wrap, unavailable dates are labelled, and empty/read-error states explain what is missing.

| Account | Primary work | Supporting content |
|---|---|---|
| Inspector | Own returned reports and drafts; own submitted/approved tracking | Attention jobs and report-type entry |
| Quality Engineer | Eligible submissions, oldest first; own-work switch | Attention jobs, customer progress, report counts |
| QC Supervisor | Eligible submissions, oldest first; own-work switch | Attention jobs, customer progress, author workload |
| QA Lead | Review queue and own-work switch | Customer progress, author workload, documentation readiness |
| Viewer | Job overview and latest approved reports | Customer progress and documentation readiness |

Review eligibility uses the existing approval chain. Home does not approve records. Its links and the report register use the same scope helper so counts, authors, and queue ordering agree at the destination. Workload describes open records, not assigned inspections; completed documentation does not imply release approval. NCR findings may overlap lifecycle counts.

Dashboard opens monitoring and NCR opens the current NCR register. SharePoint displays **Not linked** until `COMPANY.sharepointUrl` contains a valid HTTPS URL. No destination has been invented.

## Design reference and artwork

[Editable Figma draft](https://www.figma.com/design/oFriPPZLabpRrw4pbCzIYo?node-id=3-13), with desktop and mobile frames. Its values are explicitly marked demonstration data. The Starter plan tool limit interrupted the final adjustment of button labels, mobile wrapping, and strip alignment; the Figma draft is therefore not a pixel-perfect record of the shipped CSS.

`src/assets/home-mining.webp` is a 151 KB decorative image derived with image generation from the user's supplied collage. The background was rebuilt in graphite and vehicle details may differ from the original. It is not product documentation or inspection evidence. The image has empty alternative text and is hidden from assistive technology; all useful information remains real HTML text.

## Verification

`npm run check` passes: 209 unit tests, zero lint errors, production build, and the existing JavaScript/CSS budgets. No dependencies were added. Unit coverage includes account isolation, approval eligibility, returned-first and oldest-submission ordering, capped queues, scoped report links, unavailable records, empty scope, and storage failures.

The existing GitHub browser journey now also checks all five roles at 1440, 820, and 390px in light and dark themes. It measures horizontal overflow, equal heights within rows, content-driven panel height, compact banner height, visible keyboard focus, and runtime errors. It saves full-page screenshots in the workflow's `home-layout` artifact. No local browser or laptop session is used.

Offline PDF layout was explored but is not accepted as browser evidence because its grid, flex, and font rendering differ. Figma screenshots were inspected; the remaining draft defects are recorded above. CI results and the merged commit are available in the pull request.
