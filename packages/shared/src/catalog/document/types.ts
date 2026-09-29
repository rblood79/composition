import type { ComponentRule } from "../../types/composition-document.types";
/** ADR-248 Phase 1. This module has no Builder or persistence dependency. */
export const CATALOG_FORMAT = "composition-catalog" as const;
export const CATALOG_SCHEMA_VERSION = 1 as const;
export const LIBRARY_CONTRACT_VERSION = 1 as const;

export type EntryKind =
  | "project"
  | "page"
  | "definition"
  | "definitionOverride"
  | "node"
  | "theme"
  | "token"
  | "stateVariable"
  | "interaction"
  | "asset";
export type EntryId<K extends EntryKind = EntryKind> = `project:${K}:${string}`;
export type LibraryDefinitionId = `lib:definition:${string}`;
export type LibraryTemplateId = `lib:template:${string}`;
export type LibraryTokenId = `lib:token:${string}`;
export type DefinitionId = EntryId<"definition"> | LibraryDefinitionId;
export type TemplateId = EntryId<"node"> | LibraryTemplateId;
export type TokenId = EntryId<"token"> | LibraryTokenId;
export type NodeId = EntryId<"node">;
export type DataCollectionId = `data:collection:${string}`;
export type DataFieldId = `data:field:${string}`;
export type DataEndpointId = `data:endpoint:${string}`;
export type ProjectVariableId = `data:variable:${string}`;

export type Scalar = string | number | boolean;
export interface TokenUse {
  kind: "token";
  tokenId: TokenId;
}
export type AuthoredValue = Scalar | TokenUse;
export type ValueType = "string" | "number" | "boolean";
export type TokenType = "color" | "length" | "number" | "string" | "boolean";
export type ThemePreset = {
  tint:
    | "red"
    | "orange"
    | "yellow"
    | "green"
    | "turquoise"
    | "cyan"
    | "blue"
    | "indigo"
    | "purple"
    | "pink";
  neutral: "slate" | "gray" | "zinc" | "neutral" | "stone";
  radius: "none" | "sm" | "md" | "lg" | "xl";
  darkMode: "light" | "dark" | "system";
};
export type VisualField =
  | "color"
  | "backgroundColor"
  | "borderColor"
  | "fill"
  | "opacity"
  | "fontSize"
  | "lineHeight"
  | "fontWeight"
  | "width"
  | "height"
  | "overflow"
  | "radius"
  | "gap"
  | "padding"
  | "borderWidth"
  | "borderStyle"
  | "fillAlpha"
  | "minHeight"
  | "thumbSize"
  | "indentPerLevel"
  | "iconGap"
  | "iconSize"
  // ADR-248 Phase 3 typed extension (사용자 승인 2026-09-29): per-axis padding and min width.
  | "paddingX"
  | "paddingY"
  | "minWidth"
  // Per-side padding (an asymmetric stylesheet padding); a side wins over paddingX/paddingY.
  | "paddingTop"
  | "paddingRight"
  | "paddingBottom"
  | "paddingLeft"
  // ADR-248 Phase 4a: the Style panel's node authoring surface (typography, effects,
  // per-corner radius and per-side border width). CSS values keep their CSS text where the
  // property has no finite typed form (`boxShadow`, `filter`, `transform`, background image).
  | "fontFamily"
  | "fontStyle"
  | "letterSpacing"
  | "textAlign"
  | "textTransform"
  | "textDecoration"
  | "whiteSpace"
  | "wordBreak"
  | "boxShadow"
  | "filter"
  | "transform"
  | "zIndex"
  | "aspectRatio"
  | "backgroundImage"
  | "backgroundSize"
  | "radiusTopLeft"
  | "radiusTopRight"
  | "radiusBottomRight"
  | "radiusBottomLeft"
  | "borderTopWidth"
  | "borderRightWidth"
  | "borderBottomWidth"
  | "borderLeftWidth";
/** Box layout declarations consumed by the Rust layout input and the isolated RAC DOM style. */
export type LayoutField =
  | "display"
  | "flexDirection"
  | "alignItems"
  | "justifyContent"
  | "flexWrap"
  // ADR-248 Phase 3 typed extension (사용자 판정 2026-09-29 — typed 입력 확장): item and
  // placement declarations authored by templates (origin `style`), as CSS values.
  | "position"
  // With `position: absolute`: CSS `left`/`top` from the containing block (Rust `insetLeft`/
  // `insetTop`) — a stylesheet-placed sub-part (a collection item's icon slot).
  | "insetLeft"
  | "insetTop"
  // ADR-248 Phase 4a: node-authored absolute placement from the other two edges.
  | "insetRight"
  | "insetBottom"
  | "flexGrow"
  | "flexShrink"
  | "flexBasis"
  | "alignSelf"
  | "justifySelf"
  | "gridColumnStart"
  | "gridColumnEnd"
  | "gridRowStart"
  | "gridRowEnd"
  | "rowGap"
  | "columnGap"
  | "marginTop"
  | "marginRight"
  | "marginBottom"
  | "marginLeft"
  | "verticalAlign"
  // Container tracks and limits of a rule's Canvas box (`resolveCatalogRuleCanvasBox`).
  | "gridTemplateColumns"
  | "gridTemplateRows"
  | "gridTemplateAreas"
  | "maxWidth"
  | "maxHeight";
export type LayoutValues = Readonly<Partial<Record<LayoutField, string>>>;
/** Node-authored box layout writes (CSS text values, validated per field). */
export type LayoutWrites = Readonly<
  Partial<Record<LayoutField, WriteValue<string>>>
>;
export type SizingField =
  "width" | "height" | "minWidth" | "minHeight" | "maxWidth" | "maxHeight";
export type StateName =
  | "hover"
  | "pressed"
  | "selected"
  | "selectedHover"
  | "selectedPressed"
  | "disabled"
  | "focusVisible";
/**
 * The one state a state-origin template node shows statically (the Components page's
 * `Button/Hover`, `Checkbox/Unselected`, `Disclosure/Collapsed` …). It is the instance layer's own:
 * an outer instance's display state replaces the one of the template it instantiates.
 */
export type DisplayStateName =
  | "selected"
  | "unselected"
  | "disabled"
  | "hover"
  | "pressed"
  | "focusVisible"
  | "collapsed"
  | "current";
export const DISPLAY_STATE_NAMES: readonly DisplayStateName[] = [
  "selected",
  "unselected",
  "disabled",
  "hover",
  "pressed",
  "focusVisible",
  "collapsed",
  "current",
];
export type BreakpointName = "desktop" | "tablet" | "mobile";
export type PagePlacementField =
  | "position"
  | "left"
  | "top"
  | "gridColumnStart"
  | "gridColumnEnd"
  | "gridRowStart"
  | "gridRowEnd";
export interface PageLayoutDeclaration {
  direction?: "auto" | "vertical" | "horizontal";
  gap?: number;
  columns?: number | "auto";
  breakpoints?: Partial<
    Record<BreakpointName, { gap?: number; columns?: number | "auto" }>
  >;
}
export interface PagePlacementDeclaration {
  base: Partial<Record<PagePlacementField, string | number>>;
  breakpoints: Partial<
    Record<BreakpointName, Partial<Record<PagePlacementField, string | number>>>
  >;
}
/** Pixel offsets from the immediate parent's padding-box origin. */
export interface NodePlacement {
  kind: "absolute";
  x: number;
  y: number;
}
export interface PageGuideDeclaration {
  id: string;
  axis: "x" | "y";
  position: number;
}
export type WriteValue<T> =
  { kind: "set"; value: T } | { kind: "remove" } | { kind: "mask" };
export type PropWrites = Readonly<Record<string, WriteValue<AuthoredValue>>>;
export type VisualWrites = Readonly<
  Partial<Record<VisualField, WriteValue<AuthoredValue>>>
>;
export type SizingWrites = Readonly<
  Partial<Record<SizingField, WriteValue<number | null>>>
>;
export type PropValues = Readonly<Record<string, AuthoredValue>>;
export type VisualValues = Readonly<
  Partial<Record<VisualField, AuthoredValue>>
>;
export type StateRules = Readonly<Partial<Record<StateName, VisualWrites>>>;
/** Scalar equality on resolved props; every key must be an accepted prop of the owner definition. */
export type PropCondition = Readonly<Record<string, Scalar>>;
/**
 * Ordered rule applied after `propVisualRules`: matches when every `when` prop equals the resolved
 * value and, if present, `state` is the resolution state. Later rules win.
 */
export interface ConditionalRule {
  when: PropCondition;
  state?: StateName;
  visual?: VisualValues;
  layout?: LayoutValues;
}
/**
 * Values a parent definition applies to its direct children of `child.definitionId` (and, when
 * given, whose resolved props equal `child.props`). Replaces CSS child-selector delegation.
 */
export interface PartRule {
  /**
   * `via`: the rule targets the matching children of a direct child of `via` (a descendant
   * selector through a sub-part wrapper, e.g. `Select > SelectTrigger > SelectValue`).
   */
  child: {
    definitionId: LibraryDefinitionId;
    props?: PropCondition;
    via?: LibraryDefinitionId;
    /** With `via`: resolved props the intermediate wrapper must have. */
    viaProps?: PropCondition;
  };
  when?: PropCondition;
  state?: StateName;
  visual?: VisualValues;
  layout?: LayoutValues;
}

export interface InstanceAddress {
  /** First ID is the authored instance; later IDs are nested template instances. */
  instances: readonly (NodeId | TemplateId)[];
  /** Root-to-target IDs inside the final referenced definition. */
  templatePath: readonly TemplateId[];
}

export type DescendantOverride =
  | {
      kind: "patch";
      address: InstanceAddress;
      props?: PropWrites;
      visual?: VisualWrites;
      sizing?: SizingWrites;
      stateRules?: StateRules;
      /** `false` hides the addressed descendant (slot toggle); absent keeps the template value. */
      enabled?: boolean;
    }
  | { kind: "replace"; address: InstanceAddress; replacementId: NodeId }
  | {
      kind: "fillSlot";
      address: InstanceAddress;
      childIds: readonly NodeId[];
    };

export interface DataBindingRef {
  collectionId: DataCollectionId;
  fieldMap: Readonly<Record<string, DataFieldId>>;
}

export interface ProjectEntry {
  kind: "project";
  id: EntryId<"project">;
  name: string;
  pageIds: readonly EntryId<"page">[];
  definitionIds: readonly EntryId<"definition">[];
  overrideIds: readonly EntryId<"definitionOverride">[];
  themeIds: readonly EntryId<"theme">[];
  tokenIds: readonly EntryId<"token">[];
  stateVariableIds: readonly EntryId<"stateVariable">[];
  interactionIds: readonly EntryId<"interaction">[];
  assetIds: readonly EntryId<"asset">[];
  activeThemeId?: EntryId<"theme">;
  pageLayout?: PageLayoutDeclaration;
}
/** Breakpoints below desktop: desktop is the node's base layer (desktop-first cascade). */
export type ResponsiveBreakpointName = Exclude<BreakpointName, "desktop">;
/**
 * A tablet or mobile override layer. Resolution for mobile applies tablet then mobile over the
 * base (the old `getResponsiveValueWithCascade` order).
 */
export interface NodeResponsiveLayer {
  visual?: VisualWrites;
  layout?: LayoutWrites;
  sizing?: SizingWrites;
  fillSizing?: FillSizing;
}
/** ADR-224 fill intent per axis: a weight, or `null` to release an inherited fill. */
export type FillSizing = Readonly<
  Partial<Record<"width" | "height", { factor: number } | null>>
>;
export type FillBlendMode =
  | "normal"
  | "multiply"
  | "screen"
  | "overlay"
  | "darken"
  | "lighten"
  | "color-dodge"
  | "color-burn"
  | "hard-light"
  | "soft-light"
  | "difference"
  | "exclusion";
export interface CatalogGradientStop {
  /** `#RRGGBBAA`. */
  color: string;
  /** 0–1. */
  position: number;
}
interface FillLayerBase {
  id: string;
  enabled: boolean;
  /** 0–1. */
  opacity: number;
  blendMode: FillBlendMode;
}
/** A node paint layer (the Fill panel's item), bottom to top. */
export type CatalogFillLayer =
  | (FillLayerBase & { kind: "color"; color: string })
  | (FillLayerBase & {
      kind: "linear-gradient";
      stops: readonly CatalogGradientStop[];
      rotation: number;
    })
  | (FillLayerBase & {
      kind: "radial-gradient";
      stops: readonly CatalogGradientStop[];
      center: { x: number; y: number };
      radius: { width: number; height: number };
    })
  | (FillLayerBase & {
      kind: "angular-gradient";
      stops: readonly CatalogGradientStop[];
      center: { x: number; y: number };
      rotation: number;
    })
  | (FillLayerBase & {
      kind: "image";
      url: string;
      mode: "stretch" | "fill" | "fit";
    })
  | (FillLayerBase & {
      kind: "mesh-gradient";
      rows: number;
      columns: number;
      points: readonly {
        position: readonly [number, number];
        color: string;
        leftHandle?: readonly [number, number];
        rightHandle?: readonly [number, number];
        topHandle?: readonly [number, number];
        bottomHandle?: readonly [number, number];
      }[];
    });
/** ADR-021 per-node tint/dark mode override. */
export interface NodeThemeOverride {
  mode?: "light" | "dark";
  tint?: ThemePreset["tint"];
}
export interface PageEntry {
  kind: "page";
  id: EntryId<"page">;
  route: string;
  name: string;
  children: readonly NodeId[];
  placement?: PagePlacementDeclaration;
  guideEntries?: Partial<
    Record<BreakpointName, readonly PageGuideDeclaration[]>
  >;
}
export interface DefinitionEntry {
  kind: "definition";
  id: EntryId<"definition">;
  name: string;
  mode: "primitive" | "composite" | "native";
  accepts: Readonly<Record<string, ValueType>>;
  defaults: PropValues;
  visual: VisualValues;
  stateRules: StateRules;
  bindingId?: string;
  templateRootId?: NodeId;
}
export interface DefinitionOverrideEntry {
  kind: "definitionOverride";
  id: EntryId<"definitionOverride">;
  targetId: LibraryDefinitionId;
  defaults: PropWrites;
  visual: VisualWrites;
  stateRules: StateRules;
}
export interface NodeEntry {
  kind: "node";
  id: NodeId;
  /** Display label only; IDs remain the stable reference address. */
  name?: string;
  definitionId: DefinitionId;
  children: readonly NodeId[];
  props: PropWrites;
  visual: VisualWrites;
  sizing: SizingWrites;
  placement?: NodePlacement;
  stateRules?: StateRules;
  descendantOverrides: readonly DescendantOverride[];
  binding?: DataBindingRef;
  slot?: { name: string; required: boolean };
  /** Named content regions declared by an authored container. */
  regions?: readonly { name: string; required: boolean }[];
  placeholder?: boolean;
  /** `false` hides the node and its subtree from every consumer (canonical `enabled`, G0 map). */
  enabled?: boolean;
  /** Authored box layout over the definition and rule layout (ADR-248 Phase 4a). */
  layout?: LayoutWrites;
  /** Paint layers; absent = the definition's fill. */
  fills?: readonly CatalogFillLayer[];
  fillSizing?: FillSizing;
  responsive?: Partial<Record<ResponsiveBreakpointName, NodeResponsiveLayer>>;
  /** Per-breakpoint display (cascades like the responsive layers); `false` hides the subtree. */
  visibility?: Partial<Record<BreakpointName, boolean>>;
  themeOverride?: NodeThemeOverride;
}
export interface ThemeEntry {
  kind: "theme";
  id: EntryId<"theme">;
  name: string;
  tokenIds: readonly EntryId<"token">[];
  preset: ThemePreset;
}
export interface TokenEntry {
  kind: "token";
  id: EntryId<"token">;
  name: string;
  tokenType: TokenType;
  value: Scalar;
  source: "spec-token" | "user-defined";
}
export interface StateVariableEntry {
  kind: "stateVariable";
  id: EntryId<"stateVariable">;
  ownerId: EntryId<"page"> | NodeId;
  name: string;
  valueType: ValueType;
  defaultValue: Scalar;
}
export interface InteractionEntry {
  kind: "interaction";
  id: EntryId<"interaction">;
  ownerId: NodeId;
  address?: InstanceAddress;
  trigger: string;
  action:
    | {
        opcode: "setState";
        variableId: EntryId<"stateVariable"> | ProjectVariableId;
        op: "set" | "toggle" | "increment" | "reset";
        value?: Scalar;
      }
    | { opcode: "navigate"; pageId: EntryId<"page"> }
    | { opcode: "callEndpoint"; endpointId: DataEndpointId }
    | { opcode: "toast"; message: string }
    | {
        opcode: "capability";
        targetId: NodeId;
        capabilityId: string;
        value?: Scalar | readonly Scalar[];
      };
}
export interface AssetEntry {
  kind: "asset";
  id: EntryId<"asset">;
  contentId: string;
  mediaType: string;
  byteLength: number;
  filename: string;
}
export type CatalogEntry =
  | ProjectEntry
  | PageEntry
  | DefinitionEntry
  | DefinitionOverrideEntry
  | NodeEntry
  | ThemeEntry
  | TokenEntry
  | StateVariableEntry
  | InteractionEntry
  | AssetEntry;

export interface CatalogDocument {
  format: typeof CATALOG_FORMAT;
  schemaVersion: typeof CATALOG_SCHEMA_VERSION;
  libraryContractVersion: typeof LIBRARY_CONTRACT_VERSION;
  revision: number;
  projectId: EntryId<"project">;
  rootId: EntryId<"project">;
  /** Wire format only. Runtime mutations use a private indexed table. */
  entries: Readonly<Record<string, CatalogEntry>>;
}

export interface LibraryDefinition {
  id: LibraryDefinitionId;
  name: string;
  mode: "primitive" | "composite" | "native";
  accepts: Readonly<Record<string, ValueType>>;
  defaults: PropValues;
  visual: VisualValues;
  /** Accepted literal values for finite-choice props such as Slot size. */
  propChoices?: Readonly<Record<string, readonly Scalar[]>>;
  /** Visual values selected by a typed prop value, before node visual writes. */
  propVisualRules?: Readonly<
    Record<string, Readonly<Record<string, VisualValues>>>
  >;
  stateRules: StateRules;
  /** Base box layout declaration. */
  layout?: LayoutValues;
  conditionalRules?: readonly ConditionalRule[];
  partRules?: readonly PartRule[];
  bindingId?: string;
  templateRootId?: LibraryTemplateId;
  /**
   * Registered D3 rule (`COMPONENT_RULES_TABLE` key) whose variant paint, state paint and
   * sub-part structure the binding executors read from `CatalogLibrary.rules`. Size geometry
   * that layout needs is also declared as typed values (`visual`/`propVisualRules`).
   */
  ruleId?: string;
}
/**
 * Patch a library template node that instantiates a composite applies to that composite's own
 * template. `templatePath` starts at the composite's template root (same shape as
 * `InstanceAddress.templatePath`); the instance chain is the template node itself.
 */
export interface LibraryDescendantPatch {
  templatePath: readonly LibraryTemplateId[];
  props?: PropValues;
  visual?: VisualValues;
  layout?: LayoutValues;
  enabled?: boolean;
}
export interface LibraryTemplateNode {
  id: LibraryTemplateId;
  definitionId: DefinitionId;
  children: readonly LibraryTemplateId[];
  props: PropValues;
  visual: VisualValues;
  slot?: { name: string; required: boolean };
  /** Authored box/item layout of this template node (origin `style`), over definition rules. */
  layout?: LayoutValues;
  /** `false` hides this template node (and subtree) unless an instance enables it. */
  enabled?: boolean;
  descendantPatches?: readonly LibraryDescendantPatch[];
  /** State-origin template node: the state it displays (`DisplayStateName`). */
  displayState?: DisplayStateName;
  /**
   * Authored visual this template node shows only in a state (the old state layer: a selectable
   * item origin's own style is its selected look, which its resting `--unselected` layer removes).
   */
  stateRules?: StateRules;
}
export interface LibraryToken {
  id: LibraryTokenId;
  tokenType: TokenType;
  value: Scalar;
  source: "spec-token";
}
export interface CatalogLibrary {
  contractVersion: typeof LIBRARY_CONTRACT_VERSION;
  revision: string;
  definitions: ReadonlyMap<LibraryDefinitionId, Readonly<LibraryDefinition>>;
  templates: ReadonlyMap<LibraryTemplateId, Readonly<LibraryTemplateNode>>;
  tokens: ReadonlyMap<LibraryTokenId, Readonly<LibraryToken>>;
  /** Read-only D3 rules referenced by `LibraryDefinition.ruleId` (code catalog data). */
  rules: ReadonlyMap<string, Readonly<ComponentRule>>;
  execution: {
    bindingIds: ReadonlySet<string>;
    triggerIds: ReadonlySet<string>;
    capabilityIds: ReadonlySet<string>;
    actionOpCodes: ReadonlySet<InteractionEntry["action"]["opcode"]>;
  };
}
