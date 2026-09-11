/**
 * DataTableEditorPanel 타입 정의
 *
 * DataTablePanel과 함께 사용되는 에디터 패널의 모드 및 상태 타입
 */

/**
 * 에디터 모드 타입
 * - table: DataTable 생성/편집
 * - api: API Endpoint 생성/편집
 * - variable: Variable 생성/편집
 */
export type DataTableEditorMode =
  | { type: "table-create"; projectId: string }
  | { type: "table-edit"; tableId: string }
  | { type: "api-create"; projectId: string }
  | { type: "api-edit"; endpointId: string; initialTab?: ApiEditorTab }
  | { type: "variable-create"; projectId: string }
  | { type: "variable-edit"; variableId: string }
  | null;

/**
 * 에디터 탭 타입들
 */
export type TableEditorTab = "data" | "settings";
export type ApiEditorTab =
  | "params"
  | "headers"
  | "body"
  | "auth"
  | "response";
export type VariableEditorTab = "basic" | "validation" | "transform";

/**
 * 에디터 상태 인터페이스
 */
export interface DataTableEditorState {
  /** 현재 에디터 모드 */
  mode: DataTableEditorMode;
  /** ADR-212 — 편집기 옆에 스냅되는 필드 패널의 대상 (없으면 닫힘). `fieldId` null = 새 필드 */
  fieldPanel: DataTableFieldPanelTarget | null;
}

export interface DataTableFieldPanelTarget {
  collectionId: string;
  fieldId: string | null;
}

/**
 * 에디터 액션 인터페이스
 */
export interface DataTableEditorActions {
  /** 일반 활성화 경로 (ADR-212 UI-8) — 아래 open* 은 이것의 얇은 wrapper */
  open: (mode: NonNullable<DataTableEditorMode>) => void;

  // Table
  openTableCreator: (projectId: string) => void;
  openTableEditor: (tableId: string) => void;

  // API
  openApiCreator: (projectId: string) => void;
  openApiEditor: (endpointId: string, initialTab?: ApiEditorTab) => void;

  // Variable
  openVariableCreator: (projectId: string) => void;
  openVariableEditor: (variableId: string) => void;

  // Field panel (ADR-212)
  openFieldPanel: (collectionId: string, fieldId?: string | null) => void;
  closeFieldPanel: () => void;

  // Common
  close: () => void;
}

/**
 * 에디터 Store 전체 타입
 */
export type DataTableEditorStore = DataTableEditorState &
  DataTableEditorActions;
