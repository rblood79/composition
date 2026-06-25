/**
 * Action Executor
 *
 * Publish 앱에서 이벤트 액션을 실행하는 실행기
 *
 * @since 2026-01-02 Phase 3
 */
// ============================================
// Constants
// ============================================
/** 허용된 URL 스키마 */
const ALLOWED_URL_SCHEMES = ['https:', 'http:', 'mailto:', 'tel:'];
/** 차단된 도메인 */
const BLOCKED_DOMAINS = ['localhost', '127.0.0.1', '0.0.0.0'];
/** API 호출 타임아웃 (ms) */
const API_TIMEOUT = 3000;
/** Alert 메시지 최대 길이 */
const ALERT_MAX_LENGTH = 200;
// ============================================
// URL Validation
// ============================================
/**
 * URL 유효성 검사
 */
function isUrlAllowed(url) {
    try {
        const parsed = new URL(url);
        // 스키마 검증
        if (!ALLOWED_URL_SCHEMES.includes(parsed.protocol)) {
            return false;
        }
        // 로컬호스트 차단
        if (BLOCKED_DOMAINS.some((d) => parsed.hostname.includes(d))) {
            return false;
        }
        return true;
    }
    catch {
        return false;
    }
}
// ============================================
// Action Executor Class
// ============================================
/**
 * 액션 실행기
 */
export class ActionExecutor {
    context;
    constructor(context) {
        this.context = context;
    }
    /**
     * 컨텍스트 업데이트
     */
    updateContext(context) {
        this.context = { ...this.context, ...context };
    }
    /**
     * 액션 실행
     */
    async execute(action) {
        switch (action.type) {
            case 'NAVIGATE_TO_PAGE':
                return this.executeNavigateToPage(action.config);
            case 'SHOW_ALERT':
                return this.executeShowAlert(action.config);
            case 'OPEN_URL':
                return this.executeOpenUrl(action.config);
            case 'SET_STATE':
                return this.executeSetState(action.config);
            case 'CONSOLE_LOG':
                return this.executeConsoleLog(action.config);
            case 'API_CALL':
                return this.executeApiCall(action.config);
            case 'UPDATE_ELEMENT':
            case 'ADD_ELEMENT':
                return {
                    success: false,
                    error: `${action.type} is not available in Publish runtime`,
                };
            default:
                return {
                    success: false,
                    error: `Unknown action type: ${action.type}`,
                };
        }
    }
    /**
     * 여러 액션 순차 실행
     */
    async executeAll(actions) {
        const results = [];
        for (const action of actions) {
            const result = await this.execute(action);
            results.push(result);
            // 에러 발생 시 중단하지 않고 계속 진행
            if (!result.success) {
                console.warn(`[ActionExecutor] Action failed:`, action.type, result.error);
            }
        }
        return results;
    }
    // ============================================
    // Individual Action Executors
    // ============================================
    /**
     * 페이지 이동 실행
     */
    executeNavigateToPage(config) {
        try {
            this.context.navigateToPage(config.pageId);
            return { success: true };
        }
        catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Navigation failed',
            };
        }
    }
    /**
     * 알림 표시 실행
     */
    executeShowAlert(config) {
        try {
            let message = config.message;
            // 메시지 길이 제한
            if (message.length > ALERT_MAX_LENGTH) {
                message = message.slice(0, ALERT_MAX_LENGTH) + '...';
            }
            // 브라우저 alert 사용 (향후 커스텀 모달로 대체 가능)
            if (typeof window !== 'undefined' && window.alert) {
                const fullMessage = config.title ? `${config.title}\n\n${message}` : message;
                window.alert(fullMessage);
            }
            else {
                console.info(`[Alert] ${config.title || ''}: ${message}`);
            }
            return { success: true };
        }
        catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Alert failed',
            };
        }
    }
    /**
     * URL 열기 실행
     */
    executeOpenUrl(config) {
        try {
            // URL 유효성 검사
            if (!isUrlAllowed(config.url)) {
                return {
                    success: false,
                    error: 'Invalid or blocked URL',
                };
            }
            const target = config.target || '_blank';
            // 새 탭 열기 시도
            if (target === '_blank') {
                const newWindow = window.open(config.url, '_blank');
                // 팝업 차단 시 현재 창에서 열기
                if (!newWindow || newWindow.closed) {
                    console.warn('[ActionExecutor] Popup blocked, opening in current tab');
                    window.location.href = config.url;
                    return {
                        success: true,
                        data: { fallback: true, message: 'Popup blocked; opened in current tab' },
                    };
                }
            }
            else {
                window.location.href = config.url;
            }
            return { success: true };
        }
        catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to open URL',
            };
        }
    }
    /**
     * 상태 설정 실행
     */
    executeSetState(config) {
        try {
            this.context.state.set(config.key, config.value);
            return { success: true };
        }
        catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to set state',
            };
        }
    }
    /**
     * 콘솔 로그 실행
     */
    executeConsoleLog(config) {
        try {
            const level = config.level || 'info';
            // PII 마스킹 (이메일, 전화번호 등)
            const maskedMessage = this.maskPII(config.message);
            console[level](`[UserLog] ${maskedMessage}`);
            return { success: true };
        }
        catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Console log failed',
            };
        }
    }
    /**
     * API 호출 실행
     */
    async executeApiCall(config) {
        try {
            // URL 유효성 검사
            if (!isUrlAllowed(config.url)) {
                return {
                    success: false,
                    error: 'Invalid or blocked URL for API call',
                };
            }
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT);
            try {
                const response = await fetch(config.url, {
                    method: config.method || 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                        ...config.headers,
                    },
                    body: config.body ? JSON.stringify(config.body) : undefined,
                    signal: controller.signal,
                });
                clearTimeout(timeoutId);
                if (!response.ok) {
                    return {
                        success: false,
                        error: `API call failed: ${response.status} ${response.statusText}`,
                    };
                }
                const data = await response.json();
                return { success: true, data };
            }
            catch (fetchError) {
                clearTimeout(timeoutId);
                if (fetchError instanceof Error && fetchError.name === 'AbortError') {
                    return {
                        success: false,
                        error: 'API call timed out',
                    };
                }
                // CORS 에러 처리
                return {
                    success: false,
                    error: 'API call failed (possibly CORS blocked)',
                };
            }
        }
        catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'API call failed',
            };
        }
    }
    // ============================================
    // Helper Methods
    // ============================================
    /**
     * PII 마스킹
     */
    maskPII(text) {
        // 이메일 마스킹
        let masked = text.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[EMAIL]');
        // 전화번호 마스킹 (간단한 패턴)
        masked = masked.replace(/\b\d{3}[-.]?\d{3,4}[-.]?\d{4}\b/g, '[PHONE]');
        return masked;
    }
}
export default ActionExecutor;
//# sourceMappingURL=ActionExecutor.js.map