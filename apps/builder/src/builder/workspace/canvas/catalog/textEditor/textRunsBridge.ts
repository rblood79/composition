/**
 * ADR-299 Decision 4 — the input layer's schema and its one conversion: catalog runs (`RichText`,
 * the document's) ↔ a ProseMirror document. The editor holds no format of its own — what leaves it
 * is always `normalizeRichText`'s normal form (a text without marks is its string).
 *
 * Schema: `doc(inline*)` = text + `hard_break` (`\n`); one mark per range key
 * (`TEXT_RUN_MARK_KEYS`, attrs `{ value }` — the visual's value form, a token reference included).
 * A pasted mark is read only from this editor's own spans (`data-run-mark`); any other formatting
 * is dropped (Decision 4 — 붙여넣기는 글자만).
 */
import {
  Schema,
  type Mark,
  type Fragment,
  type MarkSpec,
  type Node as PMNode,
} from "prosemirror-model";
import {
  normalizeRichText,
  richTextRuns,
  TEXT_RUN_MARK_KEYS,
  type TextRunMarkKey,
} from "../../../../../../../../packages/shared/src/catalog/document/textRuns";
import type {
  RichText,
  TextRun,
  TextRunMarks,
} from "../../../../../../../../packages/shared/src/catalog/document/types";

/** A mark value as the CSS the editor's span writes (a token → its value in the editor's theme). */
export type MarkCss = (
  key: TextRunMarkKey,
  value: unknown,
) => string | undefined;

const CSS_PROPERTY: Record<TextRunMarkKey, string> = {
  fontWeight: "font-weight",
  fontStyle: "font-style",
  textDecoration: "text-decoration",
  color: "color",
  fontSize: "font-size",
};

export function createTextRunSchema(markCss: MarkCss, rich: boolean): Schema {
  const marks: Record<string, MarkSpec> = {};
  if (rich)
    for (const key of TEXT_RUN_MARK_KEYS)
      marks[key] = {
        attrs: { value: {} },
        // (Stored marks continue at the end of a range, like a word processor's bold.)
        inclusive: true,
        parseDOM: [
          {
            tag: `span[data-run-mark="${key}"]`,
            getAttrs: (dom) => {
              try {
                return {
                  value: JSON.parse(
                    (dom as HTMLElement).getAttribute("data-run-value") ?? "",
                  ),
                };
              } catch {
                return false;
              }
            },
          },
        ],
        toDOM: (mark) => {
          const css = markCss(key, mark.attrs.value);
          return [
            "span",
            {
              "data-run-mark": key,
              "data-run-value": JSON.stringify(mark.attrs.value),
              ...(css ? { style: `${CSS_PROPERTY[key]}: ${css}` } : {}),
            },
            0,
          ];
        },
      };
  return new Schema({
    nodes: {
      doc: { content: "inline*" },
      text: { group: "inline" },
      hard_break: {
        group: "inline",
        inline: true,
        selectable: false,
        parseDOM: [{ tag: "br" }],
        toDOM: () => ["br"],
      },
    },
    marks,
  });
}

function marksOf(schema: Schema, marks: TextRunMarks | undefined): Mark[] {
  if (!marks) return [];
  const out: Mark[] = [];
  for (const key of TEXT_RUN_MARK_KEYS) {
    const value = marks[key];
    const type = schema.marks[key];
    if (value !== undefined && type) out.push(type.create({ value }));
  }
  return out;
}

/** The written text (a string or runs) as the editor's document. */
export function toDoc(schema: Schema, value: string | RichText): PMNode {
  const inline: PMNode[] = [];
  for (const run of richTextRuns(value)) {
    const marks = marksOf(schema, run.marks);
    run.text.split("\n").forEach((line, index) => {
      if (index > 0)
        inline.push(schema.nodes.hard_break!.create(null, null, marks));
      if (line) inline.push(schema.text(line, marks));
    });
  }
  return schema.node("doc", null, inline);
}

/** The editor's document as the written text, in normal form. */
export function fromDoc(doc: PMNode): string | RichText {
  const runs: TextRun[] = [];
  doc.forEach((node) => {
    const text = node.isText ? node.text! : "\n";
    let marks: Record<string, unknown> | undefined;
    for (const mark of node.marks)
      (marks ??= {})[mark.type.name] = mark.attrs.value;
    runs.push(marks ? { text, marks: marks as TextRunMarks } : { text });
  });
  return normalizeRichText({ kind: "text", runs });
}

/**
 * The editor's plain text (`\n` for a hard break) — what the bound / plain fields commit and
 * what a copy puts on the clipboard (a document or a copied slice's content).
 */
export function plainOfDoc(doc: PMNode | Fragment): string {
  let text = "";
  doc.forEach((node) => {
    text += node.isText ? node.text! : "\n";
  });
  return text;
}
