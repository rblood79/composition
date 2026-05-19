import type { ComponentTag } from "../types/composition-vocabulary";

export type PrimitiveFamily =
  | "primitives/actions"
  | "fields"
  | "selection"
  | "collections"
  | "overlays"
  | "date-color"
  | "tree-table";

export type PrimitiveRuntimeSource = "react-aria-components";

export interface PrimitiveRuntimeDescriptor {
  source: PrimitiveRuntimeSource;
  exportName: string;
}

export interface PrimitiveSkiaDescriptor {
  kind: "button";
}

export interface PrimitiveBinding<
  TCanonicalProps extends Record<string, unknown> = Record<string, unknown>,
  TRacProps extends Record<string, unknown> = Record<string, unknown>,
> {
  tag: ComponentTag;
  family: PrimitiveFamily;
  runtime: PrimitiveRuntimeDescriptor;
  defaultProps: Partial<TCanonicalProps>;
  accepts: readonly (keyof TCanonicalProps & string)[];
  toRacProps: (props: TCanonicalProps) => TRacProps;
  skiaPrimitive?: PrimitiveSkiaDescriptor;
}
