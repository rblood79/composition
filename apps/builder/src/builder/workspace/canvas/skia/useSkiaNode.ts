/**
 * Skia 렌더 데이터 레지스트리 + React hook
 *
 * @pixi/react의 커스텀 reconciler에서 callback ref가 호출되지 않는 문제를 우회하여
 * 전역 레지스트리(Map) 방식으로 Skia 렌더 데이터를 관리한다.
 *
 * 각 Sprite 컴포넌트에서 useSkiaNode()를 호출하면:
 * 1. element.id 키로 SkiaNodeData를 레지스트리에 등록
 * 2. 언마운트 시 자동 해제
 *
 * SkiaOverlay 렌더 루프에서 buildSkiaTree()를 호출하면:
 * 1. Store의 elements 배열로 트리 구조 구성
 * 2. 레지스트리에서 렌더 데이터 조회
 * 3. PixiJS stage의 Camera 변환을 적용
 *
 * @see docs/RENDERING_ARCHITECTURE.md §5.11 renderSkia() React 컴포넌트 통합
 */

import { useLayoutEffect } from "react";
import type { SkiaNodeData } from "./nodeRenderers";
import { recordInvalidation } from "./renderInvalidation";
import { drainPendingWasmDisposals } from "./deferredDisposal";
import { releaseParagraphsIn } from "./retainedParagraph";
import {
  clearNodePictureCache,
  invalidateNodePicture,
} from "./nodePictureCache";

// ============================================
// 전역 레지스트리
// ============================================

/** element.id → SkiaNodeData 매핑 */
const skiaNodeRegistry = new Map<string, SkiaNodeData>();

/** 레지스트리 변경 버전 (단조 증가) */
let registryVersion = 0;

/** 레지스트리에 Skia 렌더 데이터 등록 */
export function registerSkiaNode(elementId: string, data: SkiaNodeData): void {
  // 동일 참조면 스킵 (useLayoutEffect 재실행 시 중복 방지)
  const oldData = skiaNodeRegistry.get(elementId);
  if (oldData === data) return;

  // 버려지는 노드가 소유하던 paragraph 를 함께 폐기한다 — "수명 = 노드 수명"
  // 계약의 집행 지점 (ADR-174 Phase 2). 실제 delete 는 프레임 flush 후.
  if (oldData) releaseParagraphsIn(oldData);
  skiaNodeRegistry.set(elementId, data);
  registryVersion++;
  // 내용 교체 = record 된 self-draw Picture stale — 즉시 해제 (ADR-153 Phase 3).
  // 키(identity) 불일치로도 재생은 차단되지만, 즉시 해제가 WASM 메모리를 먼저 돌려준다.
  invalidateNodePicture(elementId);
}

/** 레지스트리에서 Skia 렌더 데이터 해제 */
export function unregisterSkiaNode(elementId: string): void {
  const data = skiaNodeRegistry.get(elementId);
  if (data) releaseParagraphsIn(data);
  skiaNodeRegistry.delete(elementId);
  registryVersion++;
  invalidateNodePicture(elementId);
}

/** 레지스트리에서 Skia 렌더 데이터 조회 */
export function getSkiaNode(elementId: string): SkiaNodeData | undefined {
  return skiaNodeRegistry.get(elementId);
}

/** 레지스트리 크기 (디버그용) */
export function getSkiaRegistrySize(): number {
  return skiaNodeRegistry.size;
}

/**
 * 페이지 전환 시 레지스트리를 일괄 초기화한다.
 * 개별 Sprite의 useEffect cleanup보다 먼저 호출하여
 * 전환 프레임에서 stale 노드가 렌더링되는 것을 방지한다.
 */
export function clearSkiaRegistry(): void {
  for (const data of skiaNodeRegistry.values()) releaseParagraphsIn(data);
  skiaNodeRegistry.clear();
  registryVersion++;
  clearNodePictureCache();
  // 페이지 전환은 프레임 밖(React commit) 이고 한 번에 캐시 전량을 폐기 큐로
  // 보낸다. hidden 탭처럼 rAF 가 멈춰 flush 가 오래 없는 상태에서도 큐가
  // 적체하지 않도록 여기서 배수한다 (ADR-174 R3).
  drainPendingWasmDisposals();
  recordInvalidation("content", "clearSkiaRegistry");
}

/** 현재 레지스트리 변경 버전 (O(1)) */
export function getRegistryVersion(): number {
  return registryVersion;
}

/**
 * 외부 레이아웃 변경(Taffy/Dropflow 엔진 재계산 등)을 Skia 렌더 루프에 알린다.
 * registryVersion을 증가시켜 다음 프레임에서 재렌더링하도록 한다.
 *
 * elementRegistry.updateElementBounds() → DirectContainer 엔진 재계산 후 호출
 */
export function notifyLayoutChange(): void {
  registryVersion++;
  recordInvalidation("content", "notifyLayoutChange");
}

// ============================================
// React Hook
// ============================================

/**
 * element의 Skia 렌더 데이터를 전역 레지스트리에 등록하는 hook.
 *
 * 사용법:
 * ```tsx
 * useSkiaNode(element.id, {
 *   type: 'box',
 *   x: 0, y: 0,
 *   width: 100, height: 100,
 *   visible: true,
 *   box: { fillColor: Float32Array.of(1,0,0,1), borderRadius: 0 },
 * });
 * ```
 */
export function useSkiaNode(
  elementId: string,
  data: SkiaNodeData | null,
): void {
  useLayoutEffect(() => {
    if (!data) return;

    registerSkiaNode(elementId, data);

    return () => {
      unregisterSkiaNode(elementId);
    };
  }, [elementId, data]);
}

// dev 전용 디버그 전역 — CSS↔Skia parity 검증 하니스(콘솔/Chrome MCP)가 render 결과
// (built SkiaNodeData: text.fontSize/align 등 glyph 채널)를 읽는 진입점. layout 측
// `__composition_LAYOUT_DEBUG__.getSharedLayoutMap` 의 render 대응. 탭 hidden(RAF pause)
// 시에도 StoreRenderBridge.sync 는 React effect/layout publish 로 실행되어 registry 가
// 갱신되므로, 스크린샷 없이 render-visual 결과(예: ADR-154 반응형 fontSize resolve)를
// window probe 로 확증할 수 있다. production 빌드 제외.
if (typeof window !== "undefined" && import.meta.env?.DEV) {
  (window as unknown as Record<string, unknown>).__composition_SKIA_DEBUG__ = {
    getSkiaNode,
    getSkiaRegistrySize,
  };
}
