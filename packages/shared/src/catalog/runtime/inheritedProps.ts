import { createContext } from "react";
import { CATALOG_INHERITANCE_HOSTS } from "../bindings/inheritedProps";
import type { CatalogConsumerNode } from "./compositionRoot";
import {
  CATALOG_INHERITED_RECEIVERS,
  type CatalogInheritedFlag,
} from "./providerContexts";

/**
 * ADR-281 Decision 3 — the values a page root (`body`) and a frame pass down: each prop from the
 * nearest host that declares it (RAC `Provider` · `I18nProvider` — the nearest wins). One reading
 * for the three consumers: the Preview DOM (`CatalogInheritedContext` → RAC `Provider`), the
 * Canvas (`presence.ts` derived `isDisabled` · `isReadOnly`) and the dispatcher's guard
 * (`getConstraintContext().inherited`).
 */
export interface CatalogInheritedValues {
  isDisabled?: boolean;
  isReadOnly?: boolean;
  isRequired?: boolean;
  locale?: string;
  colorScheme?: "light" | "dark";
  /**
   * ADR-314 — `isDisabled` comes from a loading Skeleton only: S2 `useFormProps` disables just the
   * components that call it (`CATALOG_SKELETON_DISABLED_TYPES`), not every RAC context that takes the
   * flag (a Link · Tabs · Disclosure · date field stays enabled).
   */
  skeleton?: true;
}

/**
 * S2 1.8.2 components that call `useFormProps` (`Form.tsx:45` — 「Skeleton always wins」): Button ·
 * LinkButton (`Button.tsx:416 · 541`), ActionButton, ToggleButton, Checkbox · CheckboxGroup, Switch,
 * RadioGroup, TextField · TextArea (`TextField.tsx:152`), NumberField, SearchField, Picker (Select),
 * ComboBox, Slider · RangeSlider, ColorField.
 */
export const CATALOG_SKELETON_DISABLED_TYPES: ReadonlySet<string> = new Set([
  "Button",
  "LinkButton",
  "ActionButton",
  "ToggleButton",
  "Checkbox",
  "CheckboxGroup",
  "Switch",
  "RadioGroup",
  "TextField",
  "TextArea",
  "NumberField",
  "SearchField",
  "Select",
  "ComboBox",
  "Slider",
  "RangeSlider",
  "ColorField",
]);

/** The inherited flags a receiver of `type` takes from `inherited` (a Skeleton's only S2's form set). */
export function catalogInheritedTakes(
  type: string,
  inherited: CatalogInheritedValues,
): readonly CatalogInheritedFlag[] | undefined {
  const takes = CATALOG_INHERITED_RECEIVERS.get(type);
  if (
    !takes ||
    !inherited.skeleton ||
    CATALOG_SKELETON_DISABLED_TYPES.has(type)
  )
    return takes;
  return takes.filter((flag) => flag !== "isDisabled");
}

const FLAGS: readonly CatalogInheritedFlag[] = [
  "isDisabled",
  "isReadOnly",
  "isRequired",
];

/** What a host itself declares (its props with any runtime override applied). */
export function catalogHostInherited(
  type: string,
  props: Readonly<Record<string, unknown>>,
): CatalogInheritedValues | undefined {
  // ADR-314 Phase 2 — S2 `useFormProps`: a loading Skeleton disables the form components inside it
  //   (「Skeleton always wins」 — the receivers' OR below), nothing while it is not loading.
  if (type === "Skeleton")
    return props.isLoading === true
      ? { isDisabled: true, skeleton: true }
      : undefined;
  // (ADR-314 Phase 4 — S2 `SkeletonCollection`: its content is always a loading Skeleton's.)
  if (type === "SkeletonCollection")
    return { isDisabled: true, skeleton: true };
  const keys = CATALOG_INHERITANCE_HOSTS[type];
  if (!keys) return undefined;
  const out: CatalogInheritedValues = {};
  for (const key of keys) {
    const value = props[key];
    if ((FLAGS as readonly string[]).includes(key)) {
      if (typeof value === "boolean") out[key as CatalogInheritedFlag] = value;
    } else if (key === "locale") {
      if (typeof value === "string" && value) out.locale = value;
    } else if (key === "colorScheme") {
      if (value === "light" || value === "dark") out.colorScheme = value;
    }
  }
  return Object.keys(out).length ? out : undefined;
}

/** `outer` with what `inner` declares on top (the nearer host wins). */
export function catalogMergeInherited(
  outer: CatalogInheritedValues,
  inner: CatalogInheritedValues | undefined,
): CatalogInheritedValues {
  if (!inner) return outer;
  const merged: CatalogInheritedValues = { ...outer, ...inner };
  // (A disable that is not a Skeleton's — inner, or an outer one a Skeleton repeats — reaches all.)
  if (
    merged.skeleton &&
    (("isDisabled" in inner && !inner.skeleton) ||
      (outer.isDisabled === true && !outer.skeleton))
  )
    delete merged.skeleton;
  return merged;
}

/** What a record's ancestors pass down to it (its own declaration not included). */
export function catalogAncestorInherited(
  record: CatalogConsumerNode,
  get: (id: string) => CatalogConsumerNode | undefined,
  typeOf: (node: CatalogConsumerNode) => string,
  propsOf: (node: CatalogConsumerNode) => Readonly<Record<string, unknown>> = (
    node,
  ) => node.props,
): CatalogInheritedValues {
  const out: CatalogInheritedValues = {};
  const seen = new Set<string>();
  for (
    let parent = get(record.parentId);
    parent && !seen.has(parent.id);
    parent = get(parent.parentId)
  ) {
    seen.add(parent.id);
    const own = catalogHostInherited(typeOf(parent), propsOf(parent));
    if (!own) continue;
    // (An outer non-Skeleton disable under a Skeleton's: it reaches every receiver.)
    if (out.skeleton && own.isDisabled === true && !own.skeleton)
      delete out.skeleton;
    for (const [key, value] of Object.entries(own)) {
      if (key === "skeleton") continue;
      if (key in out) continue;
      (out as Record<string, unknown>)[key] = value;
      if (key === "isDisabled" && own.skeleton) out.skeleton = true;
    }
  }
  return out;
}

/** Whether a host's declared inherited values differ between two records (dirty expansion). */
export function catalogHostInheritedChanged(
  type: string,
  before: CatalogConsumerNode | undefined,
  after: CatalogConsumerNode,
): boolean {
  if (!CATALOG_INHERITANCE_HOSTS[type] && type !== "Skeleton") return false;
  return (
    JSON.stringify(catalogHostInherited(type, before?.props ?? {}) ?? {}) !==
    JSON.stringify(catalogHostInherited(type, after.props) ?? {})
  );
}

/** Every record below a host (its descendants follow what it passes down). */
export function catalogInheritedReceivers(
  host: CatalogConsumerNode,
  get: (id: string) => CatalogConsumerNode | undefined,
): CatalogConsumerNode[] {
  const out: CatalogConsumerNode[] = [];
  const visit = (node: CatalogConsumerNode) => {
    for (const id of node.children) {
      const child = get(id);
      if (!child) continue;
      out.push(child);
      visit(child);
    }
  };
  visit(host);
  return out;
}

/**
 * A receiver's props with the inherited flags its RAC context takes ORed in. RAC's own rule lets a
 * component's `isDisabled={false}` beat the context (probe P4), but a record cannot tell an authored
 * `false` from the `false` its origin declares (every palette field and Button carries one), so the
 * render, the Canvas and the guard all read "an ancestor's `true` wins" — the same answer.
 */
export function catalogInheritedFlags(
  props: Readonly<Record<string, unknown>>,
  takes: readonly CatalogInheritedFlag[] | undefined,
  inherited: CatalogInheritedValues,
): Readonly<Record<string, unknown>> {
  if (!takes?.length) return props;
  let out: Record<string, unknown> | undefined;
  for (const flag of takes)
    if (inherited[flag] === true && props[flag] !== true)
      (out ??= { ...props })[flag] = true;
  return out ?? props;
}

/** Effective flag shared by state predicates and authored field parts. */
export function catalogInheritedFlag(
  node: CatalogConsumerNode,
  flag: CatalogInheritedFlag,
  get: (id: string) => CatalogConsumerNode | undefined,
  typeOf: (node: CatalogConsumerNode) => string,
): boolean {
  const inherited = catalogAncestorInherited(node, get, typeOf);
  return (
    catalogInheritedFlags(
      node.props,
      catalogInheritedTakes(typeOf(node), inherited),
      inherited,
    )[flag] === true
  );
}

/** The DOM's running inherited values (each host's `Provider` merges its own on top). */
export const CatalogInheritedContext = createContext<CatalogInheritedValues>(
  {},
);
