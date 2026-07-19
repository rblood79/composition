import type {
  DescendantOverride,
  ElementResponsiveConfig,
} from "@composition/shared";

export interface PanelNode {
  id: string;
  type: string;
  props: Record<string, unknown>;
  parent_id?: string | null;
  page_id?: string | null;
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
  /**
   * ADR-154: breakpoint 반응형 override (tablet/mobile). canonicalElementsView
   * 가 이미 방출하는 런타임 필드 — Inspector 배지/편집이 raw override 존재를
   * 판정하려면 타입에 노출돼야 한다 (desktop = base, props.style).
   */
  responsive?: ElementResponsiveConfig;
}
