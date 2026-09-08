/* The spine code: the short mark that stands at the left of every row in
   the register, and in the masthead of the page that row opens.

   Words give their first letter, numbers stay whole. "Customer 05"
   reading as C0 was a truncation, not an abbreviation — the 5 is the
   part that tells two customers apart. */
export function initials(name = '') {
  const words = name.replace(/\b(pt|cv|tbk|persero)\b\.?/gi, '').trim().split(/\s+/).filter(Boolean)
  if (!words.length) return '--'
  const out = words.slice(0, 2).map((w) => (/^\d+$/.test(w) ? w : w[0])).join('')
  return out.slice(0, 4).toUpperCase()
}

/* The category, short enough for the spine. The same three codes appear
   on the job page's masthead mark, so a unit keeps its mark from the
   list it was found in to the page it opens. */
export const KAT_SHORT = { SUPEQ: 'SE', TRAILER: 'TRL', 'NON TRAILER': 'NTR' }
export const katCode = (kat) => KAT_SHORT[kat] || 'JOB'
