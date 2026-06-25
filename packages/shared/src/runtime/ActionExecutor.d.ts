/**
 * Action Executor
 *
 * Publish 앱에서 이벤트 액션을 실행하는 실행기
 *
 * @since 2026-01-02 Phase 3
 */
import type { Action, ActionResult, EventRuntimeContext } from '../types/event.types';
/**
 * 액션 실행기
 */
export declare class ActionExecutor {
    private context;
    constructor(context: EventRuntimeContext);
    /**
     * 컨텍스트 업데이트
     */
    updateContext(context: Partial<EventRuntimeContext>): void;
    /**
     * 액션 실행
     */
    execute(action: Action): Promise<ActionResult>;
    /**
     * 여러 액션 순차 실행
     */
    executeAll(actions: Action[]): Promise<ActionResult[]>;
    /**
     * 페이지 이동 실행
     */
    private executeNavigateToPage;
    /**
     * 알림 표시 실행
     */
    private executeShowAlert;
    /**
     * URL 열기 실행
     */
    private executeOpenUrl;
    /**
     * 상태 설정 실행
     */
    private executeSetState;
    /**
     * 콘솔 로그 실행
     */
    private executeConsoleLog;
    /**
     * API 호출 실행
     */
    private executeApiCall;
    /**
     * PII 마스킹
     */
    private maskPII;
}
export default ActionExecutor;
//# sourceMappingURL=ActionExecutor.d.ts.map