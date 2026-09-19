/**
 * ADR-222 — spacing 편집 transient presentation (breakdown §1.2 상태 머신의 표시 상태).
 *
 * snapGuidePresentation 동형 module-level snapshot. 저장하지 않는 조작 상태 셋만 담는다:
 * - `owner`: 선택된 지원 컨테이너의 capability (선택 변경마다 갱신, 없으면 null)
 * - `hoveredBandId`: hover 중인 띠 하나 (사선·배지)
 * - `active`: 드래그 / 인라인 입력 중인 띠 (사선 없음 · 실시간 배지 · 재타깃 차단)
 *
 * 띠 기하는 저장하지 않는다 — `resolveSpacingBands` 가 렌더/히트 시점에 같은 입력
 * (scene bounds · capability · 활성 세션 확정값) 으로 다시 만든다 (히트 = 그리기).
 */

import type { BoundingBox } from "../selection/types";
import type {
  SpacingBoxMetrics,
  SpacingCapability,
} from "../../../presentation/editorPresentationSpacingCapability";
import { getActiveSpacingSession } from "../../../presentation/editorPresentationSpacingSession";
import { getSceneBounds, getSceneHitBounds } from "../skia/renderCommands";
import { buildSpacingBands, type SpacingBand } from "./spacingGeometry";

/** press = pointerdown 이후 임계값 미만 (사선 제거·핸들 강조), drag = 이동 중, input = 인라인 입력 */
export type SpacingActiveMode = "press" | "drag" | "input";

export interface SpacingActiveTarget {
  /** 포인터가 잡은 띠 */
  readonly bandId: string;
  /** 같이 움직이는 띠 전부 (Option/Alt 양쪽 · 4변) */
  readonly bandIds: readonly string[];
  readonly mode: SpacingActiveMode;
}

export interface SpacingPresentationSnapshot {
  readonly owner: SpacingCapability | null;
  readonly hoveredBandId: string | null;
  readonly active: SpacingActiveTarget | null;
  readonly version: number;
}

const INITIAL_SNAPSHOT: SpacingPresentationSnapshot = Object.freeze({
  owner: null,
  hoveredBandId: null,
  active: null,
  version: 0,
});

let snapshot: SpacingPresentationSnapshot = INITIAL_SNAPSHOT;
const listeners = new Set<() => void>();

function commit(next: Omit<SpacingPresentationSnapshot, "version">): boolean {
  if (
    next.owner === snapshot.owner &&
    next.hoveredBandId === snapshot.hoveredBandId &&
    next.active === snapshot.active
  ) {
    return false;
  }
  snapshot = { ...next, version: snapshot.version + 1 };
  for (const listener of listeners) listener();
  return true;
}

/** 선택 변경 시 owner 교체 — hover·active 는 함께 비운다 (세션 취소는 호출부). */
export function setSpacingOwner(owner: SpacingCapability | null): boolean {
  // 같은 노드의 재판정 (layout publish · breakpoint 재읽기) 은 hover·active 를 지우지 않는다 —
  // 띠 id 는 안정적이라 hover 사선이 publish 마다 깜빡이던 것 방지 (live 하니스 hover 간헐 실패)
  const sameNode =
    owner !== null &&
    snapshot.owner !== null &&
    owner.target.nodeId === snapshot.owner.target.nodeId;
  return commit({
    owner,
    hoveredBandId: sameNode ? snapshot.hoveredBandId : null,
    active: sameNode ? snapshot.active : null,
  });
}

export function setSpacingHover(bandId: string | null): boolean {
  // 드래그·입력 중에는 hover 재타깃을 막는다 (§1.2)
  if (snapshot.active && bandId !== null) return false;
  return commit({ ...snapshot, hoveredBandId: bandId });
}

export function setSpacingActive(active: SpacingActiveTarget | null): boolean {
  return commit({
    ...snapshot,
    hoveredBandId: active ? null : snapshot.hoveredBandId,
    active,
  });
}

export function getSpacingPresentationSnapshot(): SpacingPresentationSnapshot {
  return snapshot;
}

export function subscribeSpacingPresentation(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * 현재 표시할 padding·gap 값 — 활성 세션의 **확정값** 이 capability 의 effective 값을
 * 덮는다 (pending 값은 먼저 보이지 않는다 — §4-5).
 */
export function resolveCurrentSpacingValues(owner: SpacingCapability): {
  readonly padding: SpacingBoxMetrics | null;
  readonly gap: number | null;
} {
  const session = getActiveSpacingSession();
  const confirmed =
    session && session.capability.target.nodeId === owner.target.nodeId
      ? session.getSnapshot().confirmedValues
      : null;
  const padding = owner.padding.supported
    ? {
        top: confirmed?.paddingTop ?? owner.padding.values.top,
        right: confirmed?.paddingRight ?? owner.padding.values.right,
        bottom: confirmed?.paddingBottom ?? owner.padding.values.bottom,
        left: confirmed?.paddingLeft ?? owner.padding.values.left,
      }
    : null;
  const gap = owner.gap.supported
    ? (confirmed?.[owner.gap.property] ?? owner.gap.value)
    : null;
  return { padding, gap };
}

export interface SpacingBandSet {
  readonly bands: readonly SpacingBand[];
  /**
   * owner 의 가시 영역 (원본 박스 ∩ 조상 clip — `hitBoundsMap`, §8.5). 띠는 원본
   * 박스 기준으로 inset 한 뒤 이 rect 로 잘린다 (그리기·히트 둘 다). 전부 잘리면 null.
   */
  readonly clipRect: BoundingBox | null;
}

/**
 * owner 의 띠 목록 (scene 좌표). 렌더·히트가 같은 함수를 읽는다.
 * 원본 박스는 `getSceneBounds` (presentation patch 반영), 가시 영역은 `getSceneHitBounds`.
 * owner 가 stream 에 없으면 null.
 */
export function resolveSpacingBands(
  owner: SpacingCapability | null = snapshot.owner,
): SpacingBandSet | null {
  if (!owner) return null;
  const ownerBounds = getSceneBounds(owner.target.nodeId);
  if (!ownerBounds) return null;
  const { padding, gap } = resolveCurrentSpacingValues(owner);
  const gapInput =
    owner.gap.supported && gap !== null
      ? {
          axis: owner.gap.axis,
          value: gap,
          reverse: owner.gap.reverse,
          childBounds: owner.gap.flowChildIds
            .map((id) => getSceneBounds(id))
            .filter((b): b is BoundingBox => b !== undefined),
        }
      : null;
  return {
    bands: buildSpacingBands({
      ownerBounds,
      border: owner.border,
      padding,
      gap: gapInput,
    }),
    clipRect: getSceneHitBounds(owner.target.nodeId) ?? null,
  };
}

// dev 전용 디버그 전역 — live 하니스 (headed Playwright / Chrome MCP) 가 띠 기하와
// 조작 상태를 읽는 단일 진입점. `__composition_LAYOUT_DEBUG__` 와 같은 이유로 window
// 전역이다 (페이지 `import('/src/...')` 는 다른 모듈 인스턴스). production 빌드 제외.
if (typeof window !== "undefined" && import.meta.env?.DEV) {
  (window as unknown as Record<string, unknown>).__composition_SPACING_DEBUG__ =
    {
      getSnapshot: getSpacingPresentationSnapshot,
      resolveBands: () => resolveSpacingBands(),
      getActiveSession: () => getActiveSpacingSession()?.getSnapshot() ?? null,
    };
}
