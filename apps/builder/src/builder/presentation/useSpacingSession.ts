/**
 * ADR-222 — 활성 spacing 세션·조작 상태의 React 구독 (패널·인라인 입력 공용).
 *
 * 패널은 활성 target 의 spacing 필드에만 세션 **확정값** 을 덮어 읽고 (breakdown §4.1 —
 * dirty/reset 판정은 raw canonical 경로 그대로), 같은 필드를 강조한다. 표시값을 저장
 * 원본으로 쓰지 않는다. 세션이 없으면 null — 패널은 기존 canonical 읽기로 돌아간다.
 */

import { useSyncExternalStore } from "react";
import {
  getActiveSpacingSession,
  subscribeActiveSpacingSession,
  type SpacingSessionSnapshot,
} from "./editorPresentationSpacingSession";
import {
  getSpacingPresentationSnapshot,
  subscribeSpacingPresentation,
  type SpacingActiveTarget,
} from "../workspace/canvas/interaction/spacingPresentation";
import type { SpacingProperty } from "./editorPresentationSpacingCapability";

export interface SpacingSessionView {
  /** 세션이 소유한 노드 */
  readonly nodeId: string;
  readonly snapshot: SpacingSessionSnapshot;
  /** 조작 중인 띠 (press/drag/input) — 없으면 finalizing 중 */
  readonly active: SpacingActiveTarget | null;
  /** 세션이 편집 중인 property (패널 강조·read-only 대상) */
  readonly properties: readonly SpacingProperty[];
}

let cachedView: SpacingSessionView | null = null;
let cachedSession: ReturnType<typeof getActiveSpacingSession> = null;
let cachedSnapshot: SpacingSessionSnapshot | null = null;
let cachedActive: SpacingActiveTarget | null = null;

function readView(): SpacingSessionView | null {
  const session = getActiveSpacingSession();
  if (!session || session.phase === "closed") {
    cachedView = null;
    cachedSession = null;
    return null;
  }
  const snapshot = session.getSnapshot();
  const active = getSpacingPresentationSnapshot().active;
  if (
    cachedView &&
    cachedSession === session &&
    cachedSnapshot === snapshot &&
    cachedActive === active
  ) {
    return cachedView;
  }
  cachedSession = session;
  cachedSnapshot = snapshot;
  cachedActive = active;
  cachedView = {
    nodeId: session.capability.target.nodeId,
    snapshot,
    active,
    properties: session.properties,
  };
  return cachedView;
}

function subscribe(listener: () => void): () => void {
  let unsubscribeSession: (() => void) | null = null;
  const attach = (): void => {
    unsubscribeSession?.();
    unsubscribeSession = getActiveSpacingSession()?.subscribe(listener) ?? null;
  };
  attach();
  const unsubscribeActive = subscribeActiveSpacingSession(() => {
    attach();
    listener();
  });
  const unsubscribePresentation = subscribeSpacingPresentation(listener);
  return () => {
    unsubscribeActive();
    unsubscribePresentation();
    unsubscribeSession?.();
  };
}

/** 활성 spacing 세션 view — 없으면 null. `getSnapshot` 은 참조 안정 (같은 세션·snapshot·active 면 같은 객체). */
export function useSpacingSession(): SpacingSessionView | null {
  return useSyncExternalStore(subscribe, readView, () => null);
}

/** 이 노드의 property 가 세션 소유 중이면 확정값 (px 숫자), 아니면 null. */
export function readSessionSpacingValue(
  view: SpacingSessionView | null,
  nodeId: string | null,
  property: SpacingProperty,
): number | null {
  if (!view || !nodeId || view.nodeId !== nodeId) return null;
  if (!view.properties.includes(property)) return null;
  return view.snapshot.confirmedValues[property] ?? null;
}
