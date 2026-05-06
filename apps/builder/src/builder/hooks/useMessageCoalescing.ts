/**
 * Message Coalescing Hook
 *
 * 🚀 Phase 6.1: postMessage 파이프라인 최적화
 *
 * 문제:
 * - message 이벤트가 연속으로 들어오면 각 핸들러가 동기 실행되어 Long Task 발생
 * - 특히 드래그/편집 중 UPDATE_ELEMENTS가 빈번하게 발생
 *
 * 해결:
 * - 같은 타입의 메시지는 최신 값으로 덮어쓰기 (코얼레싱)
 * - RAF로 배치 처리하여 프레임 양보
 * - computedStyle은 requestIdleCallback으로 지연 처리
 *
 * @since 2025-12-18 Phase 6.1
 */

// ============================================
// Types
// ============================================

export type CoalescibleMessageType =
  | "UPDATE_ELEMENTS"
  | "UPDATE_ELEMENT_PROPS"
  | "ELEMENT_SELECTED"
  | "ELEMENT_COMPUTED_STYLE"
  | "UPDATE_LAYOUTS"
  | "UPDATE_DATA_TABLES"
  | "UPDATE_API_ENDPOINTS"
  | "UPDATE_VARIABLES"
  | "UPDATE_PAGE_INFO";

export interface CoalescedMessage {
  type: CoalescibleMessageType;
  payload: unknown;
  timestamp: number;
}

export type MessageHandler = (
  type: CoalescibleMessageType,
  payload: unknown,
) => void;

// ============================================
// Message Priority (낮을수록 먼저 처리)
// ============================================

const MESSAGE_PRIORITY: Record<CoalescibleMessageType, number> = {
  // 1순위: 선택 상태 (즉각적인 피드백 필요)
  ELEMENT_SELECTED: 1,

  // 2순위: 페이지/레이아웃 정보 (렌더링에 필요)
  UPDATE_PAGE_INFO: 2,
  UPDATE_LAYOUTS: 3,

  // 3순위: 데이터 (렌더링에 필요)
  UPDATE_DATA_TABLES: 4,
  UPDATE_API_ENDPOINTS: 5,
  UPDATE_VARIABLES: 6,

  // 4순위: 요소 업데이트
  UPDATE_ELEMENTS: 7,
  UPDATE_ELEMENT_PROPS: 8,

  // 5순위: computedStyle (지연 가능)
  ELEMENT_COMPUTED_STYLE: 99,
};

// ============================================
// MessageCoalescer Class
// ============================================

/**
 * 메시지 코얼레싱 및 배치 처리 클래스
 *
 * 사용법:
 * ```typescript
 * const coalescer = new MessageCoalescer((type, payload) => {
 *   // 실제 메시지 처리
 * });
 *
 * // 메시지 수신 시
 * coalescer.enqueue('UPDATE_ELEMENTS', elements);
 * coalescer.enqueue('ELEMENT_SELECTED', { elementId: '...' });
 *
 * // RAF에서 배치 처리됨
 * ```
 */
export class MessageCoalescer {
  private pending = new Map<CoalescibleMessageType, CoalescedMessage>();
  private rafId: number | null = null;
  private handler: MessageHandler;
  private enabled: boolean = true;

  constructor(handler: MessageHandler) {
    this.handler = handler;
  }

  /**
   * 코얼레싱 활성화/비활성화
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) {
      this.clear();
    }
  }

  /**
   * 메시지를 큐에 추가
   * 같은 타입의 메시지는 최신 값으로 덮어쓰기
   */
  enqueue(type: CoalescibleMessageType, payload: unknown): void {
    // 비활성화 상태면 즉시 처리
    if (!this.enabled) {
      this.handler(type, payload);
      return;
    }

    // 코얼레싱: 같은 타입은 최신 값으로 덮어쓰기
    this.pending.set(type, {
      type,
      payload,
      timestamp: Date.now(),
    });

    // RAF 스케줄링 (이미 스케줄링되어 있으면 스킵)
    if (this.rafId === null) {
      this.rafId = requestAnimationFrame(() => this.flush());
    }
  }

  /**
   * 큐에 있는 모든 메시지를 우선순위 순으로 처리
   */
  private flush(): void {
    this.rafId = null;

    if (this.pending.size === 0) {
      return;
    }

    // 현재 배치 복사 후 클리어
    const batch = new Map(this.pending);
    this.pending.clear();

    // 우선순위 순으로 정렬
    const sortedMessages = Array.from(batch.values()).sort(
      (a, b) => MESSAGE_PRIORITY[a.type] - MESSAGE_PRIORITY[b.type],
    );

    // 처리
    for (const msg of sortedMessages) {
      // computedStyle은 idle 시간에 처리
      if (msg.type === "ELEMENT_COMPUTED_STYLE") {
        if ("requestIdleCallback" in window) {
          requestIdleCallback(
            () => this.handler(msg.type, msg.payload),
            { timeout: 100 }, // 최대 100ms 대기
          );
        } else {
          // fallback: setTimeout
          setTimeout(() => this.handler(msg.type, msg.payload), 0);
        }
      } else {
        // 나머지는 즉시 처리
        this.handler(msg.type, msg.payload);
      }
    }
  }

  /**
   * 대기 중인 메시지 클리어
   */
  clear(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.pending.clear();
  }

  /**
   * 대기 중인 메시지 수
   */
  get pendingCount(): number {
    return this.pending.size;
  }

  /**
   * 특정 타입의 메시지가 대기 중인지 확인
   */
  hasPending(type: CoalescibleMessageType): boolean {
    return this.pending.has(type);
  }

  /**
   * 즉시 flush (테스트용)
   */
  flushSync(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }

    const batch = new Map(this.pending);
    this.pending.clear();

    const sortedMessages = Array.from(batch.values()).sort(
      (a, b) => MESSAGE_PRIORITY[a.type] - MESSAGE_PRIORITY[b.type],
    );

    for (const msg of sortedMessages) {
      this.handler(msg.type, msg.payload);
    }
  }
}

// ============================================
// React Hook
// ============================================

import { useRef, useCallback, useEffect } from "react";

/**
 * 메시지 코얼레싱 훅
 *
 * @param handler - 메시지 처리 함수
 * @param enabled - 코얼레싱 활성화 여부 (기본: true)
 * @returns enqueue 함수
 *
 * @example
 * ```tsx
 * const enqueue = useMessageCoalescing((type, payload) => {
 *   switch (type) {
 *     case 'UPDATE_ELEMENTS':
 *       setElementsCanonicalPrimary(payload as Element[]); // ADR-116 G4
 *       break;
 *     case 'ELEMENT_SELECTED':
 *       setSelectedElement(payload);
 *       break;
 *   }
 * });
 *
 * // 메시지 수신 시
 * window.addEventListener('message', (event) => {
 *   if (isCoalescible(event.data.type)) {
 *     enqueue(event.data.type, event.data.payload);
 *   } else {
 *     // 즉시 처리
 *     handleMessage(event.data);
 *   }
 * });
 * ```
 */
export function useMessageCoalescing(
  handler: MessageHandler,
  enabled: boolean = true,
): (type: CoalescibleMessageType, payload: unknown) => void {
  const coalescerRef = useRef<MessageCoalescer | null>(null);
  const handlerRef = useRef(handler);

  // 핸들러 레퍼런스 업데이트
  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  // Coalescer 초기화 (한 번만)
  useEffect(() => {
    coalescerRef.current = new MessageCoalescer((type, payload) => {
      handlerRef.current(type, payload);
    });

    return () => {
      coalescerRef.current?.clear();
      coalescerRef.current = null;
    };
  }, []);

  // enabled 상태 동기화
  useEffect(() => {
    coalescerRef.current?.setEnabled(enabled);
  }, [enabled]);

  // enqueue 함수 (메모이즈)
  const enqueue = useCallback(
    (type: CoalescibleMessageType, payload: unknown) => {
      coalescerRef.current?.enqueue(type, payload);
    },
    [],
  );

  return enqueue;
}

// ============================================
// Utility: Check if message type is coalescible
// ============================================

const COALESCIBLE_TYPES = new Set<string>(Object.keys(MESSAGE_PRIORITY));

/**
 * 메시지 타입이 코얼레싱 가능한지 확인
 */
export function isCoalescibleMessage(
  type: string,
): type is CoalescibleMessageType {
  return COALESCIBLE_TYPES.has(type);
}

// ============================================
// Utility: Element Props Merge Helper
// ============================================

interface ElementPropsUpdate {
  elementId: string;
  props: Record<string, unknown>;
  merge?: boolean;
}

/**
 * 여러 UPDATE_ELEMENT_PROPS 메시지를 하나로 병합
 * 같은 elementId에 대한 props는 병합됨
 */
export function mergeElementPropsUpdates(
  updates: ElementPropsUpdate[],
): Map<string, Record<string, unknown>> {
  const merged = new Map<string, Record<string, unknown>>();

  for (const update of updates) {
    const existing = merged.get(update.elementId);
    if (existing && update.merge !== false) {
      merged.set(update.elementId, { ...existing, ...update.props });
    } else {
      merged.set(update.elementId, { ...update.props });
    }
  }

  return merged;
}
