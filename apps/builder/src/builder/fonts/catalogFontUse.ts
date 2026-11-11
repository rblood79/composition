import type { CatalogConsumerNode } from "../../../../../packages/shared/src/catalog/runtime/compositionRoot";
import type { CatalogGraph } from "../../../../../packages/shared/src/catalog/document/graph";
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
  /** Each request with its loader key (family · weight · style). */
  readonly requests: readonly (readonly [string, CatalogFontRequest])[];
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
  let cache = new WeakMap<CatalogConsumerNode, RecordFontUse>();
  let cacheKey: readonly [string | undefined, string | undefined] = [
    undefined,
    undefined,
  ];
  return (records, localeFamily, dateText) => {
    const base = installedBaseFontFamily();
    if (cacheKey[0] !== base || cacheKey[1] !== localeFamily) {
      cache = new WeakMap();
      cacheKey = [base, localeFamily];
    }
    const requests = new Map<string, CatalogFontRequest>();
    const localeTexts = new Map<number, string>();
    for (const node of records) {
      if (node.hidden) continue;
      let use = cache.get(node);
      if (!use) {
        use = readRecordFontUse(node, localeFamily, dateText);
        if (node.bindingId !== "dateinput") cache.set(node, use);
      }
      for (const [key, request] of use.requests)
        if (!requests.has(key)) requests.set(key, request);
      for (const [weight, text] of use.localeTexts)
        localeTexts.set(weight, (localeTexts.get(weight) ?? "") + text);
    }
    return { requests: [...requests.values()], localeTexts };
  };
}

function readRecordFontUse(
  node: CatalogConsumerNode,
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
  return {
    requests: requests.map(
      (request) =>
        [
          `${request.family}\u0000${request.weight}\u0000${request.style}`,
          request,
        ] as const,
    ),
    localeTexts,
  };
}

/**
 * ADR-307: the fonts the pages' nodes write (family · style · weight in any breakpoint layer or
 * text run), read from the document — a staged root's records hold only the pages filled so far,
 * and a face that arrives later replaces the root once more. Every written family with every
 * written style and weight: a face is a family · style (a weight too for some), so asking for a
 * pair no node draws costs at most a fetch. A font a rule gives (no node writes it) is met when its
 * page fills.
 */
export function catalogAuthoredFontRequests(
  graph: Pick<CatalogGraph, "getEntry" | "projectId">,
  baseFamily: string = DEFAULT_BASE_TYPOGRAPHY.fontFamily,
): CatalogFontRequest[] {
  const families = new Set<string>();
  const styles = new Set<string>();
  const weights = new Set<number>();
  const written = (value: unknown): unknown =>
    value && typeof value === "object" && "kind" in value
      ? (value as { kind: string; value?: unknown }).kind === "set"
        ? (value as { value?: unknown }).value
        : undefined
      : value;
  const read = (visual: Readonly<Record<string, unknown>> | undefined) => {
    if (!visual) return;
    const family = written(visual.fontFamily);
    if (typeof family === "string" && family) families.add(family);
    const style = written(visual.fontStyle);
    if (typeof style === "string" && style) styles.add(style);
    const weight = Number(written(visual.fontWeight));
    if (Number.isFinite(weight) && weight > 0) weights.add(weight);
  };
  const project = graph.getEntry(graph.projectId);
  const stack: string[] = [];
  if (project?.kind === "project")
    for (const pageId of project.pageIds) {
      const page = graph.getEntry(pageId);
      if (page?.kind === "page") stack.push(...page.children);
    }
  const seen = new Set<string>();
  while (stack.length) {
    const id = stack.pop()!;
    if (seen.has(id)) continue;
    seen.add(id);
    const node = graph.getEntry(id);
    if (node?.kind !== "node") continue;
    read(node.visual);
    for (const layer of Object.values(node.responsive ?? {}))
      read(layer?.visual);
    const text = written(node.props.children);
    if (text && typeof text === "object" && "runs" in text)
      for (const run of (
        text as { runs: readonly { marks?: Record<string, unknown> }[] }
      ).runs)
        read(run.marks);
    stack.push(...node.children);
    for (const override of node.descendantOverrides)
      if (override.kind === "fillSlot") stack.push(...override.childIds);
      else if (override.kind === "replace") stack.push(override.replacementId);
  }
  if (!families.size && !styles.size) return [];
  if (!families.size) families.add(baseFamily);
  styles.add("normal");
  weights.add(400);
  const requests: CatalogFontRequest[] = [];
  for (const family of families)
    for (const style of styles)
      for (const weight of weights) requests.push({ family, weight, style });
  return requests;
}
