import { catalogAvatarCssSize } from "../document/avatarSizeValue";
import { docCounters } from "../docCounters";
import type { DefinitionId, TokenId, VisualField } from "../document/types";
import { catalogTokenValue } from "../document/themedToken";
import { COMPONENT_RULES_TABLE } from "../generated/componentRulesTable";
import {
  catalogLocaleLineHeight,
  catalogTypographyLocale,
} from "./localeTypography";
import type {
  CatalogCompositionRoot,
  CatalogConsumerNode,
} from "./compositionRoot";

/**
 * ADR-319 Phase 1 — the definition values a record resolves to (`catalogLibraryVisual` · its
 * authored difference · its owner-derived difference), kept per record object. They read the
 * record, the definition · tokens (the document revision), the root's color mode (one per root —
 * the memo is the root's) and, for a rule with locale typography (Label · SegmentedControlItem),
 * the locale its ancestors give it (`catalogTypographyLocale` — an ancestor input the record does
 * not carry: part of the key). The theme's installed values change with a new root. Nothing else
 * — no rect, no other record: a size preview keeps every record but the dragged one, so their
 * values are read once per drag. A new input to these functions goes into the key too
 * (`.claude/rules/canvas-rendering.md`). Results are frozen — shared by every caller.
 */
type PaintMemo = {
  readonly revision: number;
  readonly locale: string | undefined;
  library?: Readonly<Record<string, unknown>>;
  conditionalLibrary?: Readonly<Record<string, unknown>>;
  authored?: Readonly<Record<string, unknown>>;
  conditionalAuthored?: Readonly<Record<string, unknown>>;
  derived?: Readonly<Record<string, unknown>>;
};
const paintMemos = new WeakMap<
  CatalogCompositionRoot,
  WeakMap<CatalogConsumerNode, PaintMemo>
>();
let paintMemoBypass = 0;
/**
 * `read` with the memo off — every value computed again (the independent oracle of ADR-319 G1:
 * `catalogCanvasNodeData`). Nests.
 */
export function catalogWithoutPaintMemo<T>(read: () => T): T {
  paintMemoBypass += 1;
  try {
    return read();
  } finally {
    paintMemoBypass -= 1;
  }
}
function paintMemoOf(
  root: CatalogCompositionRoot,
  node: CatalogConsumerNode,
): PaintMemo | undefined {
  if (paintMemoBypass > 0) return undefined;
  let memos = paintMemos.get(root);
  if (!memos) paintMemos.set(root, (memos = new WeakMap()));
  const revision = root.runtime.graph.revision;
  const locale = COMPONENT_RULES_TABLE[root.typeOf(node)]?.localeTypography
    ? typographyLocaleOf(root, node)
    : undefined;
  let memo = memos.get(node);
  if (!memo || memo.revision !== revision || memo.locale !== locale) {
    memo = { revision, locale };
    memos.set(node, memo);
  }
  return memo;
}
const typographyLocaleOf = (
  root: CatalogCompositionRoot,
  node: CatalogConsumerNode,
) =>
  catalogTypographyLocale(
    node,
    (id) => root.domInputs.get(id),
    root.typeOf,
    root.environmentLocale,
  );
const frozen = <T extends object>(value: T): Readonly<T> =>
  Object.freeze(value);

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
): Readonly<Record<string, unknown>> {
  const memo = paintMemoOf(root, node);
  const held = conditional ? memo?.conditionalLibrary : memo?.library;
  if (held) return held;
  const values = frozen(libraryVisualOf(root, node, conditional));
  if (memo) {
    if (conditional) memo.conditionalLibrary = values;
    else memo.library = values;
  }
  return values;
}
function libraryVisualOf(
  root: CatalogCompositionRoot,
  node: CatalogConsumerNode,
  conditional: boolean,
): Record<string, unknown> {
  if (process.env.NODE_ENV === "development")
    docCounters.libraryVisualCalls += 1;
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
      if (typeof choice === "string" || typeof choice === "number")
        apply(choices[String(choice)]);
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
  if (root.typeOf(node) === "Avatar") {
    values.width = catalogAvatarCssSize(node.props.size);
    values.height = catalogAvatarCssSize(node.props.size);
  }
  const typographyRule = COMPONENT_RULES_TABLE[root.typeOf(node)];
  if (typographyRule?.localeTypography) {
    const lineHeight = catalogLocaleLineHeight(
      typographyRule,
      node.props.size,
      typographyLocaleOf(root, node),
      catalogHasExplicitVisual(root, node, "lineHeight"),
    );
    if (lineHeight !== undefined) values.lineHeight = lineHeight;
  }
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
): Readonly<Record<string, unknown>> {
  const derived = node.derivedProps;
  if (!derived) return EMPTY;
  const memo = paintMemoOf(root, node);
  if (memo?.derived) return memo.derived;
  const out = frozen(derivedConditionalVisualOf(root, node, derived));
  if (memo) memo.derived = out;
  return out;
}
const EMPTY: Readonly<Record<string, unknown>> = Object.freeze({});
function derivedConditionalVisualOf(
  root: CatalogCompositionRoot,
  node: CatalogConsumerNode,
  derived: NonNullable<CatalogConsumerNode["derivedProps"]>,
): Record<string, unknown> {
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
  // (ADR-315 Phase 4 — a pinned column's edge line stands over the side widths its Table's part
  //  rule gives a header cell: a part value reads as authored here, `manualBoxRules` Table —
  //  「bottom only」.)
  const edge = node.derivedProps.pinnedEdge !== undefined;
  // (ADR-315 Phase 6 — a merged Table's body Row: its line is its Cells', over the Table's part
  //  value for a body row's bottom line.)
  const cellLines = node.derivedProps.cellLines !== undefined;
  return Object.fromEntries(
    keys
      .filter(
        (key) =>
          authored[key] === undefined ||
          (edge && PINNED_EDGE_WIDTH_KEYS.has(key)) ||
          (cellLines && key === "borderBottomWidth"),
      )
      .map((key) => [key, derived[key]]),
  );
}
/**
 * How an owner-derived prop's rule `containerVariants` block reaches a node no generated sheet
 * draws for (Column · Cell · Row · CardPreview) — one place to classify a new one:
 * - `layout` — the node takes it as its own rest value: the DOM writes it inline
 *   (`domBinding.runtime.ts`) and it changes the box the engine lays out (`compositionRoot.ts` — a
 *   pinned column's edge · a merged row's line widths · a footer cell's bold). **Why (2026-11-25)**:
 *   the pinned edge was DOM-only — its 1px narrowed the DOM content box, not the Canvas's.
 * - `paint` — inline on the DOM, painted only (a card preview's corner).
 * - `sheet` — ADR-317 Phase 5: the Table sheet's `data-striped` · `data-stripe` blocks draw it,
 *   under the row's states — never inline, even on a node that writes its other derived blocks
 *   inline (a merged Table's Row · Cell). The Canvas paints it (`catalogDerivedRestVisual`).
 */
const DERIVED_VARIANT_DRAW: Readonly<
  Record<string, "layout" | "paint" | "sheet">
> = {
  pinnedEdge: "layout",
  cellLines: "layout",
  mergeLine: "layout",
  inFooter: "layout",
  cardRadius: "paint",
  striped: "sheet",
  cellStripe: "sheet",
};
/**
 * The rest values the DOM writes inline for `node`'s derived blocks (`catalogDerivedRestVisual`)
 * — its sheet-drawn ones (`DERIVED_VARIANT_DRAW` `sheet`) left out.
 */
export function catalogDerivedInlineVisual(
  root: CatalogCompositionRoot,
  node: CatalogConsumerNode,
): Record<string, unknown> {
  const derived = node.derivedProps;
  const sheet = (key: string) => DERIVED_VARIANT_DRAW[key] === "sheet";
  if (!derived || !Object.keys(derived).some(sheet))
    return catalogDerivedRestVisual(root, node);
  return catalogDerivedRestVisual(root, {
    ...node,
    derivedProps: Object.fromEntries(
      Object.entries(derived).filter(([key]) => !sheet(key)),
    ),
  });
}
/**
 * Whether `node` takes an own derived variant's rest value (`DERIVED_VARIANT_DRAW` `layout` ·
 * `paint`) — for its DOM · its layout (`layout` only).
 */
export function catalogTakesDerivedVariant(
  node: CatalogConsumerNode,
  use: "dom" | "layout",
): boolean {
  const derived = node.derivedProps;
  if (!derived) return false;
  for (const [key, draw] of Object.entries(DERIVED_VARIANT_DRAW))
    if (
      derived[key] &&
      draw !== "sheet" &&
      (use === "dom" || draw === "layout")
    )
      return true;
  return false;
}
const PINNED_EDGE_WIDTH_KEYS: ReadonlySet<string> = new Set([
  "borderRightWidth",
  "borderLeftWidth",
]);

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
): Readonly<Record<string, unknown>> {
  const memo = paintMemoOf(root, node);
  const held = conditional ? memo?.conditionalAuthored : memo?.authored;
  if (held) return held;
  const library = catalogLibraryVisual(root, node, conditional);
  const authored: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(node.visual))
    if (!Object.is(library[key], value)) authored[key] = value;
  const out = frozen(authored);
  if (memo) {
    if (conditional) memo.conditionalAuthored = out;
    else memo.authored = out;
  }
  return out;
}

/** A color write equal to the library default is still an explicit Icon color choice. */
export function catalogHasAuthoredColor(
  root: CatalogCompositionRoot,
  node: CatalogConsumerNode,
): boolean {
  return catalogHasAuthoredVisual(root, node, "color");
}

/** 기본값과 같은 명시적 저작값도 부모 context보다 우선한다. */
export function catalogHasAuthoredVisual(
  root: CatalogCompositionRoot,
  node: CatalogConsumerNode,
  key: VisualField,
): boolean {
  return (
    catalogAuthoredVisual(root, node)[key] !== undefined ||
    catalogHasExplicitVisual(root, node, key)
  );
}

/** Part defaults와 같은 값이라도 문서에 기록한 스타일은 runtime CSS보다 우선한다. */
export function catalogHasExplicitVisual(
  root: CatalogCompositionRoot,
  node: CatalogConsumerNode,
  key: VisualField,
): boolean {
  const graph = root.runtime.graph;
  return (
    graph.getDefinitionOverride(node.definitionId as DefinitionId)?.visual?.[
      key
    ]?.kind === "set" ||
    [node.sourceId, ...(node.collapsedSourceIds ?? [])].some((id) => {
      const entry = graph.getEntry(id);
      const definitionId =
        entry?.kind === "node"
          ? entry.definitionId
          : graph.library.templates.get(id as `lib:template:${string}`)
              ?.definitionId;
      return (
        (entry?.kind === "node" && entry.visual[key]?.kind === "set") ||
        (!!definitionId &&
          graph.getDefinitionOverride(definitionId)?.visual?.[key]?.kind ===
            "set")
      );
    }) ||
    templatePositionWrites(root, node)?.visual?.[key]?.kind === "set"
  );
}

/** Explicit semantic writes retain precedence over a controller's Slot defaults. */
export function catalogHasAuthoredProp(
  root: CatalogCompositionRoot,
  node: CatalogConsumerNode,
  key: string,
): boolean {
  const graph = root.runtime.graph;
  return (
    graph.getDefinitionOverride(node.definitionId as DefinitionId)?.defaults[
      key
    ]?.kind === "set" ||
    [node.sourceId, ...(node.collapsedSourceIds ?? [])].some((id) => {
      const entry = graph.getEntry(id);
      if (entry?.kind === "node" && entry.props[key]?.kind === "set")
        return true;
      const template = graph.library.templates.get(
        id as `lib:template:${string}`,
      );
      // Origin root literals are palette defaults. An instance or Library override above
      // is the authored write; a child template's explicit literal remains its own value.
      const originDefault = [...graph.library.definitions.values()].some(
        (definition) => definition.templateRootId === id,
      );
      const value = originDefault ? undefined : template?.props[key];
      return (
        value !== undefined &&
        !(typeof value === "string" && /^\{[^{}]+\}$/.test(value))
      );
    }) ||
    templatePositionWrites(root, node)?.props?.[key]?.kind === "set"
  );
}

/**
 * ADR-276 — the own writes of a template position (a Button's `__icon` · `__label`): the patch the
 * nearest owning instance on the record's path holds at that position (`descendantOverrides`,
 * outermost owner first — ADR-260 Decision 11). None for an owned node or an unpatched position.
 */
/**
 * Whether the instance wrote `key` in a template position's sizing (a px width · height on a part
 * of a placed original — its `descendantOverrides` patch).
 */
export function catalogHasExplicitTemplateSizing(
  root: CatalogCompositionRoot,
  node: CatalogConsumerNode,
  key: string,
): boolean {
  return templatePositionWrites(root, node)?.sizing?.[key]?.kind === "set";
}

function templatePositionWrites(
  root: CatalogCompositionRoot,
  node: CatalogConsumerNode,
):
  | {
      visual?: Record<string, { kind: string }>;
      props?: Record<string, { kind: string }>;
      sizing?: Record<string, { kind: string }>;
    }
  | undefined {
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
      return found as {
        visual?: Record<string, { kind: string }>;
        props?: Record<string, { kind: string }>;
        sizing?: Record<string, { kind: string }>;
      };
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
