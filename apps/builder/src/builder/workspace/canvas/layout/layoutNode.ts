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
  layout_id?: string | null;
  parentId?: string | null;
  pageId?: string | null;
  layoutId?: string | null;
  customId?: string | null;
  componentName?: string | null;
  name?: string | null;
  deleted?: boolean;
  reusable?: boolean;
  slot?: false | string[];
}
