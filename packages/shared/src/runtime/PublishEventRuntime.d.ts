/**
 * Publish Event Runtime
 *
 * Publish 앱에서 이벤트를 관리하고 실행하는 런타임
 *
 * @since 2026-01-02 Phase 3
 */
import type { ElementEvent, EventHandler, EventRuntimeContext, EventType } from '../types/event.types';
/**
 * Publish 이벤트 런타임
 */
export declare class PublishEventRuntime {
    /** 등록된 핸들러 맵 */
    private handlers;
    /** 액션 실행기 */
    private executor;
    /** 런타임 컨텍스트 */
    private context;
    /** 이벤트 실행 카운터 (Rate Limiting) */
    private eventCounter;
    /** Rate Limit 리셋 타이머 */
    private rateLimitResetTimer;
    constructor(context: EventRuntimeContext);
    /**
     * 런타임 정리
     */
    destroy(): void;
    /**
     * 컨텍스트 업데이트
     */
    updateContext(context: Partial<EventRuntimeContext>): void;
    /**
     * 핸들러 키 생성
     */
    private getHandlerKey;
    /**
     * 이벤트 핸들러 등록
     */
    register(elementId: string, events: ElementEvent[]): void;
    /**
     * 특정 요소의 모든 핸들러 해제
     */
    unregister(elementId: string): void;
    /**
     * 모든 핸들러 해제
     */
    unregisterAll(): void;
    /**
     * 핸들러 가져오기
     */
    getHandler(elementId: string, eventType: EventType): EventHandler | null;
    /**
     * 요소의 모든 이벤트 타입 가져오기
     */
    getEventTypes(elementId: string): EventType[];
    /**
     * 이벤트 핸들러 생성
     */
    private createHandler;
    /**
     * 조건 평가
     */
    private evaluateCondition;
    /**
     * 등록된 핸들러 수 반환
     */
    get handlerCount(): number;
    /**
     * 디버그용 상태 덤프
     */
    dumpState(): {
        handlerCount: number;
        handlers: Array<{
            elementId: string;
            eventType: EventType;
        }>;
        state: Record<string, unknown>;
    };
}
export default PublishEventRuntime;
//# sourceMappingURL=PublishEventRuntime.d.ts.map