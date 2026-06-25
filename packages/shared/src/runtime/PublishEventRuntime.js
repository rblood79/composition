/**
 * Publish Event Runtime
 *
 * Publish 앱에서 이벤트를 관리하고 실행하는 런타임
 *
 * @since 2026-01-02 Phase 3
 */
import { ActionExecutor } from './ActionExecutor';
// ============================================
// Constants
// ============================================
/** 핸들러 풀 최대 크기 */
const MAX_HANDLER_POOL_SIZE = 5000;
/** 이벤트 실행 속도 제한 (초당 최대 횟수) */
const EVENT_RATE_LIMIT = 100;
// ============================================
// PublishEventRuntime Class
// ============================================
/**
 * Publish 이벤트 런타임
 */
export class PublishEventRuntime {
    /** 등록된 핸들러 맵 */
    handlers = new Map();
    /** 액션 실행기 */
    executor;
    /** 런타임 컨텍스트 */
    context;
    /** 이벤트 실행 카운터 (Rate Limiting) */
    eventCounter = new Map();
    /** Rate Limit 리셋 타이머 */
    rateLimitResetTimer = null;
    constructor(context) {
        this.context = context;
        this.executor = new ActionExecutor(context);
        // 1초마다 Rate Limit 카운터 리셋
        this.rateLimitResetTimer = setInterval(() => {
            this.eventCounter.clear();
        }, 1000);
    }
    /**
     * 런타임 정리
     */
    destroy() {
        this.handlers.clear();
        this.eventCounter.clear();
        if (this.rateLimitResetTimer) {
            clearInterval(this.rateLimitResetTimer);
            this.rateLimitResetTimer = null;
        }
    }
    /**
     * 컨텍스트 업데이트
     */
    updateContext(context) {
        this.context = { ...this.context, ...context };
        this.executor.updateContext(this.context);
    }
    /**
     * 핸들러 키 생성
     */
    getHandlerKey(elementId, eventType) {
        return `${elementId}:${eventType}`;
    }
    /**
     * 이벤트 핸들러 등록
     */
    register(elementId, events) {
        for (const event of events) {
            const key = this.getHandlerKey(elementId, event.type);
            // 중복 등록 경고
            if (this.handlers.has(key)) {
                console.debug(`[EventRuntime] Handler already registered: ${key}`);
            }
            // 핸들러 풀 크기 체크
            if (this.handlers.size >= MAX_HANDLER_POOL_SIZE) {
                console.warn(`[EventRuntime] Handler pool exceeds ${MAX_HANDLER_POOL_SIZE}`);
                // LRU 정책으로 오래된 핸들러 제거 (간단히 첫 번째 항목 제거)
                const firstKey = this.handlers.keys().next().value;
                if (firstKey) {
                    this.handlers.delete(firstKey);
                }
            }
            // 핸들러 생성
            const handler = this.createHandler(event);
            this.handlers.set(key, {
                elementId,
                eventType: event.type,
                handler,
                event,
            });
        }
    }
    /**
     * 특정 요소의 모든 핸들러 해제
     */
    unregister(elementId) {
        const keysToDelete = [];
        for (const [key, registered] of this.handlers) {
            if (registered.elementId === elementId) {
                keysToDelete.push(key);
            }
        }
        for (const key of keysToDelete) {
            this.handlers.delete(key);
        }
    }
    /**
     * 모든 핸들러 해제
     */
    unregisterAll() {
        this.handlers.clear();
    }
    /**
     * 핸들러 가져오기
     */
    getHandler(elementId, eventType) {
        const key = this.getHandlerKey(elementId, eventType);
        const registered = this.handlers.get(key);
        return registered?.handler || null;
    }
    /**
     * 요소의 모든 이벤트 타입 가져오기
     */
    getEventTypes(elementId) {
        const types = [];
        for (const [, registered] of this.handlers) {
            if (registered.elementId === elementId) {
                types.push(registered.eventType);
            }
        }
        return types;
    }
    /**
     * 이벤트 핸들러 생성
     */
    createHandler(event) {
        return async (_domEvent) => {
            const key = event.type;
            // Rate Limiting 체크
            const count = this.eventCounter.get(key) || 0;
            if (count >= EVENT_RATE_LIMIT) {
                console.warn(`[EventRuntime] Rate limit exceeded for: ${key}`);
                return;
            }
            this.eventCounter.set(key, count + 1);
            // 조건 평가 (있는 경우)
            if (event.condition) {
                const conditionMet = this.evaluateCondition(event.condition);
                if (!conditionMet) {
                    return;
                }
            }
            // 액션 실행
            try {
                await this.executor.executeAll(event.actions);
            }
            catch (error) {
                console.error('[EventRuntime] Error executing actions:', error);
            }
        };
    }
    /**
     * 조건 평가
     */
    evaluateCondition(condition) {
        const stateValue = this.context.state.get(condition.field);
        switch (condition.operator) {
            case '==':
                return stateValue === condition.value;
            case '!=':
                return stateValue !== condition.value;
            case '>':
                return stateValue > condition.value;
            case '<':
                return stateValue < condition.value;
            case '>=':
                return stateValue >= condition.value;
            case '<=':
                return stateValue <= condition.value;
            default:
                return true;
        }
    }
    /**
     * 등록된 핸들러 수 반환
     */
    get handlerCount() {
        return this.handlers.size;
    }
    /**
     * 디버그용 상태 덤프
     */
    dumpState() {
        const handlers = [];
        for (const [, registered] of this.handlers) {
            handlers.push({
                elementId: registered.elementId,
                eventType: registered.eventType,
            });
        }
        const state = {};
        for (const [key, value] of this.context.state) {
            state[key] = value;
        }
        return {
            handlerCount: this.handlers.size,
            handlers,
            state,
        };
    }
}
export default PublishEventRuntime;
//# sourceMappingURL=PublishEventRuntime.js.map