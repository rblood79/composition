import type { Element } from "../../types/core/store.types";

export interface PanelNode extends Element {
  id: string;
  type: string;
  props: Record<string, unknown>;
  dataBinding?: Element["dataBinding"];
  parent_id?: string | null;
  page_id?: string | null;
  layout_id?: string | null;
  customId?: string;
  componentName?: string;
  name?: string;
  deleted?: boolean;
  reusable?: boolean;
  slot?: false | string[];
  ref?: string;
  descendants?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  componentRole?: "master" | "instance";
  masterId?: string;
  overrides?: Record<string, unknown>;
  "x-composition"?: {
    dataBinding?: Element["dataBinding"];
  };
}
