/* Writing a CSV that Excel opens as data.

   Both exporters in this app built their rows by hand and both got it
   wrong in the same two ways.

   The first is quoting. A value was wrapped in quotation marks and
   written out; a value that contains a quotation mark of its own — an
   inspector noted 6" of weld, a customer is named PT "Sinar" Abadi —
   closed the field early and shifted every column after it. RFC 4180
   says a quote inside a quoted field is written twice. One exporter
   instead replaced quotes with apostrophes, which does not corrupt the
   file but does change the data, silently, in an export somebody may
   read as the record.

   The second is formula injection. A spreadsheet treats a cell starting
   with =, +, - or @ as a formula, so a job description of "-40C RATING"
   or a pasted "=cmd|..." runs as one when the file is opened. This is
   the well-known CSV injection: the file is honest, the reader is not,
   and the fix belongs on the writing side. A leading apostrophe would
   also work but shows up in the cell; prefixing a tab keeps the value
   readable and stops the parse.

   Everything that leaves this app as a table goes through here. */

const RISKY = /^[=+\-@\t\r]/

export function csvCell(value) {
  if (value === null || value === undefined) return '""'
  let s = String(value)
  // Excel and Sheets both evaluate a cell that opens with one of these.
  // A tab in front is invisible in the cell and defeats the parse.
  if (RISKY.test(s)) s = `\t${s}`
  // Newlines are legal inside a quoted field, and a lone CR is not — it
  // ends the record in some readers and not in others. One form, LF.
  s = s.replace(/\r\n?/g, '\n')
  return `"${s.replace(/"/g, '""')}"`
}

export const csvRow = (cells) => cells.map(csvCell).join(',')

/* CRLF between records and a BOM in front, because the readers this file
   is opened in are Excel on Windows: without the BOM a customer name
   with an accent arrives as mojibake. */
export const csvText = (rows) => '﻿' + rows.map(csvRow).join('\r\n')

/* The download itself.

   The object URL is revoked on a timer rather than immediately: Safari
   and older Firefox start the download asynchronously after the click
   and revoking in the same tick cancels it. */
export function downloadCsv(filename, rows) {
  const blob = new Blob([csvText(rows)], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
  return url
}

// The date these files are stamped with, in the one order that sorts.
export const stampToday = (now = new Date()) => now.toISOString().slice(0, 10)
