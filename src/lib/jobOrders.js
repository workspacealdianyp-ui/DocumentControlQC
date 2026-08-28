import { DELIVERABLES } from './constants.js'
import joblist from '../data/joblist.json'

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
const write = (v) => {
  try { localStorage.setItem(KEY, JSON.stringify(v)) } catch { /* private mode */ }
  return v
}

export const getOrders = () => read()

export function saveOrder(order) {
  const all = read()
  const i = all.findIndex((o) => o.id === order.id)
  if (i >= 0) all[i] = order
  else all.unshift(order)
  return write(all)
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
export const takenJobNos = () => new Set(allJobs().map((j) => String(j.jobNo)))

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
