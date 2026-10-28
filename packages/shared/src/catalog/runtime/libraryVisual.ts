import type { DefinitionId, TokenId } from "../document/types";
import { catalogTokenValue } from "../document/themedToken";
import type {
  CatalogCompositionRoot,
  CatalogConsumerNode,
} from "./compositionRoot";

/**
 * Visual values a rule-backed node's definition declares for its current props (base visual and
 * the selected prop visual rules, tokens resolved). The executor treats any other resolved value
 * as an authored write layered on the rule.
 */
export function catalogLibraryVisual(
  root: CatalogCompositionRoot,
  node: CatalogConsumerNode,
  /**
   * Also the definition's resting conditional rules that match the node's props (a Button's
   * `fillStyle: outline` paint): what the generated sheet draws from the same `data-*` values.
   */
  conditional = false,
): Record<string, unknown> {
  const graph = root.runtime.graph;
  const definition = graph.getDefinition(node.definitionId as DefinitionId);
  const values: Record<string, unknown> = {};
  if (!definition) return values;
  // The resolver's token read (the root's color mode), so a definition value is never "authored".
  const tokenValue = (id: TokenId) => {
    const token = graph.getToken(id);
    return token && catalogTokenValue(token, root.colorMode);
  };
  const apply = (source: Readonly<Record<string, unknown>> | undefined) => {
    for (const [key, value] of Object.entries(source ?? {}))
      values[key] =
        value && typeof value === "object" && "tokenId" in value
          ? tokenValue((value as { tokenId: TokenId }).tokenId)
          : value;
  };
  apply(definition.visual);
  if ("propVisualRules" in definition)
    for (const [prop, choices] of Object.entries(
      definition.propVisualRules ?? {},
    )) {
      const choice = node.props[prop];
      if (typeof choice === "string") apply(choices[choice]);
    }
  if (conditional && "conditionalRules" in definition)
    for (const rule of definition.conditionalRules ?? [])
      if (
        rule.state === undefined &&
        Object.entries(rule.when ?? {}).every(
          ([key, value]) => node.props[key] === value,
        )
      )
        apply(rule.visual);
  return values;
}

/**
 * The definition's resting conditional visuals a node's owner-derived values turn on but its own
 * props do not (a Button its ButtonGroup disables: the `isDisabled` dimming). The resolver reads
 * the authored props only; the DOM gets these from RAC's state (`[data-disabled]`).
 */
export function catalogDerivedConditionalVisual(
  root: CatalogCompositionRoot,
  node: CatalogConsumerNode,
): Record<string, unknown> {
  const derived = node.derivedProps;
  if (!derived) return {};
  const own = catalogLibraryVisual(root, node, true);
  const withDerived = catalogLibraryVisual(
    root,
    { ...node, props: { ...node.props, ...derived } },
    true,
  );
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(withDerived))
    if (!Object.is(own[key], value)) out[key] = value;
  return out;
}

/**
 * The definition's values an owner-derived prop turns on (`catalogDerivedConditionalVisual`) for
 * the keys the node does not author — what the generated sheet's `[data-*]` block draws under the
 * inline style (a field's own Button: its size's corner over the S2 pill, 2026-10-28). The Canvas
 * paint and the Styles panel's effective value read it; the record's `visual` keeps the definition
 * value (an authored write stays the difference from it).
 */
export function catalogDerivedRestVisual(
  root: CatalogCompositionRoot,
  node: CatalogConsumerNode,
): Record<string, unknown> {
  if (!node.derivedProps) return {};
  const derived = catalogDerivedConditionalVisual(root, node);
  const keys = Object.keys(derived);
  if (!keys.length) return {};
  const authored = catalogAuthoredVisual(root, node);
  return Object.fromEntries(
    keys
      .filter((key) => authored[key] === undefined)
      .map((key) => [key, derived[key]]),
  );
}

/**
 * Resolved visual values of a rule-backed node that differ from what its definition declares:
 * the authored writes (project override, template, instance, path, state rules). The rule-backed
 * executors layer only these on the rule — Canvas as style overrides, DOM as inline style over
 * the generated class CSS.
 */
export function catalogAuthoredVisual(
  root: CatalogCompositionRoot,
  node: CatalogConsumerNode,
  conditional = false,
): Record<string, unknown> {
  const library = catalogLibraryVisual(root, node, conditional);
  const authored: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(node.visual))
    if (!Object.is(library[key], value)) authored[key] = value;
  return authored;
}

/** A color write equal to the library default is still an explicit Icon color choice. */
export function catalogHasAuthoredColor(
  root: CatalogCompositionRoot,
  node: CatalogConsumerNode,
): boolean {
  return (
    catalogAuthoredVisual(root, node).color !== undefined ||
    [node.sourceId, ...(node.collapsedSourceIds ?? [])].some((id) => {
      const entry = root.runtime.graph.getEntry(id);
      return entry?.kind === "node" && entry.visual.color?.kind === "set";
    }) ||
    templatePositionWrites(root, node)?.visual?.color?.kind === "set"
  );
}

/**
 * ADR-276 — the own writes of a template position (a Button's `__icon` · `__label`): the patch the
 * nearest owning instance on the record's path holds at that position (`descendantOverrides`,
 * outermost owner first — ADR-260 Decision 11). None for an owned node or an unpatched position.
 */
function templatePositionWrites(
  root: CatalogCompositionRoot,
  node: CatalogConsumerNode,
): { visual?: Record<string, { kind: string }> } | undefined {
  if (!node.sourceId.startsWith("lib:template:")) return undefined;
  const owners = node.instancePath.filter((id) => !id.startsWith("lib:"));
  for (let index = owners.length - 1; index >= 0; index -= 1) {
    const owner = root.runtime.graph.getEntry(owners[index]!);
    if (owner?.kind !== "node") continue;
    const tail = node.instancePath.slice(
      node.instancePath.lastIndexOf(owner.id),
    );
    const found = owner.descendantOverrides.find(
      (item) =>
        item.kind !== "replace" &&
        item.address.templatePath[item.address.templatePath.length - 1] ===
          node.sourceId &&
        item.address.instances.length <= tail.length &&
        item.address.instances.every((id, at) => id === tail[at]),
    );
    if (found && found.kind !== "replace")
      return found as { visual?: Record<string, { kind: string }> };
  }
  return undefined;
}

/**
 * Resolved layout declarations that differ from the definition's own (template/instance authored
 * layout): the DOM executors inline these over the generated class CSS, as the Rust input reads
 * the whole resolved layout.
 */
export function catalogAuthoredLayout(
  root: CatalogCompositionRoot,
  node: CatalogConsumerNode,
): Record<string, string> {
  const definition = root.runtime.graph.getDefinition(
    node.definitionId as DefinitionId,
  );
  const library: Readonly<Record<string, string>> =
    (definition && "layout" in definition ? definition.layout : undefined) ??
    {};
  const authored: Record<string, string> = {};
  for (const [key, value] of Object.entries(node.layout))
    if (library[key] !== value) authored[key] = value;
  return authored;
}
