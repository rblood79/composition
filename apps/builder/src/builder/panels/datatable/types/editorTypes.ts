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
  | { type: "table-create"; projectId: string; connect?: QuickConnectTarget }
  | { type: "table-edit"; tableId: string }
  | { type: "api-create"; projectId: string }
  | { type: "api-edit"; endpointId: string; initialTab?: ApiEditorTab }
  | { type: "variable-create"; projectId: string }
  | { type: "variable-edit"; variableId: string }
  | null;

/**
 * ADR-013 — Properties Data 행에서 연 Creator 의 연결 대상. 직렬화 가능한 식별 정보만 둔다
 * (선택 요소 객체 · onChange 콜백 보관 금지 — 오래된 참조가 새 상태를 덮는다). `binding` 은
 * 진입 시점 스냅샷 (`readCanonicalDataBindingSnapshot`) — 실행 직전과 commit 경계에서 현재
 * 값과 대조해 그 사이 바뀌었으면 무변경 중단한다.
 */
export interface QuickConnectTarget {
  elementId: string;
  pageId: string | null;
  elementType: string;
  /** 표시용 — customId 우선, 없으면 type */
  elementLabel: string;
  binding: { props?: unknown; extension?: unknown };
}

/**
 * 에디터 탭 타입들
 */
export type ApiEditorTab = "params" | "headers" | "body" | "auth" | "response";

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
  /** 진입점이 요청한 초기 포커스 — 헤더 타입 아이콘 클릭 = 타입 목록. `seq` 는 같은 필드로
   *  다시 눌러도 포커스가 다시 가도록 (effect 의존성). */
  focus?: { section: "type"; seq: number };
}

export interface OpenFieldPanelOptions {
  focus?: "type";
}

/**
 * 에디터 액션 인터페이스
 */
export interface DataTableEditorActions {
  /** 일반 활성화 경로 (ADR-212 UI-8) — 아래 open* 은 이것의 얇은 wrapper */
  open: (mode: NonNullable<DataTableEditorMode>) => void;

  // Table
  openTableCreator: (projectId: string, connect?: QuickConnectTarget) => void;
  openTableEditor: (tableId: string) => void;

  // API
  openApiCreator: (projectId: string) => void;
  openApiEditor: (endpointId: string, initialTab?: ApiEditorTab) => void;

  // Variable
  openVariableCreator: (projectId: string) => void;
  openVariableEditor: (variableId: string) => void;

  // Field panel (ADR-212)
  openFieldPanel: (
    collectionId: string,
    fieldId?: string | null,
    options?: OpenFieldPanelOptions,
  ) => void;
  closeFieldPanel: () => void;

  // Common
  close: () => void;
}

/**
 * 에디터 Store 전체 타입
 */
export type DataTableEditorStore = DataTableEditorState &
  DataTableEditorActions;
