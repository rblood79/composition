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
