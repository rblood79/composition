/**
 * ADR-126 Phase 2-B layout contract.
 *
 * Layout code consumes a render/layout node shape, not the Builder store node
 * type. During the transition both legacy store nodes and canonical
 * `CanvasSceneNode`s are structurally compatible with this contract.
 */
export interface CanvasLayoutNode {
  id: string;
  type: string;
  props: Record<string, unknown>;
  parent_id?: string | null;
  page_id?: string | null;
  parentId?: string | null;
  pageId?: string | null;
  layoutId?: string | null;
  customId?: string | null;
  componentName?: string | null;
  name?: string | null;
  deleted?: boolean;
  reusable?: boolean;
  slot?: false | string[];
  /**
   * ADR-154 반응형 override. resolve 파이프(useLayoutPublisher / renderCommands)가
   * activeBreakpoint 기준 base⊕override merge 에 사용. 저장은 raw, 소비 시 resolve.
   */
  responsive?: import("@composition/shared").ElementResponsiveConfig;
}
