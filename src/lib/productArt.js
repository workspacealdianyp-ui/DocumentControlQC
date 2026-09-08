import optiload from '../assets/product-optiload.webp'

/* The cut-out product photograph a record band carries.

   The band names the customer, the job and the product in words; the
   picture is there to make the band belong to this shop rather than to
   any dashboard. So it is decorative by construction — alt="" and
   aria-hidden on the element — and nothing on the page depends on it.

   That distinction matters, because the honest reading of a photograph
   next to "CUSTOMER · PT PUTRA PERKASA ABADI" is "this is their unit",
   and it is only true when the art actually matches what the order is
   for. Matching is what MATCHES is for: as more cut-outs are added, more
   bands become literally right.

   HOUSE_DEFAULT is what an unmatched product falls back to. It is on,
   because the reference this was built to shows the band with the house
   product on it and the shop has one product line to show. Set it to
   null and a band with no matching art simply carries the drawn plate
   instead, which is the strict reading — no picture claims to be a unit
   it is not. */
const HOUSE_DEFAULT = optiload

const MATCHES = [
  { re: /optiload|dump\s*truck|rigid|hauler/i, src: optiload },
]

export const artFor = (...text) => {
  const hay = text.filter(Boolean).join(' ')
  return MATCHES.find((m) => m.re.test(hay))?.src || HOUSE_DEFAULT
}
