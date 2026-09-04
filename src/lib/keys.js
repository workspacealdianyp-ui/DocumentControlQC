/* Which modifier this machine calls "the command key".

   The palette opens on Ctrl+K everywhere, and on the Command key on a
   Mac or the Windows key on a PC — both of which the browser reports as
   metaKey. Windows itself claims Win+K for its Cast panel in some
   builds, so Ctrl+K is the one that always reaches us, and it is the one
   the rail advertises off a Mac. */

export const IS_MAC =
  typeof navigator !== 'undefined' &&
  /Mac|iPhone|iPad|iPod/.test(navigator.userAgentData?.platform || navigator.platform || navigator.userAgent)

// What to print on the key cap next to "Search".
export const CMD_LABEL = IS_MAC ? '⌘' : 'Ctrl'

export const isPaletteChord = (e) =>
  (e.metaKey || e.ctrlKey) && !e.altKey && e.key.toLowerCase() === 'k'
