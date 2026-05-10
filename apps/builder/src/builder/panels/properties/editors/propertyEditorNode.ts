export interface PropertyEditorElementPayload {
  id: string;
  type: string;
  props: Record<string, unknown>;
  parent_id?: string | null;
  page_id?: string | null;
  customId?: string;
  created_at?: string;
  updated_at?: string;
}

export interface PropertyEditorChildNode {
  id: string;
  type: string;
  props: Record<string, unknown>;
  parent_id?: string | null;
}
