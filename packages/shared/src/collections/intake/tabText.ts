/**
 * ADR-317 Phase 2 — clipboard text as cells (breakdown §5.2): lines by `\n` · `\r\n` · `\r`, cells by
 * tab. A cell that starts with `"` is quoted: its tabs · line breaks stay, `""` is one `"` — the form
 * Excel · Google Sheets copy (and the Table's own copy, which has no quotes: a value's tab · line
 * break is a space there). The last line break ends the last line (Excel ends with one). An unclosed
 * quote reads the text as plain lines and tabs.
 *
 * No header line and no types: the cells are text, read by the column's field type where they are
 * written (`normalizeRows(…, "text")` — ADR-313). The Builder's paste (`pasteRows.ts`) reads the same
 * cells from a tab line with no quotes, its first line a header.
 */
export function splitTabText(text: string): string[][] {
  return splitQuoted(text) ?? splitPlain(text);
}

function splitPlain(text: string): string[][] {
  const lines = text.split(/\r\n|\n|\r/);
  if (lines.length > 1 && lines.at(-1) === "") lines.pop();
  return lines.map((line) => line.split("\t"));
}

function splitQuoted(text: string): string[][] | undefined {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  /** The cell began with a quote (its text is the quote's). */
  let wasQuoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
      continue;
    }
    if (ch === '"' && cell === "" && !wasQuoted) {
      quoted = true;
      wasQuoted = true;
    } else if (ch === "\t") {
      row.push(cell);
      cell = "";
      wasQuoted = false;
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      wasQuoted = false;
    } else cell += ch;
  }
  if (quoted) return undefined;
  if (cell !== "" || row.length || wasQuoted) {
    row.push(cell);
    rows.push(row);
  }
  if (!rows.length) rows.push([""]);
  return rows;
}
