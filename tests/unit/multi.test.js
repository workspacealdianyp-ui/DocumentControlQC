import { describe, it, expect } from 'vitest'
import { splitMulti, toggleMulti } from '../../src/components/FormView.jsx'

/* Surface preparation and scope of exam are genuinely several answers at
   once — a weld can be as-welded and solvent-wiped — and they were
   single-choice chip rows, so recording both was impossible. Stored as
   one comma-separated string, because that is what the printed report
   and the data book read. */
describe('a field that takes more than one answer', () => {
  it('starts empty', () => {
    expect(splitMulti('')).toEqual([])
    expect(splitMulti(undefined)).toEqual([])
  })

  it('adds an answer', () => {
    expect(toggleMulti('', 'As Welded')).toBe('As Welded')
    expect(toggleMulti('As Welded', 'Solvent Wipe')).toBe('As Welded, Solvent Wipe')
  })

  it('takes one off again without disturbing the rest', () => {
    expect(toggleMulti('As Welded, Machining, Solvent Wipe', 'Machining'))
      .toBe('As Welded, Solvent Wipe')
  })

  it('goes back to empty when the last one is taken off', () => {
    expect(toggleMulti('As Welded', 'As Welded')).toBe('')
  })

  it('keeps the order they were chosen in', () => {
    let v = ''
    for (const o of ['Weld Part', 'Base Metal', 'Repair Weld']) v = toggleMulti(v, o)
    expect(v).toBe('Weld Part, Base Metal, Repair Weld')
  })

  it('reads a value typed or imported with loose spacing', () => {
    expect(splitMulti('As Welded ,  Solvent Wipe ,')).toEqual(['As Welded', 'Solvent Wipe'])
  })

  it('round-trips: what is stored is what the control shows', () => {
    const v = toggleMulti(toggleMulti('', 'Edge Prep.'), 'Back Chipping')
    expect(splitMulti(v)).toEqual(['Edge Prep.', 'Back Chipping'])
  })
})
