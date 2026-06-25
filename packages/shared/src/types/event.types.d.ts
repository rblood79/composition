/**
 * Event Types
 *
 * 이벤트 및 액션 관련 타입 정의
 *
 * @since 2026-01-02 Phase 3
 */
/**
 * 지원되는 액션 타입
 */
export type ActionType = 'NAVIGATE_TO_PAGE' | 'SHOW_ALERT' | 'OPEN_URL' | 'SET_STATE' | 'CONSOLE_LOG' | 'API_CALL' | 'UPDATE_ELEMENT' | 'ADD_ELEMENT';
/**
 * 페이지 이동 액션
 */
export interface NavigateToPageAction {
    type: 'NAVIGATE_TO_PAGE';
    config: {
        pageId: string;
        path?: string;
    };
}
/**
 * 알림 표시 액션
 */
export interface ShowAlertAction {
    type: 'SHOW_ALERT';
    config: {
        message: string;
        title?: string;
    };
}
/**
 * URL 열기 액션
 */
export interface OpenUrlAction {
    type: 'OPEN_URL';
    config: {
        url: string;
        target?: '_blank' | '_self';
    };
}
/**
 * 상태 설정 액션
 */
export interface SetStateAction {
    type: 'SET_STATE';
    config: {
        key: string;
        value: unknown;
    };
}
/**
 * 콘솔 로그 액션
 */
export interface ConsoleLogAction {
    type: 'CONSOLE_LOG';
    config: {
        message: string;
        level?: 'log' | 'info' | 'warn' | 'error';
    };
}
/**
 * API 호출 액션
 */
export interface ApiCallAction {
    type: 'API_CALL';
    config: {
        url: string;
        method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
        body?: unknown;
        headers?: Record<string, string>;
    };
}
/**
 * 요소 업데이트 액션 (Publish에서 미지원)
 */
export interface UpdateElementAction {
    type: 'UPDATE_ELEMENT';
    config: {
        elementId: string;
        props: Record<string, unknown>;
    };
}
/**
 * 요소 추가 액션 (Publish에서 미지원)
 */
export interface AddElementAction {
    type: 'ADD_ELEMENT';
    config: {
        parentId: string;
        type: string;
        props: Record<string, unknown>;
    };
}
/**
 * 모든 액션 타입 유니온
 */
export type Action = NavigateToPageAction | ShowAlertAction | OpenUrlAction | SetStateAction | ConsoleLogAction | ApiCallAction | UpdateElementAction | AddElementAction;
/**
 * 이벤트 타입
 */
export type EventType = 'onClick' | 'onDoubleClick' | 'onChange' | 'onFocus' | 'onBlur' | 'onMouseEnter' | 'onMouseLeave' | 'onKeyDown' | 'onKeyUp' | 'onSubmit';
/**
 * 요소 이벤트 정의
 */
export interface ElementEvent {
    type: EventType;
    actions: Action[];
    condition?: {
        field: string;
        operator: '==' | '!=' | '>' | '<' | '>=' | '<=';
        value: unknown;
    };
}
/**
 * 이벤트 핸들러 함수
 */
export type EventHandler = (event?: Event) => void | Promise<void>;
/**
 * 이벤트 런타임 컨텍스트
 */
export interface EventRuntimeContext {
    /** 현재 페이지 ID */
    currentPageId: string | null;
    /** 로컬 상태 */
    state: Map<string, unknown>;
    /** 페이지 이동 함수 */
    navigateToPage: (pageId: string) => void;
}
/**
 * 액션 실행 결과
 */
export interface ActionResult {
    success: boolean;
    error?: string;
    data?: unknown;
}
//# sourceMappingURL=event.types.d.ts.map