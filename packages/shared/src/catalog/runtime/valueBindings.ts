import { RAC_VALUE_KEYS } from "../generated/racStateKeys";
import type { CatalogConsumerNode } from "./compositionRoot";
import { catalogSliderRange } from "./presence";

/**
 * ADR-256 Decision 12 — a node's template binding to a value its RAC owner computes and passes its
 * children as render props: a ProgressBar's value text `{valueText}`, its fill width
 * `{percentage}%`. The key is one RAC gives (`RAC_VALUE_KEYS`, generated from the installed RAC's
 * run); its owner is the nearest ancestor part that gives it. Binding a value never removes a node.
 *
 * The Canvas reads the owner's record (`catalogRenderValue` — RAC's computation); the DOM reads the
 * owner's render props (`stateFrames.tsx`) and falls back to the same record value.
 */

type Lookup = (id: string) => CatalogConsumerNode | undefined;
type TypeOf = (node: CatalogConsumerNode) => string;

/**
 * ADR-256 Phase 9 — values a composition owner gives its item template from RAC's render props
 * (not a RAC part's own `useRenderProps`): a calendar month · year picker's item text
 * (`item.formatted` — the reference's `<SelectItem>{item.formatted}</SelectItem>`). The DOM passes
 * each item's value as the picker's frame; the Canvas reads the picker record (its focused value).
 */
const COMPOSITION_VALUE_KEYS: Readonly<Record<string, readonly string[]>> = {
  CalendarMonthPicker: ["formatted"],
  CalendarYearPicker: ["formatted"],
};
const valueKeysOf = (type: string): readonly string[] | undefined =>
  RAC_VALUE_KEYS[type] ?? COMPOSITION_VALUE_KEYS[type];

/** Every key a node may bind (`{key}`) to a RAC owner's render props value. */
export const CATALOG_VALUE_KEYS: ReadonlySet<string> = new Set([
  ...Object.values(RAC_VALUE_KEYS).flat(),
  ...Object.values(COMPOSITION_VALUE_KEYS).flat(),
]);
const BINDING = /\{([a-zA-Z][a-zA-Z0-9_-]*)\}/g;

/** The written props · visual values that hold a value binding (`record.props` / `visual` hold the values). */
export interface CatalogValueTemplate {
  readonly props?: Readonly<Record<string, string>>;
  readonly visual?: Readonly<Record<string, string>>;
}

/** The value keys a written string binds. */
export function catalogValueKeysIn(text: string): string[] {
  return [...text.matchAll(BINDING)]
    .map((match) => match[1])
    .filter((key) => CATALOG_VALUE_KEYS.has(key));
}

function writtenWithValues(
  values: Readonly<Record<string, unknown>>,
): Record<string, string> | undefined {
  let out: Record<string, string> | undefined;
  for (const [key, value] of Object.entries(values))
    if (typeof value === "string" && catalogValueKeysIn(value).length)
      (out ??= {})[key] = value;
  return out;
}

/** The written values of a record that bind a RAC owner's value (`undefined` = none). */
export function catalogValueTemplateOf(
  record: CatalogConsumerNode,
): CatalogValueTemplate | undefined {
  if (record.valueTemplate) return record.valueTemplate;
  const props = writtenWithValues(record.props);
  const visual = writtenWithValues(record.visual);
  return props || visual
    ? { ...(props ? { props } : {}), ...(visual ? { visual } : {}) }
    : undefined;
}

/** The nearest ancestor that gives `key` as a render props value (RAC's ProgressBar · Meter). */
export function catalogValueOwner(
  node: CatalogConsumerNode,
  key: string,
  get: Lookup,
  typeOf: TypeOf,
): CatalogConsumerNode | undefined {
  for (let cursor = get(node.parentId); cursor; cursor = get(cursor.parentId))
    if (valueKeysOf(typeOf(cursor))?.includes(key)) return cursor;
  return undefined;
}

const finite = (value: unknown, fallback: number): number =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;

/**
 * The value an owner gives (installed RAC 1.21: `ProgressBar.mjs` · `useProgressBar.mjs` — `Meter`
 * the same through `useMeter`): `value` clamped to `minValue`…`maxValue` (0 · 100 by default),
 * `percentage` its place in the range × 100 (0 for an empty range), `valueText` the author's
 * `valueLabel`, else that fraction in the locale's percent format. An indeterminate ProgressBar
 * gives neither (`undefined`).
 */
export function catalogRenderValue(
  owner: CatalogConsumerNode,
  key: string,
  locale?: string,
): string | number | undefined {
  const props = owner.props;
  // (A calendar picker's focused month · year — its record's derived text, `presence.ts`.)
  if (key === "formatted") {
    const text = owner.derivedProps?._formatted;
    return typeof text === "string" ? text : undefined;
  }
  if (props.isIndeterminate === true) return undefined;
  const min = finite(props.minValue, 0);
  const max = finite(props.maxValue, 100);
  const value = Math.min(max, Math.max(min, finite(props.value, 0)));
  const range = max - min;
  const fraction = range === 0 ? 0 : (value - min) / range;
  if (key === "percentage") return fraction * 100;
  if (key !== "valueText") return undefined;
  if (typeof props.valueLabel === "string" && props.valueLabel)
    return props.valueLabel;
  const own = typeof props.locale === "string" ? props.locale : "";
  return new Intl.NumberFormat(
    own || locale || globalThis.navigator?.language || "en-US",
    { style: "percent" },
  ).format(fraction);
}

/** A key's value for a node: `linked` = an owner gives it (its value may still be `undefined`). */
export type CatalogValueRead = (key: string) => {
  linked: boolean;
  value: unknown;
};

/**
 * A written text with its value bindings replaced: an owner's value as text, nothing for a value
 * the owner does not give now (RAC renders `undefined` as nothing); a binding no owner gives keeps
 * its placeholder (as an origin's unbound `{key}` does).
 */
export function catalogBindValueText(
  written: string,
  read: CatalogValueRead,
): string {
  return written.replace(BINDING, (placeholder, key: string) => {
    if (!CATALOG_VALUE_KEYS.has(key)) return placeholder;
    const { linked, value } = read(key);
    return !linked ? placeholder : value === undefined ? "" : String(value);
  });
}

/** A written style value with its bindings replaced; `undefined` (no declaration) while one has no value. */
export function catalogBindValueStyle(
  written: string,
  read: CatalogValueRead,
): string | undefined {
  let missing = false;
  const text = written.replace(BINDING, (placeholder, key: string) => {
    if (!CATALOG_VALUE_KEYS.has(key)) return placeholder;
    const { linked, value } = read(key);
    if (!linked || value === undefined) missing = true;
    return String(value);
  });
  return missing ? undefined : text;
}

/** A record's props and visual with its value bindings replaced by `read`'s values. */
export function catalogBoundValues(
  record: CatalogConsumerNode,
  template: CatalogValueTemplate,
  read: CatalogValueRead,
): Pick<CatalogConsumerNode, "props" | "visual"> {
  const props = { ...record.props };
  for (const [key, written] of Object.entries(template.props ?? {}))
    props[key] = catalogBindValueText(written, read);
  const visual: Record<string, unknown> = { ...record.visual };
  for (const [key, written] of Object.entries(template.visual ?? {})) {
    const value = catalogBindValueStyle(written, read);
    if (value === undefined) delete visual[key];
    else visual[key] = value;
  }
  return { props, visual: visual as CatalogConsumerNode["visual"] };
}

/**
 * ADR-256 Phase 7c — RAC parts that write their own text when the document gives none (`children`
 * empty): a SliderOutput shows its Slider's value (`Slider.mjs` `SliderOutput` —
 * `state.getThumbValueLabel`, the locale's number format). Its owner and that text, or undefined.
 */
const RAC_TEXT_OWNERS: Readonly<Record<string, string>> = {
  SliderOutput: "Slider",
};
function racOwnText(
  record: CatalogConsumerNode,
  get: Lookup,
  typeOf: TypeOf,
  locale?: string,
): { owner: CatalogConsumerNode; text: string } | undefined {
  const ownerType = RAC_TEXT_OWNERS[record.ruleId ?? typeOf(record)];
  if (!ownerType) return undefined;
  let owner = get(record.parentId);
  while (owner && typeOf(owner) !== ownerType) owner = get(owner.parentId);
  if (!owner) return undefined;
  const { min, max, value } = catalogSliderRange(owner);
  const own = typeof owner.props.locale === "string" ? owner.props.locale : "";
  return {
    owner,
    text: new Intl.NumberFormat(
      own || locale || globalThis.navigator?.language || "en-US",
    ).format(Math.min(max, Math.max(min, value))),
  };
}
/** Whether a record's text is the one its RAC part writes (no text of its own — `racOwnText`). */
export function catalogRacOwnsText(record: CatalogConsumerNode): boolean {
  return record.valueTemplate?.props?.children === "";
}

/** The record with its value bindings resolved against its owners' records (the same record when none). */
export function catalogWithValues(
  record: CatalogConsumerNode,
  get: Lookup,
  typeOf: TypeOf,
  locale?: string,
): CatalogConsumerNode {
  const written = catalogRacOwnsText(record)
    ? ""
    : record.valueTemplate
      ? undefined
      : record.props.children;
  if (written === undefined || written === "") {
    const own = racOwnText(record, get, typeOf, locale);
    if (own)
      return {
        ...record,
        props: { ...record.props, children: own.text },
        valueTemplate: { props: { children: "" } },
      };
  }
  const template = catalogValueTemplateOf(record);
  if (!template) return record;
  const read: CatalogValueRead = (key) => {
    const owner = catalogValueOwner(record, key, get, typeOf);
    return owner
      ? { linked: true, value: catalogRenderValue(owner, key, locale) }
      : { linked: false, value: undefined };
  };
  return {
    ...record,
    ...catalogBoundValues(record, template, read),
    valueTemplate: template,
  };
}

/** Records under `owner` whose value bindings read it (re-planned when its record changes). */
export function catalogValueDependents(
  owner: CatalogConsumerNode,
  get: Lookup,
  typeOf: TypeOf,
): CatalogConsumerNode[] {
  const ownerType = typeOf(owner);
  // (A part whose text RAC writes from this owner — a Slider's SliderOutput, ADR-256 Phase 7c.)
  if (Object.values(RAC_TEXT_OWNERS).includes(ownerType)) {
    const parts: CatalogConsumerNode[] = [];
    const visit = (id: string) => {
      const node = get(id);
      if (!node) return;
      if (catalogRacOwnsText(node)) parts.push(node);
      node.children.forEach(visit);
    };
    owner.children.forEach(visit);
    return parts;
  }
  if (!RAC_VALUE_KEYS[ownerType]) return [];
  const out: CatalogConsumerNode[] = [];
  const visit = (id: string) => {
    const node = get(id);
    if (!node) return;
    const template = node.valueTemplate;
    if (
      template &&
      Object.values({ ...template.props, ...template.visual }).some((text) =>
        catalogValueKeysIn(text).some(
          (key) => catalogValueOwner(node, key, get, typeOf)?.id === owner.id,
        ),
      )
    )
      out.push(node);
    node.children.forEach(visit);
  };
  owner.children.forEach(visit);
  return out;
}
