import { createContext } from "react";
import { CATALOG_INHERITANCE_HOSTS } from "../bindings/inheritedProps";
import type { CatalogConsumerNode } from "./compositionRoot";
import type { CatalogInheritedFlag } from "./providerContexts";

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
  const keys = CATALOG_INHERITANCE_HOSTS[type];
  if (!keys) return undefined;
  const out: CatalogInheritedValues = {};
  for (const key of keys) {
    const value = props[key];
    if ((FLAGS as readonly string[]).includes(key)) {
      if (typeof value === "boolean")
        out[key as CatalogInheritedFlag] = value;
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
  return inner ? { ...outer, ...inner } : outer;
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
    if (own)
      for (const [key, value] of Object.entries(own))
        if (!(key in out))
          (out as Record<string, unknown>)[key] = value;
  }
  return out;
}

/** Whether a host's declared inherited values differ between two records (dirty expansion). */
export function catalogHostInheritedChanged(
  type: string,
  before: CatalogConsumerNode | undefined,
  after: CatalogConsumerNode,
): boolean {
  if (!CATALOG_INHERITANCE_HOSTS[type]) return false;
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

/** The DOM's running inherited values (each host's `Provider` merges its own on top). */
export const CatalogInheritedContext = createContext<CatalogInheritedValues>(
  {},
);
