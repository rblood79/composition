import type { DescendantOverride } from "@composition/shared";

export interface PanelNode {
  id: string;
  type: string;
  props: Record<string, unknown>;
  parent_id?: string | null;
  page_id?: string | null;
  layout_id?: string | null;
  customId?: string | null;
  componentName?: string | null;
  name?: string | null;
  deleted?: boolean;
  reusable?: boolean;
  slot?: false | string[];
  ref?: string;
  descendants?: Record<string, DescendantOverride>;
  metadata?: Record<string, unknown>;
  componentRole?: unknown;
  masterId?: unknown;
  overrides?: unknown;
}
