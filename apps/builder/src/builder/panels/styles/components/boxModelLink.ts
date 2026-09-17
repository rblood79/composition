/**
 * Spacing 박스 모델의 padding link 상태 — 패널 (BoxModelEditor) 과 캔버스 spacing 세션
 * (ADR-222, useSpacingInteraction) 이 같이 읽는다. link ON 이면 어느 변을 편집하든
 * 4변이 같은 값이 된다 (패널 입력 · 캔버스 드래그 · 인라인 입력 공통, 2026-09-17 사용자
 * 지적). UI 상태라 요소·문서에 저장하지 않고 세션 동안만 산다.
 */

import { useSyncExternalStore } from "react";

let linked = false;
const listeners = new Set<() => void>();

export function getPaddingLinked(): boolean {
  return linked;
}

export function setPaddingLinked(next: boolean): void {
  if (linked === next) return;
  linked = next;
  for (const listener of listeners) listener();
}

export function subscribePaddingLinked(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function usePaddingLinked(): boolean {
  return useSyncExternalStore(
    subscribePaddingLinked,
    getPaddingLinked,
    () => false,
  );
}
