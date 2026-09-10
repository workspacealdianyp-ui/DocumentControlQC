/* Which Chromium the browser-driven tooling should drive.

   Three scripts launch a browser — the e2e journeys, the icon renderer
   and the art re-encoder — and each had grown its own answer to this:
   one read CHROME_PATH, one read PW_CHROMIUM, one hardcoded a path and
   read nothing. That drift is what put a red cross on every CI run for
   a week. The e2e harness passed its hardcoded fallback to launch
   unconditionally, and on a runner the path named a directory that does
   not exist, so the step died before the first journey.

   There is one answer here now. Playwright installs a browser and finds
   it by itself, which is what happens in CI after `playwright install`
   and on any normal checkout — in that case an executablePath only gets
   in the way. The exception is a sandbox holding a browser Playwright
   did not install, whose build does not match the Playwright in
   package.json; PW_CHROMIUM points at one, and the dev container's own
   path is tried after it.

   Either way a path is used only when something is actually there. A
   missing browser means "you find it", never "fail to launch". */
import { existsSync } from 'node:fs'

const CANDIDATES = [
  process.env.PW_CHROMIUM,
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
]

export function chromiumLaunch(extra = {}) {
  const found = CANDIDATES.find((path) => path && existsSync(path))
  return found ? { executablePath: found, ...extra } : extra
}
