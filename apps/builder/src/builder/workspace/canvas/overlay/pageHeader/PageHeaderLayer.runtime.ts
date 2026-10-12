/**
 * ADR-221 — 페이지 헤더 DOM 층.
 *
 * `.canvas-container` 안, Skia 캔버스 위에 페이지마다 헤더 노드 하나. DOM 순서 =
 * `orderPagesForPaint` (활성 페이지 마지막) = 헤더끼리의 z-order. 위 페이지 body 와의 가림은
 * 배치 훅의 clip-path 가 맡는다 (clip 밖은 히트도 안 받는다). 배치는 React state 가 아니라
 * 훅이 transform 으로 쓴다 — 이 컴포넌트는 `style` prop 을 렌더하지 않아 재렌더가 훅의
 * 인라인 스타일을 되돌리지 않는다.
 *
 * 히트 (Decision 4): 층 루트에 **native** pointerdown/dblclick 리스너를 위임한다 — 컨테이너의
 * bubble 리스너 (pan · 중앙 핸들러) 보다 먼저 돌아야 `__handled` 계약이 성립한다 (React
 * 합성 핸들러는 root 에서 돌아 너무 늦다). 컨테이너 capture 가드는 `[data-page-header]`
 * 자손이면 Skia 선판정만 건너뛴다.
 */

import { useState, type CSSProperties } from "react";

import { useViewportSyncStore } from "../../stores";

import {
  PAGE_HEADER_HEIGHT,
  type PageHeaderFrame,
  type PageHeaderLod,
} from "./pageHeaderGeometry";

import "./PageHeaderLayer.css";

export const PAGE_HEADER_ATTR = "data-page-header";

/** 헤더 우측 액션 슬롯 (패널 header-action 과 같은 `action-icon-button` 어법). */
export const PAGE_HEADER_ACTION_CLASS = "page-header__action";

/** 이벤트 target 이 페이지 헤더 (또는 그 안 편집기) 인가 — 컨테이너 capture 가드용. */
export function isPageHeaderEventTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return target.closest(`[${PAGE_HEADER_ATTR}]`) !== null;
}

function headerIdFromTarget(target: EventTarget | null): string | null {
  if (!(target instanceof Element)) return null;
  const header = target.closest<HTMLElement>(`[${PAGE_HEADER_ATTR}]`);
  return header?.dataset.pageId ?? null;
}

function isEditorTarget(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest("input") !== null;
}

/**
 * 액션 버튼 위 이벤트인가 — 편집기와 같은 이유로 헤더 제스처에서 제외한다. 리스너는 층
 * 루트에 걸려 있어 버튼 자손의 pointerdown 도 헤더로 올라오는데, 그대로 두면 버튼을 누를
 * 때마다 페이지 선택·드래그가 시작된다.
 */
function isHeaderActionTarget(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    target.closest(`.${PAGE_HEADER_ACTION_CLASS}`) !== null
  );
}

/** 헤더 제스처 대상 페이지 id — 주 버튼이 아니거나 편집기·액션 버튼 위면 null. */
export function resolveHeaderHit(event: MouseEvent): string | null {
  if (event.button !== 0) return null;
  if (isEditorTarget(event.target) || isHeaderActionTarget(event.target)) {
    return null;
  }
  return headerIdFromTarget(event.target);
}

/** 레이어 루트 인라인 변수 — CSS 가 읽는 헤더 높이는 기하 상수 하나에서 나온다. */
export const LAYER_STYLE = {
  "--page-header-height": `${PAGE_HEADER_HEIGHT}px`,
} as CSSProperties;

/** 층이 실제로 그리는 입력 — 제스처 중에는 마지막 settle 값으로 고정된다. */
interface SettledHeaderInput {
  frames: readonly PageHeaderFrame[];
  /** settle zoom 미러 (`useViewportSyncStore.zoom`) — 제스처 중 presentation 과 다르다. */
  zoom: number;
  gestureActive: boolean;
}

/**
 * ADR-226 Decision 1 — 제스처 중 프레임 집합 동결.
 *
 * `frames` 는 뷰포트 컬링 결과라 팬/줌 중 `transientVisiblePageIds` 재계산으로 매 프레임
 * 참조가 바뀌고, 그대로 그리면 마진을 넘나드는 페이지마다 헤더 항목이 mount/unmount 된다
 * (2026-09-19 실측 200p · 줌 0.1 pan 3 s 에 childList 440). 층은 그동안 `data-hidden` 이라
 * 보이지 않으므로, `cameraGestureActive` 인 render 는 마지막 settle 스냅샷을 그대로 돌려
 * prop 변화를 무시한다. gate-off render 가 최신 값을 스냅샷에 올리고 그 커밋의
 * layoutEffect (배치 훅) 가 새 노드 배치 → reveal 을 단독 소유한다.
 *
 * zoom 도 같은 스냅샷에 묶는다 — settle 순서상 카메라 미러 commit 이 gate-off 보다 먼저
 * store 에 쓰여 (reviews/226 round 2 l1) 티어 판정이 gate 안 render 를 한 번 더 만들지
 * 않게, 티어 입력도 gate-off render 에서만 갱신한다.
 *
 * 스냅샷은 render 중 ref 로 갱신한다 — effect 로 한 render 늦게 복사하면 gate-off 커밋이
 * 구 집합을 한 번 더 그려 settle 당 배치가 2회가 된다.
 */
export function useSettledHeaderInput(
  frames: readonly PageHeaderFrame[],
): SettledHeaderInput {
  const gestureActive = useViewportSyncStore((s) => s.cameraGestureActive);
  const zoom = useViewportSyncStore((s) => s.zoom);
  const [settled, setSettled] = useState<SettledHeaderInput>({
    frames,
    zoom,
    gestureActive,
  });
  if (gestureActive) {
    // 동결 — frames · zoom 은 그대로, 게이트 값만 이 render 에 맞춘다.
    if (!settled.gestureActive) {
      setSettled({ ...settled, gestureActive: true });
    }
  } else if (
    settled.gestureActive ||
    settled.frames !== frames ||
    settled.zoom !== zoom
  ) {
    setSettled({ frames, zoom, gestureActive: false });
  }
  return gestureActive
    ? { ...settled, gestureActive }
    : { frames, zoom, gestureActive };
}

export interface PageHeaderLayerProps {
  /** 뷰포트 안 페이지 프레임 (scene 좌표) — Skia 와 같은 소스 (`visiblePageFrames`). */
  frames: readonly PageHeaderFrame[];
  /**
   * 헤더 pointerdown (button 0 · 편집기 밖). drag 시작 / shift 토글 판정은 호출자 (BuilderCanvas)
   * 가 하고, 소비했으면 `event.__handled` 를 세운다. 스페이스 pan 양보도 호출자 판단.
   */
  onHeaderPointerDown?: (pageId: string, event: PointerEvent) => void;
  /** 이름 편집 가능 여부 (components 미러 · 프레임 편집 모드 제외). */
  canRenamePage?: (pageId: string) => boolean;
  /** 편집기 열림 직전 (페이지 전환). */
  onBeginRename?: (pageId: string) => void;
  onRenamePage?: (pageId: string, title: string) => void;
  /** The active page and whether anything is selected (the catalog session, ADR-248 4e). */
  activePageId: string | null;
  hasSelection: boolean;
}

export interface PageHeaderItemProps {
  id: string;
  title: string;
  active: boolean;
  highlighted: boolean;
  editing: boolean;
  /** ADR-226 폭 티어 — compact 는 액션 버튼을 렌더하지 않는다 (CSS 숨김 아님, 노드 6 → 2). */
  lod: PageHeaderLod;
  onRenameCommit: (pageId: string, value: string | null) => void;
}
