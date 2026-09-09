import { describe, it, expect } from 'vitest'
import { fieldLocked } from '../../src/components/FormView.jsx'
import { ROLES } from '../../src/lib/constants.js'

const admin = ROLES.admin
const inspector = ROLES.inspector
const viewer = ROLES.viewer

/* The defect these cover: the engine asked `f.adminOnly && false`, which
   is false whatever the field says, and the call site's conditional
   returned the same value from both branches. No schema uses adminOnly
   today, so nothing was exploitable — the enforcement simply was not
   there for the first one that did. */
describe('fieldLocked', () => {
  const plain = { id: 'gapMm' }
  const reserved = { id: 'acceptanceStd', adminOnly: true }

  it('locks an admin-only field for an inspector', () => {
    expect(fieldLocked({ field: reserved, sectionLocked: false, role: inspector })).toBe(true)
  })

  it('locks it for a viewer', () => {
    expect(fieldLocked({ field: reserved, sectionLocked: false, role: viewer })).toBe(true)
  })

  it('opens it for a role that can override', () => {
    expect(fieldLocked({ field: reserved, sectionLocked: false, role: admin })).toBe(false)
  })

  it('leaves an ordinary field open to an inspector', () => {
    expect(fieldLocked({ field: plain, sectionLocked: false, role: inspector })).toBe(false)
  })

  it('locks everything when the section is locked, whatever the role', () => {
    for (const role of [admin, inspector, viewer]) {
      expect(fieldLocked({ field: plain, sectionLocked: true, role })).toBe(true)
      expect(fieldLocked({ field: reserved, sectionLocked: true, role })).toBe(true)
    }
  })

  it('locks an admin-only field when there is no role at all', () => {
    expect(fieldLocked({ field: reserved, sectionLocked: false, role: null })).toBe(true)
    expect(fieldLocked({ field: reserved, sectionLocked: false })).toBe(true)
  })

  it('is not satisfied by a truthy-looking role object', () => {
    // canOverride is the right, not the label. An admin label without
    // the right must not open the field.
    expect(fieldLocked({ field: reserved, sectionLocked: false, role: { label: 'Admin' } })).toBe(true)
  })
})
