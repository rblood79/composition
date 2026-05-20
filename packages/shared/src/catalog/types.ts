import type { ComponentTag } from "../types/composition-vocabulary";
import type {
  CanonicalNode,
  CompositionDocument,
} from "../types/composition-document.types";

export type ComponentFamily =
  | "primitives/actions"
  | "fields"
  | "selection"
  | "collections"
  | "overlays"
  | "date-color"
  | "tree-table"
  | "composition-native";

export type PrimitiveFamily = Exclude<ComponentFamily, "composition-native">;

export type CutoverState = "legacy" | "cutting-over" | "catalog";

export type PrimitiveRuntimeSource = "react-aria-components";

export interface PrimitiveRuntimeDescriptor {
  source: PrimitiveRuntimeSource;
  exportName: string;
}

export interface PrimitiveSkiaDescriptor {
  kind:
    | "breadcrumb"
    | "button"
    | "checkbox"
    | "checkbox-group"
    | "color-field"
    | "combo-box"
    | "date-field"
    | "grid-list"
    | "link"
    | "list-box"
    | "menu"
    | "number-field"
    | "radio"
    | "radio-group"
    | "search-field"
    | "separator"
    | "slider"
    | "switch"
    | "tag-group"
    | "text-field"
    | "time-field"
    | "toggle-button";
}

export interface PrimitivePlacementChildTemplate {
  type: ComponentTag;
  props: Record<string, unknown>;
  children?: PrimitivePlacementChildTemplate[];
}

export type PrimitivePlacementDescriptor =
  | { kind: "single-node" }
  | {
      kind: "node-with-children";
      children: PrimitivePlacementChildTemplate[];
    };

export type InspectorFieldKind =
  | "boolean"
  | "enum"
  | "string"
  | "string-array"
  | "number"
  | "icon"
  | "variant"
  | "size"
  | "binding";

export interface VisibilityCondition {
  key?: string;
  equals?: string | number | boolean;
  oneOf?: Array<string | number | boolean>;
  truthy?: boolean;
}

export interface PropContract {
  kind: InspectorFieldKind;
  label?: string;
  default?: unknown;
  section?: "content" | "appearance" | "state" | "locale" | (string & {});
  options?: Array<{ value: string; label: string }>;
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
  multiline?: boolean;
  emptyToUndefined?: boolean;
  visibleWhen?: VisibilityCondition;
  inspector?: boolean;
}

export type PropContractMap = Record<string, PropContract>;

export interface PrimitiveBinding<
  TCanonicalProps extends Record<string, unknown> = Record<string, unknown>,
  TRacProps extends Record<string, unknown> = Record<string, unknown>,
> {
  tag: ComponentTag;
  family: PrimitiveFamily;
  runtime: PrimitiveRuntimeDescriptor;
  defaultProps: Partial<TCanonicalProps>;
  props: {
    accepts: PropContractMap;
  };
  toRacProps: (props: TCanonicalProps) => TRacProps;
  placement?: PrimitivePlacementDescriptor;
  skiaPrimitive?: PrimitiveSkiaDescriptor;
}

export interface PanelMeta {
  category: string;
  label: string;
  icon: string;
  placeable: boolean;
}

export type ComponentCatalogEntry =
  | {
      kind: "primitive";
      type: ComponentTag;
      family: ComponentFamily;
      cutover: CutoverState;
      binding: PrimitiveBinding;
      panel: PanelMeta;
    }
  | {
      kind: "reusable";
      type: ComponentTag;
      family: ComponentFamily;
      cutover: CutoverState;
      reusableId: string;
      panel: PanelMeta;
    }
  | {
      kind: "native";
      type: ComponentTag;
      family: "composition-native";
      cutover: CutoverState;
      panel: PanelMeta;
    };

export interface ReusableCatalogMeta {
  source: "catalog-library";
  phase: "ADR-142-Phase2";
  propsSchema: PropContractMap;
}

export type CatalogReusableRoot = CanonicalNode & {
  reusable: true;
  "x-composition"?: {
    catalog?: ReusableCatalogMeta;
    [key: string]: unknown;
  };
};

export interface ReusableCatalogDocument extends CompositionDocument {
  children: [CatalogReusableRoot];
}
