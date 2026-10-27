/**
 * ADR-284 Phase 6 — the code view's text writer: appends code and records the spans of the 1:1
 * positions (slots) as it writes them, so an edit inside a slot maps back to the document.
 * ADR-285 — and the anchors: the span of each document unit the code shows (an element, its
 * attribute, a variable, a view, a condition, a derived line), so an edit keeps its identity.
 */
import type {
  CodeViewAnchor,
  CodeViewAnchorTarget,
  CodeViewSlot,
  CodeViewSlotTarget,
} from "./types";

export class CodeWriter {
  private text = "";
  private readonly slotList: CodeViewSlot[] = [];
  private readonly anchorList: CodeViewAnchor[] = [];
  private indent = 0;

  get length(): number {
    return this.text.length;
  }
  /** The current indent level (a fragment written for a line at this depth). */
  get depth(): number {
    return this.indent;
  }
  /** Append text as is. */
  write(text: string): this {
    this.text += text;
    return this;
  }
  /** Append text whose span is a slot. */
  slot(text: string, target: CodeViewSlotTarget): this {
    const start = this.text.length;
    this.text += text;
    this.slotList.push({ start, end: this.text.length, text, target });
    return this;
  }
  /** Record `[start, here)` as the span of a document unit. */
  anchor(start: number, target: CodeViewAnchorTarget): this {
    this.anchorList.push({ start, end: this.text.length, target });
    return this;
  }
  /** Write a whole line whose text (without the indent) is the span of a document unit. */
  anchorLine(text: string, target: CodeViewAnchorTarget): this {
    this.start();
    const start = this.text.length;
    this.text += text;
    this.anchor(start, target);
    return this.end();
  }
  /** Append a line at the current indent. */
  line(text = ""): this {
    this.text += text ? `${"  ".repeat(this.indent)}${text}\n` : "\n";
    return this;
  }
  /** Start a line at the current indent (the caller writes the rest, then `end()`). */
  start(): this {
    this.text += "  ".repeat(this.indent);
    return this;
  }
  end(): this {
    this.text += "\n";
    return this;
  }
  in(): this {
    this.indent += 1;
    return this;
  }
  out(): this {
    this.indent = Math.max(0, this.indent - 1);
    return this;
  }
  /** A writer for a fragment written elsewhere and spliced in (`append`). */
  fragment(): CodeWriter {
    const next = new CodeWriter();
    next.indent = this.indent;
    return next;
  }
  /** Splice a fragment's text and slots here. */
  append(fragment: CodeWriter): this {
    const offset = this.text.length;
    this.text += fragment.text;
    for (const slot of fragment.slotList)
      this.slotList.push({
        ...slot,
        start: slot.start + offset,
        end: slot.end + offset,
      });
    for (const anchor of fragment.anchorList)
      this.anchorList.push({
        ...anchor,
        start: anchor.start + offset,
        end: anchor.end + offset,
      });
    return this;
  }
  done(): { code: string; slots: CodeViewSlot[]; anchors: CodeViewAnchor[] } {
    return { code: this.text, slots: this.slotList, anchors: this.anchorList };
  }
}
