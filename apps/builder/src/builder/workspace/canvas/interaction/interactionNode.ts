export interface CanvasInteractionNode {
  id: string;
  type: string;
  props: Record<string, unknown>;
  parent_id?: string | null;
  page_id?: string | null;
  layout_id?: string | null;
  parentId?: string | null;
  pageId?: string | null;
  layoutId?: string | null;
  deleted?: boolean;
  customId?: string | null;
  componentName?: string | null;
  name?: string | null;
  ref?: string;
  masterId?: string | null;
  componentRole?: unknown;
}
