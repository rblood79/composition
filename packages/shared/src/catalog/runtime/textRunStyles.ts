/**
 * ADR-299 Decision 2 · 3 — the drawn runs of a range-formatted text record (`textRuns`) as the
 * effective type each consumer reads: the layout measure (`textLeaf` — font per run), the Canvas
 * (`canvasBinding` — paragraph `pushStyle` per run, decorations per run) and the DOM (`<span>` per
 * run). One reading, three consumers (no consumer-to-consumer reference).
 *
 * Offsets are into the drawn text — the plain text after `text-transform` (and an appended label
 * suffix past the last run). A mark the record does not set is absent (the node's value draws it),
 * except the decoration: a RichText's own decoration moves onto its runs (리뷰 h2 — the outer element
 * no longer writes it), so every run carries `run mark ?? node's own`.
 */
import { applyTextTransform } from "./textTransform";
import type { TextRun } from "../document/types";

export interface CatalogTextRunStyle {
  /** `[start, end)` in the drawn text (UTF-16). */
  readonly start: number;
  readonly end: number;
  readonly fontWeight?: number;
  readonly fontStyle?: string;
  /** px */
  readonly fontSize?: number;
  readonly color?: string;
  /** The run's own decoration line (`run mark ?? node's own`), `none` included. */
  readonly textDecoration?: string;
}

/** A mark's weight as a number (`bold` 700 · `normal` 400 · `"600"`), else undefined. */
export function catalogRunFontWeight(value: unknown): number | undefined {
  if (typeof value === "number" && value > 0) return value;
  if (typeof value !== "string") return undefined;
  if (value === "bold") return 700;
  if (value === "normal") return 400;
  const weight = Number(value);
  return weight > 0 ? weight : undefined;
}

/** A mark's size in px (`16` · `"16px"`), else undefined. */
export function catalogRunFontSize(value: unknown): number | undefined {
  if (typeof value === "number") return value > 0 ? value : undefined;
  if (typeof value !== "string") return undefined;
  const match = /^(\d+(?:\.\d+)?)px$/.exec(value.trim());
  return match ? Number(match[1]) : undefined;
}

/**
 * The run styles of a record's `textRuns` over its drawn text, or undefined for a plain text.
 * `ownDecoration` = the node's own `textDecoration` (its visual — not an ancestor's).
 */
export function catalogTextRunStyles(
  runs: readonly TextRun[] | undefined,
  textTransform: string | undefined,
  ownDecoration: unknown,
): CatalogTextRunStyle[] | undefined {
  if (!runs?.length) return undefined;
  // (A transform that keeps the length keeps the offsets — `capitalize` reads words across runs as
  //  the whole text; one that changes it — ß → SS — is applied per run.)
  const plain = runs.map((run) => run.text).join("");
  const whole = applyTextTransform(plain, textTransform);
  const perRun = whole.length !== plain.length;
  const out: CatalogTextRunStyle[] = [];
  let at = 0;
  for (const run of runs) {
    const length = perRun
      ? applyTextTransform(run.text, textTransform).length
      : run.text.length;
    const marks = run.marks ?? {};
    const fontWeight = catalogRunFontWeight(marks.fontWeight);
    const fontSize = catalogRunFontSize(marks.fontSize);
    const decoration = marks.textDecoration ?? ownDecoration;
    out.push({
      start: at,
      end: at + length,
      ...(fontWeight !== undefined ? { fontWeight } : {}),
      ...(typeof marks.fontStyle === "string"
        ? { fontStyle: marks.fontStyle }
        : {}),
      ...(fontSize !== undefined ? { fontSize } : {}),
      ...(typeof marks.color === "string" ? { color: marks.color } : {}),
      ...(typeof decoration === "string" ? { textDecoration: decoration } : {}),
    });
    at += length;
  }
  return out;
}
