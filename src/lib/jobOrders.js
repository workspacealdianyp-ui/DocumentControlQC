import { DELIVERABLES } from './constants.js'
// The attribute is required by Node's ESM loader, which the generator
// scripts run under; Vite does not need it but accepts it.
import joblist from '../data/joblist.json' with { type: 'json' }
import { StorageFullError } from './store.js'

/* Job orders.

   The shape of the work, as QC actually runs it: a customer raises one
   purchase order, that PO covers several units — six water tanks on one
   PO is the ordinary case — and each unit is a job with its own number,
   WBS and description. QC head or admin creates the order and decides
   which reports each unit needs; publishing it puts those jobs in front
   of the inspectors, who then only see the reports that were asked for.

   Orders live in this browser next to the rest of the app state. The
   bundled sample jobs stay where they are and are merged in read-only,
   so a created order never has to be reconciled against them. */

const KEY = 'qc.jobOrders'

const read = () => {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}
/* A write that cannot happen must say so — the same rule as the report
   store, and for the same reason.

   This used to swallow every storage error and return the value as
   though it had been written. The screen above it then refreshed, said
   "PO published — 4 jobs ready to inspect", and navigated away. An
   admin who filled in a ten-unit order on a full tablet was told the
   work was filed and it was nowhere. */
const write = (v) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(v))
  } catch (e) {
    throw new StorageFullError(e)
  }
  return v
}

export const getOrders = () => read()

/* Published, then read back.

   A successful setItem is not proof: a browser in private mode can
   accept the write and return nothing on the next read, and a quota
   error can arrive on the second key rather than the first. So the order
   is looked for again after it is written, and the caller is told the
   truth either way. */
export class OrderNotSavedError extends Error {
  constructor(poNo) {
    super(`PO ${poNo} was not saved. Nothing has been published — your entries are still on screen. Back up and free some space in Settings → Storage, then try again.`)
    this.name = 'OrderNotSavedError'
  }
}

export function saveOrder(order) {
  const all = read()
  const i = all.findIndex((o) => o.id === order.id)
  if (i >= 0) all[i] = order
  else all.unshift(order)
  write(all)
  const back = read().find((o) => o.id === order.id)
  if (!back || back.poNo !== order.poNo || (back.units || []).length !== (order.units || []).length) {
    throw new OrderNotSavedError(order.poNo)
  }
  return back
}

export function deleteOrder(id) {
  return write(read().filter((o) => o.id !== id))
}

// One unit of an order, shaped like a bundled job so every screen that
// already reads a job keeps working without knowing where it came from.
function unitToJob(order, unit) {
  const deliverables = {}
  for (const d of DELIVERABLES) {
    deliverables[d.key] = {
      status: order.required.includes(d.key) ? 'not-started' : 'na',
      ref: null,
    }
  }
  return {
    poNo: order.poNo,
    orderId: order.id,
    source: 'app',
    jobNo: unit.jobNo,
    wbsNo: unit.wbsNo,
    unitNo: unit.unitNo,
    arasSN: unit.unitNo,
    productDesc: unit.productDesc,
    type: unit.type || '',
    kategori: order.kategori,
    customerName: order.customerName,
    customerId: order.customerId,
    datePB: order.datePB,
    dateTarget: order.dateTarget,
    // Orders raised before the target field existed put their promise
    // in datePdiRelease; dueDate() reads either.
    datePdiRelease: order.datePdiRelease,
    required: order.required,
    deliverables,
  }
}

export const orderJobs = () => getOrders().flatMap((o) => o.units.map((u) => unitToJob(o, u)))

// Created orders first: they are the work in hand, the bundled list is
// history.
export const allJobs = () => [...orderJobs(), ...joblist.jobs]

/* Which deliverables this job actually needs. A created order says so
   outright; a bundled job says it by marking the rest not applicable,
   which is the same statement in the older shape. */
export const requiredFor = (job) =>
  job?.required
    ? DELIVERABLES.filter((d) => job.required.includes(d.key)).map((d) => d.key)
    : DELIVERABLES.filter((d) => job?.deliverables?.[d.key]?.status !== 'na').map((d) => d.key)

// Every job number in play, so a new one cannot collide with a bundled
// job or with another order.
/* Job numbers already in use.

   `except` is the order being revised: its own units are not a clash
   with themselves, and without this an editor would report every unit
   it is holding as already taken. */
export const takenJobNos = (exceptOrderId) => new Set(
  allJobs().filter((j) => !exceptOrderId || j.orderId !== exceptOrderId).map((j) => String(j.jobNo)))

export const orderById = (id) => getOrders().find((o) => o.id === id) || null
// The register knows a PO number, not an order id, so the way in from a
// purchase order page is by the number printed on it.
export const orderByPo = (poNo) => getOrders().find((o) => o.poNo === poNo) || null

/* The identity a report's first page shows.

   One function, so the values are written the same way whether a report
   is being created, loaded, or re-pointed at a different job. Nothing
   here is typed by an inspector: the job order is the master record and
   the report only quotes it. */
export const jobIdentity = (job) => ({
  jobNo: job?.jobNo || '',
  poNo: job?.poNo || '',
  wbsNo: job?.wbsNo || '',
  jobDesc: job?.productDesc || '',
  sn: job?.arasSN || job?.unitNo || '',
  unit: job?.unitNo || job?.arasSN || '',
  customer: job?.customerName || '',
})
