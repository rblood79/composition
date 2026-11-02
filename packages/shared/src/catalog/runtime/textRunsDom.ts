/**
 * ADR-299 Decision 2 — a range-formatted text in the DOM: one `<span>` per run (no `<strong>` ·
 * `<em>` — the visual axis does not change the D1 meaning). A span writes only its run's marks (the
 * inherited ones — weight · style · color · size — come from the element, which keeps the node's
 * values) and its decoration line: a RichText's own decoration moves from the element onto every
 * span (`run mark ?? node's own` — CSS propagation would otherwise draw the node's line under a run
 * that says `none`, 리뷰 h2). A token mark writes the token's variable (ADR-298 D5).
 */
import { createElement, type CSSProperties, type ReactNode } from "react";
import {
  tokenToCSSVar,
  withCatalogTokenVars,
  type TokenRef,
} from "@composition/rendering";
import type { TextRun } from "../document/types";
import { catalogAuthoredTokenRef } from "../resolution/resolver";
import { catalogDeviceLength } from "./deviceTypography";
import { catalogRunFontSize, catalogRunFontWeight } from "./textRunStyles";

function markCss(run: TextRun, ownDecoration: unknown): CSSProperties {
  const marks = run.marks ?? {};
  const css: CSSProperties = {};
  const weight = catalogRunFontWeight(marks.fontWeight);
  if (weight !== undefined) css.fontWeight = weight;
  if (typeof marks.fontStyle === "string")
    css.fontStyle = marks.fontStyle as CSSProperties["fontStyle"];
  const size = catalogRunFontSize(marks.fontSize);
  if (size !== undefined) css.fontSize = `${size}px`;
  if (typeof marks.color === "string") css.color = marks.color;
  const decoration = marks.textDecoration ?? ownDecoration;
  if (typeof decoration === "string") css.textDecoration = decoration;
  if (run.marks) {
    const color = catalogAuthoredTokenRef(run.marks, "color");
    if (color?.startsWith("{color.")) {
      const variable = withCatalogTokenVars(tokenToCSSVar(color as TokenRef));
      if (/^var\(--[\w-]+\)$/.test(variable)) css.color = variable;
    }
    const fontSize = catalogAuthoredTokenRef(run.marks, "fontSize");
    const device = fontSize ? catalogDeviceLength(fontSize) : undefined;
    if (device) css.fontSize = device;
  }
  return css;
}

/**
 * The element children of a record's `textRuns` (`undefined` for a plain text). `ownDecoration` is
 * the node's own `textDecoration` (its visual).
 */
export function catalogTextRunsContent(
  runs: readonly TextRun[] | undefined,
  ownDecoration: unknown,
): ReactNode[] | undefined {
  if (!runs?.length) return undefined;
  return runs.map((run, index) =>
    createElement(
      "span",
      {
        key: index,
        "data-text-run": index,
        style: markCss(run, ownDecoration),
      },
      run.text,
    ),
  );
}
