/* What the app costs to open, and the ceiling it may not cross.

   The audit measured 1.18 MB of JavaScript in one eager chunk plus a
   514 KB three.js chunk, on a tool whose main job is filling in a form.
   Splitting that is real work and is not this change. What is here is
   the number, printed on every build and failing the moment it grows —
   so the next thing added to the entry bundle is a decision somebody
   makes rather than one that happens.

   Raise a ceiling deliberately, in a commit that says why. */
import { readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { gzipSync } from 'node:zlib'
import { readFileSync } from 'node:fs'

const DIST = 'dist/assets'

/* gzip, because that is what the browser downloads.

   `optional` is for a chunk that legitimately may not be built. The 3d
   viewer is one: Unit3D.jsx is in the tree but nothing imports it, so
   Rollup never emits a chunk for it. Everything else must be there —
   a budget whose file is missing used to print a question mark and pass,
   which means renaming the entry chunk would have switched the ceiling
   off without anyone failing a build over it. */
const BUDGETS = [
  { match: /^index-.*\.js$/,  label: 'entry javascript', maxKb: 200 },
  { match: /^Unit3D-.*\.js$/, label: '3d viewer (lazy)', maxKb: 160, optional: true },
  { match: /^index-.*\.css$/, label: 'stylesheet',       maxKb: 45 },
]

let bad = 0
const files = readdirSync(DIST)
for (const b of BUDGETS) {
  const name = files.find((f) => b.match.test(f))
  if (!name) {
    if (b.optional) { console.log(`  —  ${b.label}: not built`); continue }
    bad++
    console.log(`  GONE ${b.label.padEnd(18)} nothing matched ${b.match} — a budget cannot guard a file that is not there`)
    continue
  }
  const bytes = gzipSync(readFileSync(join(DIST, name))).length
  const kb = bytes / 1024
  const ok = kb <= b.maxKb
  if (!ok) bad++
  console.log(`  ${ok ? 'ok ' : 'OVER'} ${b.label.padEnd(18)} ${kb.toFixed(1)} KB gzip (budget ${b.maxKb} KB)  ${name}`)
}

const total = files
  .filter((f) => f.endsWith('.js'))
  .reduce((n, f) => n + statSync(join(DIST, f)).size, 0)
console.log(`  —  all javascript, uncompressed: ${(total / 1024 / 1024).toFixed(2)} MB`)

process.exit(bad ? 1 : 0)
