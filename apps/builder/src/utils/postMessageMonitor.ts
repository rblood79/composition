/**
 * postMessage Monitor
 *
 * 🚀 Phase 9.2: postMessage 지표 수집
 *
 * 기능:
 * - postMessage 호출 횟수 추적
 * - 페이로드 크기 모니터링
 * - 메시지 타입별 통계
 * - 대용량 페이로드 경고
 *
 * @since 2025-12-18 Phase 9.2
 */

import { longTaskMonitor } from "./longTaskMonitor";

// ============================================
// Types
// ============================================

export interface MessageStats {
  count: number;
  totalSizeBytes: number;
  avgSizeBytes: number;
  maxSizeBytes: number;
  lastTimestamp: number;
}

export interface PostMessageReport {
  totalMessages: number;
  totalSizeKB: number;
  avgSizeBytes: number;
  messagesByType: Record<string, MessageStats>;
  largePayloads: Array<{
    type: string;
    sizeBytes: number;
    timestamp: number;
  }>;
  startTime: number;
  durationSeconds: number;
}

// ============================================
// Constants
// ============================================

/** 대용량 페이로드 임계값 (bytes) - 이 값 초과 시 경고 */
const LARGE_PAYLOAD_THRESHOLD = 50 * 1024; // 50KB

/** 대용량 페이로드 기록 최대 개수 */
const MAX_LARGE_PAYLOADS = 50;

// ============================================
// PostMessageMonitor Class
// ============================================

/**
 * postMessage 모니터링 클래스
 *
 * 사용법:
 * ```typescript
 * import { postMessageMonitor } from '@/utils/postMessageMonitor';
 *
 * // 메시지 전송 시 기록
 * const message = { type: 'THEME_VARS', payload: vars };
 * postMessageMonitor.record(message);
 * iframe.contentWindow.postMessage(message, '*');
 *
 * // 리포트 출력
 * postMessageMonitor.printReport();
 * ```
 */
class PostMessageMonitor {
  private messagesByType = new Map<string, MessageStats>();
  private totalMessages = 0;
  private totalSizeBytes = 0;
  private largePayloads: Array<{
    type: string;
    sizeBytes: number;
    timestamp: number;
  }> = [];
  private startTime = Date.now();
  private enabled: boolean;

  constructor() {
    this.enabled = import.meta.env.DEV;
  }

  // ============================================
  // Recording
  // ============================================

  /**
   * postMessage 호출 기록
   *
   * @param message - 전송할 메시지 객체
   */
  record(message: unknown): void {
    if (!this.enabled) return;

    try {
      const messageStr = JSON.stringify(message);
      const sizeBytes = messageStr.length;
      const type = this.extractType(message);
      const now = Date.now();

      // 전체 통계 업데이트
      this.totalMessages++;
      this.totalSizeBytes += sizeBytes;

      // longTaskMonitor에도 기록
      longTaskMonitor.recordPostMessage(sizeBytes);

      // 타입별 통계 업데이트
      const stats = this.messagesByType.get(type) ?? {
        count: 0,
        totalSizeBytes: 0,
        avgSizeBytes: 0,
        maxSizeBytes: 0,
        lastTimestamp: 0,
      };

      stats.count++;
      stats.totalSizeBytes += sizeBytes;
      stats.avgSizeBytes = stats.totalSizeBytes / stats.count;
      stats.maxSizeBytes = Math.max(stats.maxSizeBytes, sizeBytes);
      stats.lastTimestamp = now;

      this.messagesByType.set(type, stats);

      // 대용량 페이로드 기록
      if (sizeBytes > LARGE_PAYLOAD_THRESHOLD) {
        this.largePayloads.push({ type, sizeBytes, timestamp: now });

        // 최대 개수 제한
        if (this.largePayloads.length > MAX_LARGE_PAYLOADS) {
          this.largePayloads.shift();
        }

        console.warn(
          `[postMessage] Large payload: ${type} (${(sizeBytes / 1024).toFixed(1)}KB)`,
        );
      }
    } catch {
      // JSON.stringify 실패 시 무시
    }
  }

  /**
   * 메시지에서 타입 추출
   */
  private extractType(message: unknown): string {
    if (typeof message === "object" && message !== null) {
      const msg = message as Record<string, unknown>;
      if (typeof msg.type === "string") {
        return msg.type;
      }
    }
    return "UNKNOWN";
  }

  // ============================================
  // Reporting
  // ============================================

  /**
   * 리포트 생성
   */
  report(): PostMessageReport {
    const now = Date.now();
    const messagesByType: Record<string, MessageStats> = {};

    for (const [type, stats] of this.messagesByType) {
      messagesByType[type] = { ...stats };
    }

    return {
      totalMessages: this.totalMessages,
      totalSizeKB: this.totalSizeBytes / 1024,
      avgSizeBytes:
        this.totalMessages > 0 ? this.totalSizeBytes / this.totalMessages : 0,
      messagesByType,
      largePayloads: [...this.largePayloads],
      startTime: this.startTime,
      durationSeconds: (now - this.startTime) / 1000,
    };
  }

  /**
   * 콘솔에 리포트 출력
   */
  printReport(): void {
    const report = this.report();

    console.group("📡 postMessage Monitor Report");
    console.log(`Duration: ${report.durationSeconds.toFixed(1)}s`);
    console.log(`Total Messages: ${report.totalMessages}`);
    console.log(`Total Size: ${report.totalSizeKB.toFixed(1)}KB`);
    console.log(`Avg Size: ${report.avgSizeBytes.toFixed(0)} bytes`);

    if (Object.keys(report.messagesByType).length > 0) {
      console.log("\nBy Type:");
      console.table(
        Object.fromEntries(
          Object.entries(report.messagesByType)
            .sort((a, b) => b[1].count - a[1].count)
            .map(([type, stats]) => [
              type,
              {
                count: stats.count,
                totalKB: `${(stats.totalSizeBytes / 1024).toFixed(1)}KB`,
                avgBytes: `${stats.avgSizeBytes.toFixed(0)}B`,
                maxKB: `${(stats.maxSizeBytes / 1024).toFixed(1)}KB`,
              },
            ]),
        ),
      );
    }

    if (report.largePayloads.length > 0) {
      console.log(
        `\nLarge Payloads (>${(LARGE_PAYLOAD_THRESHOLD / 1024).toFixed(0)}KB):`,
      );
      console.table(
        report.largePayloads.slice(-10).map((p) => ({
          type: p.type,
          sizeKB: `${(p.sizeBytes / 1024).toFixed(1)}KB`,
          time: new Date(p.timestamp).toLocaleTimeString(),
        })),
      );
    }

    console.groupEnd();
  }

  // ============================================
  // Control Methods
  // ============================================

  /**
   * 모니터링 활성화/비활성화
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * 통계 초기화
   */
  reset(): void {
    this.messagesByType.clear();
    this.totalMessages = 0;
    this.totalSizeBytes = 0;
    this.largePayloads = [];
    this.startTime = Date.now();
  }

  /**
   * 특정 타입 통계 조회
   */
  getTypeStats(type: string): MessageStats | null {
    return this.messagesByType.get(type) ?? null;
  }
}

// ============================================
// Singleton Instance
// ============================================

export const postMessageMonitor = new PostMessageMonitor();

// ============================================
// Utility: Wrapped postMessage
// ============================================

/**
 * 모니터링이 포함된 postMessage 래퍼
 *
 * @example
 * ```typescript
 * import { monitoredPostMessage } from '@/utils/postMessageMonitor';
 *
 * // 기존: iframe.contentWindow.postMessage(message, '*')
 * // 변경:
 * monitoredPostMessage(iframe.contentWindow, message, '*');
 * ```
 */
export function monitoredPostMessage(
  target: Window | null | undefined,
  message: unknown,
  targetOrigin: string,
  transfer?: Transferable[],
): void {
  // 모니터링 기록
  postMessageMonitor.record(message);

  // 실제 전송
  if (target) {
    target.postMessage(message, targetOrigin, transfer);
  }
}

// ============================================
// DevTools Integration
// ============================================

// 개발 모드에서 전역 접근 가능하게 설정
if (import.meta.env.DEV && typeof window !== "undefined") {
  (
    window as unknown as { postMessageMonitor: PostMessageMonitor }
  ).postMessageMonitor = postMessageMonitor;
}
