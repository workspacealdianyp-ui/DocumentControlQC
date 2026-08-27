# Skills

Third-party skills vendored into this repository, kept with their original
licences. They load automatically for anyone running Claude Code in this repo.

| Skill(s) | Upstream | Licence |
|---|---|---|
| `design-taste-frontend/` | [Leonxlnx/taste-skill](https://github.com/Leonxlnx/taste-skill) (`skills/taste-skill`) | MIT |
| `frontend-design/` | [anthropics/skills](https://github.com/anthropics/skills) (`skills/frontend-design`) | Apache-2.0 |
| `impeccable/` (+ `.claude/agents/impeccable-*.md`) | [pbakaus/impeccable](https://github.com/pbakaus/impeccable) | Apache-2.0 |
| the remaining 24 directories | [addyosmani/agent-skills](https://github.com/addyosmani/agent-skills) | MIT (`LICENSE-addyosmani-agent-skills`) |

None of these are authored here. To update one, copy the upstream `SKILL.md`
(and any `reference/` or `scripts/` folder) over the local copy, keeping the
licence file alongside it.

## Not installed on purpose

`pbakaus/impeccable` also ships a `.claude/settings.json` that registers
PostToolUse and Stop **hooks** — they run `scripts/hook.mjs` on every Edit/Write
and at the end of every turn. That file was deliberately left out, so the hook
scripts here stay dormant. Add the upstream settings.json yourself if you want
the automatic design checks; it needs Node 22+.
