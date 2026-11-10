import type { CatalogConsumerNode } from "../../../../../packages/shared/src/catalog/runtime/compositionRoot";
import { installedBaseFontFamily } from "../../../../../packages/shared/src/catalog/runtime/themeMaps";
import { catalogTextTypography } from "../catalogRuntime/boxModel";
import { DEFAULT_BASE_TYPOGRAPHY } from "./customFonts";

export interface CatalogFontRequest {
  readonly family: string;
  readonly weight: number;
  readonly style: string;
}

/** The fonts the Canvas draws: S2 faces to load, and the locale font's text per weight. */
export interface CatalogFontUse {
  /** One per family · weight · style (the loader keys faces by them). */
  readonly requests: readonly CatalogFontRequest[];
  /** Text drawn in the locale font, per weight, in record order. */
  readonly localeTexts: ReadonlyMap<number, string>;
}

interface RecordFontUse {
  readonly base: string | undefined;
  readonly localeFamily: string | undefined;
  readonly requests: readonly CatalogFontRequest[];
  readonly localeTexts: readonly (readonly [number, string])[];
}

/**
 * Reads the fonts every shown record uses (CANVAS_PERF_SCALING_2026-11 B4). A record is an immutable
 * value, so what one record uses is kept per record object and read again only for a new object —
 * an edit reads the records it replaced, not the whole document. The installed base font and the
 * locale font are part of the key. A date input's text is its owner's (`dateText`), so it is read
 * every time.
 */
export function createCatalogFontUseReader(): (
  records: Iterable<CatalogConsumerNode>,
  localeFamily: string | undefined,
  dateText: (id: string) => string | undefined,
) => CatalogFontUse {
  const cache = new WeakMap<CatalogConsumerNode, RecordFontUse>();
  return (records, localeFamily, dateText) => {
    const base = installedBaseFontFamily();
    const requests = new Map<string, CatalogFontRequest>();
    const localeTexts = new Map<number, string>();
    for (const node of records) {
      if (node.hidden) continue;
      let use = cache.get(node);
      if (!use || use.base !== base || use.localeFamily !== localeFamily) {
        use = readRecordFontUse(node, base, localeFamily, dateText);
        if (node.bindingId !== "dateinput") cache.set(node, use);
      }
      for (const request of use.requests) {
        const key = `${request.family}\u0000${request.weight}\u0000${request.style}`;
        if (!requests.has(key)) requests.set(key, request);
      }
      for (const [weight, text] of use.localeTexts)
        localeTexts.set(weight, (localeTexts.get(weight) ?? "") + text);
    }
    return { requests: [...requests.values()], localeTexts };
  };
}

function readRecordFontUse(
  node: CatalogConsumerNode,
  base: string | undefined,
  localeFamily: string | undefined,
  dateText: (id: string) => string | undefined,
): RecordFontUse {
  const text = catalogTextTypography(node);
  const family = text.fontFamily ?? DEFAULT_BASE_TYPOGRAPHY.fontFamily;
  const weight = Number(
    node.visual.fontWeight ?? node.inheritedText?.fontWeight ?? 400,
  );
  const style = text.fontStyle ?? "normal";
  const requests: CatalogFontRequest[] = [{ family, weight, style }];
  for (const run of node.textRuns ?? [])
    requests.push({
      family,
      weight: Number(run.marks?.fontWeight ?? weight),
      style: String(run.marks?.fontStyle ?? style),
    });
  const localeTexts: (readonly [number, string])[] = [];
  if (localeFamily && text.fontFamily?.includes(localeFamily)) {
    const content =
      node.textRuns?.map((run) => run.text).join("") ??
      [
        node.props.children,
        node.props.value,
        node.props.label,
        node.props.placeholder,
        // RAC writes a date input's segments: its text lives in no prop.
        dateText(node.id),
      ]
        .filter((value) => typeof value === "string")
        .join("");
    if (content) {
      localeTexts.push([weight, content]);
      for (const run of node.textRuns ?? [])
        localeTexts.push([Number(run.marks?.fontWeight ?? weight), run.text]);
    }
  }
  return { base, localeFamily, requests, localeTexts };
}
