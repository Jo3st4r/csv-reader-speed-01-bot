// Fast drop-in for csv-reader 1.0.0 (make.fun's own reference CSV reader).
//
// Same answers, faster: one pass over the text, fields cut out with bulk
// slices instead of building every field one character at a time.
//
// Policy (csv-reader 1.0.0, as specified by the competition):
// - a U+FEFF at the very start is dropped;
// - a record ends at LF or CRLF, and a line left with no characters is no record;
// - outside quotes a CR not followed by LF is dropped (stray_cr);
// - a field opening with a quote runs to the next quote that is not doubled,
//   "" inside it is one quote, each CRLF or lone CR inside it reads as LF;
//   what follows its closing quote, up to the next comma or line break, is
//   appended as it stands (quote_junk, when the field ends);
// - a quote that never closes is a literal character, and the text after it
//   is read again as unquoted (unterminated_quote);
// - a quote inside an unquoted field is a literal character;
// - fields stay strings, never trimmed or converted;
// - columns is the first record when header is true, else null; rows holds the
//   records after it, each padded with "" (short_row, with fields: its count)
//   or cut (long_row, with extra: the cut fields) to the first record's width;
// - each error is {code, line, row}, in the order met; line is the 1-based
//   line its record starts on (every LF, CRLF and lone CR inside quotes
//   counted), row is its record's index in rows (null for the header).
//
// Pure: no clock, no randomness, no locale, nothing kept from one call to the
// next. Dependency-free ES module; run(input) returns {columns, rows, errors}.

const COMMA = 0;
const LINE_BREAK = 1;
const END = 2;

/** csv-reader 1.0.0's answer for one case's input. */
export function run(input) {
  const text = String(input.text);
  const header = input.header === true;
  const errors = [];
  const rows = [];
  let columns = null;
  let width = -1;

  const n = text.length;
  let pos = 0; // the next character to read
  let line = 1; // the line that character is on
  if (n > 0 && text.charCodeAt(0) === 0xfeff) pos = 1;

  // The record being read: the line it starts on and the index in rows it
  // takes (null: the header). Read by the field scanners below.
  let recordLine = 1;
  let recordRow = null;

  // Field result slots, set by unquoted()/quoted() below.
  let fVal;
  let fEnd;
  let fAdd;

  // Reads an unquoted field starting at `from`, with `init` as its starting
  // value. Sets fVal/fEnd/fAdd and advances pos/line. A CR not followed by
  // LF is dropped and reported (stray_cr); `fAdd` counts only the
  // characters this call kept, never `init`.
  function unquoted(from, init) {
    let seg = from; // start of the current kept run
    let parts = null; // kept runs, only when a stray CR splits the field
    let added = 0;
    let i = from;
    let end;
    for (;;) {
      if (i >= n) { end = END; break; }
      const c = text.charCodeAt(i);
      if (c === 44) { end = COMMA; break; } // ','
      if (c === 10) { end = LINE_BREAK; break; } // LF
      if (c === 13) { // CR
        if (text.charCodeAt(i + 1) === 10) { end = LINE_BREAK; break; } // CRLF
        errors.push({ code: 'stray_cr', line: recordLine, row: recordRow });
        if (parts === null) parts = [];
        parts.push(text.slice(seg, i));
        added += i - seg;
        i += 1;
        seg = i;
        continue;
      }
      i += 1;
    }
    if (parts === null) {
      fVal = init === '' ? text.slice(seg, i) : init + text.slice(seg, i);
      added += i - seg;
    } else {
      parts.push(text.slice(seg, i));
      added += i - seg;
      fVal = init === '' ? parts.join('') : init + parts.join('');
    }
    fAdd = added;
    fEnd = end;
    if (end === COMMA) pos = i + 1;
    else if (end === LINE_BREAK) { pos = text.charCodeAt(i) === 13 ? i + 2 : i + 1; line += 1; }
    else pos = n;
  }

  // The value of one quoted segment [s, e): plain slice when it holds no
  // line break, otherwise each CRLF or lone CR read as one LF (and counted).
  function segmentValue(s, e) {
    const nl = text.indexOf('\n', s);
    const cr = text.indexOf('\r', s);
    if ((nl === -1 || nl >= e) && (cr === -1 || cr >= e)) return text.slice(s, e);
    const seg = text.slice(s, e);
    const m = seg.match(/\r\n|\r|\n/g);
    if (m !== null) line += m.length;
    return seg.replace(/\r\n?/g, '\n');
  }

  // Reads a quoted field whose opening quote is at pos. Sets fVal/fEnd/fAdd
  // and advances pos/line. A quote that never closes is a literal character
  // and the text after it is read again as unquoted (unterminated_quote).
  function quoted() {
    const open = pos;
    const openLine = line;
    let start = pos + 1;
    let j = start;
    let segs = null; // [s, e, s, e, ...] split by doubled quotes
    let close = -1;
    for (;;) {
      const q = text.indexOf('"', j);
      if (q === -1) break;
      if (text.charCodeAt(q + 1) === 34) { // doubled quote: one literal quote
        if (segs === null) segs = [];
        segs.push(start, q);
        j = q + 2;
        start = q + 2;
        continue;
      }
      close = q;
      break;
    }
    if (close === -1) {
      pos = open + 1;
      line = openLine;
      errors.push({ code: 'unterminated_quote', line: recordLine, row: recordRow });
      unquoted(open + 1, '"');
      return;
    }
    let value;
    if (segs === null) {
      value = segmentValue(start, close);
    } else {
      segs.push(start, close);
      const parts = [];
      for (let k = 0; k < segs.length; k += 2) {
        if (k > 0) parts.push('"');
        parts.push(segmentValue(segs[k], segs[k + 1]));
      }
      value = parts.join('');
    }
    pos = close + 1;
    if (pos >= n) { fVal = value; fEnd = END; fAdd = 0; return; }
    const c = text.charCodeAt(pos);
    if (c === 44) { pos += 1; fVal = value; fEnd = COMMA; fAdd = 0; return; }
    if (c === 10) { pos += 1; line += 1; fVal = value; fEnd = LINE_BREAK; fAdd = 0; return; }
    if (c === 13 && text.charCodeAt(pos + 1) === 10) {
      pos += 2; line += 1; fVal = value; fEnd = LINE_BREAK; fAdd = 0; return;
    }
    // What follows the closing quote is appended as it stands.
    unquoted(pos, value);
    if (fAdd > 0) errors.push({ code: 'quote_junk', line: recordLine, row: recordRow });
  }

  for (;;) {
    // Lines with no characters are no records.
    while (pos < n) {
      const c = text.charCodeAt(pos);
      if (c === 10) { pos += 1; line += 1; }
      else if (c === 13 && text.charCodeAt(pos + 1) === 10) { pos += 2; line += 1; }
      else break;
    }
    if (pos >= n) break;

    recordLine = line;
    recordRow = header && columns === null ? null : rows.length;
    const fields = [];
    let end;
    let quotedLast = false;
    do {
      if (text.charCodeAt(pos) === 34) {
        quotedLast = true;
        quoted();
      } else {
        quotedLast = false;
        unquoted(pos, '');
      }
      fields.push(fVal);
      end = fEnd;
    } while (end === COMMA);

    // A line that held only stray CRs is left with no characters: no record
    // (its stray_cr errors stay).
    if (fields.length === 1 && fields[0] === '' && !quotedLast) continue;

    if (width < 0) width = fields.length;
    if (header && columns === null) {
      columns = fields;
      continue;
    }
    if (fields.length < width) {
      errors.push({ code: 'short_row', line: recordLine, row: recordRow, fields: fields.length });
      while (fields.length < width) fields.push('');
    } else if (fields.length > width) {
      errors.push({ code: 'long_row', line: recordLine, row: recordRow, extra: fields.splice(width) });
    }
    rows.push(fields);
  }
  return { columns: header ? (columns ?? []) : null, rows, errors };
}
