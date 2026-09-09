# Skills

Third-party skills vendored into this repository, kept with their original
licences. They load automatically for anyone running Claude Code in this repo.

| Skill(s) | Upstream | Licence |
|---|---|---|
| `design-taste-frontend/` | [Leonxlnx/taste-skill](https://github.com/Leonxlnx/taste-skill) (`skills/taste-skill`) | MIT |
| `frontend-design/` | [anthropics/skills](https://github.com/anthropics/skills) (`skills/frontend-design`) | Apache-2.0 |
| `impeccable/` (+ `.claude/agents/impeccable-*.md`) | [pbakaus/impeccable](https://github.com/pbakaus/impeccable) | Apache-2.0 |
| `antislop/` + `antislop-{ui,copywriting,human,layoutmobile,code}/` | [miqdadbadjuber/anti-slop](https://github.com/miqdadbadjuber/anti-slop) @ `568d2f3` (v3.2.6) | MIT (`LICENSE-miqdadbadjuber-antislop`) |
| the remaining 24 directories | [addyosmani/agent-skills](https://github.com/addyosmani/agent-skills) | MIT (`LICENSE-addyosmani-agent-skills`) |

None of these are authored here. To update one, copy the upstream `SKILL.md`
(and any `reference/` or `scripts/` folder) over the local copy, keeping the
licence file alongside it.

## antislop

Six skills that read as one: `antislop` is the core filter and the other five
deep-dive a concern — UI, copy, accessibility, mobile layout, code comments —
referencing the core's rules by number rather than restating them. The core
asks, before any UI work, whether it applies during the work or as a pass
afterwards.

`antislop-human/` carries a WCAG contrast checker,
`python3 .claude/skills/antislop-human/contrast-check.py "#FFFFFF" "#777777"`.
It takes two colours and prints the ratio and a pass/fail against 4.5:1 and
3:1, exiting non-zero on a fail so a script can chain on it;
`--selftest` recomputes the reference table out of the SKILL.md beside it.

## Not installed on purpose

`pbakaus/impeccable` also ships a `.claude/settings.json` that registers
PostToolUse and Stop **hooks** — they run `scripts/hook.mjs` on every Edit/Write
and at the end of every turn. That file was deliberately left out, so the hook
scripts here stay dormant. Add the upstream settings.json yourself if you want
the automatic design checks; it needs Node 22+.

`miqdadbadjuber/anti-slop` also ships an **MCP server**, `antislop-contrast`,
which its `.claude-plugin/plugin.json` starts with `node
.claude-plugin/contrast-mcp-launcher.mjs` on every session. It is the same
contrast maths as the CLI above, reached over stdio JSON-RPC. Neither the
manifest nor the launcher is vendored, so nothing here starts a process on its
own — run the checker directly when you want it. Install the upstream plugin
(`/plugin marketplace add miqdadbadjuber/anti-slop`) if you would rather have
the tool wired in.
