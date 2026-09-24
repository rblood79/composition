/**
 * ADR-234 Phase 2 — Preview 의 상태 변형 층 적용 (RAC render props).
 *
 * RAC 는 상태가 바뀌어도 DOM 구조는 같고 render props (`isSelected` · `isHovered` · `isPressed` ·
 * `isFocusVisible` · `isDisabled`) 만 바뀐다. 그래서 상태 변형은 `style` 함수 (root) 와 `children`
 * 함수 → context (자손) 로 겹친다 — ADR-230 의 문서 `<style>` 규칙 + `--co-*` 변수 채널 대체.
 *
 * 층 순서 · 합성 · instance 소유 키 제외는 두 leg 공용 모듈 (`stateVariantLayers`) 하나.
 */
import React from "react";
import {
  fillsToCssBackgroundStyle,
  routeIndicatorFillStyle,
} from "@composition/shared";

import { applyPropsPatch } from "../../adapters/canonical/instanceResolver";
import {
  omitOwnedKeys,
  resolveActiveStateLayer,
  type ActiveVariantStates,
  type OwnedPatchKeys,
  type StateLayer,
  type StateLayerProjection,
} from "../../builder/components/stateVariantLayers";

/** RAC render props 중 상태 층이 읽는 것. */
export interface RacStateRenderProps {
  isSelected?: boolean;
  isDisabled?: boolean;
  isHovered?: boolean;
  isPressed?: boolean;
  isFocusVisible?: boolean;
  /** ADR-237 — RAC Disclosure render prop (그룹 단일 펼침 제약까지 반영된 실행 중 값). */
  isExpanded?: boolean;
  /** ADR-237 — RAC Breadcrumb render prop (마지막 항목 = current). */
  isCurrent?: boolean;
}

/** 강제 상태 (Components 페이지 변형 노드) 가 RAC 값보다 먼저. */
export function toActiveVariantStates(
  racState: RacStateRenderProps,
  forced: Partial<ActiveVariantStates> | null,
): ActiveVariantStates {
  return {
    selected: forced?.selected ?? racState.isSelected === true,
    disabled: forced?.disabled ?? racState.isDisabled === true,
    hovered: forced?.hovered ?? racState.isHovered === true,
    pressed: forced?.pressed ?? racState.isPressed === true,
    focusVisible: forced?.focusVisible ?? racState.isFocusVisible === true,
    ...(forced?.expanded !== undefined
      ? { expanded: forced.expanded }
      : racState.isExpanded !== undefined
        ? { expanded: racState.isExpanded }
        : {}),
    ...((forced?.current ?? racState.isCurrent === true)
      ? { current: true }
      : {}),
  };
}

/** RAC 밖 경로 (internal renderer · rendererMap) — props 의 선언적 상태만 (Canvas 와 같은 범위). */
export function staticActiveVariantStates(
  props: Record<string, unknown>,
  forced: Partial<ActiveVariantStates> | null,
): ActiveVariantStates {
  return toActiveVariantStates(
    {
      isSelected: props.isSelected === true || props._isSelected === true,
      isDisabled: props.isDisabled === true,
      // ADR-237 — 선언적 펼침 (prop 부재 = 펼침). 그룹 단일 펼침 제약은 RAC render prop 경로가 반영한다.
      ...(props.isExpanded === false ? { isExpanded: false } : {}),
    },
    forced,
  );
}

/**
 * root style 에 켜진 층을 겹친다 — instance 소유 키 제외 · patch `null` 은 지움 · 층 fills 는 배경
 * (Radio 는 선택 표시 색 변수로 — catalog `fill` 뜻, ADR-233 round 3 h1).
 */
export function applyStateLayerToStyle(
  type: string,
  baseStyle: React.CSSProperties | undefined,
  layer: StateLayer | null,
  own: OwnedPatchKeys,
): React.CSSProperties | undefined {
  if (!layer) return baseStyle;
  const patch = omitOwnedKeys(layer.props, own);
  let style = (baseStyle ?? {}) as Record<string, unknown>;
  if (patch?.style) {
    style = (applyPropsPatch({ style }, { style: patch.style }).style ??
      {}) as Record<string, unknown>;
  }
  if (layer.fills !== undefined && !own.fills) {
    const background = fillsToCssBackgroundStyle(layer.fills) as Record<
      string,
      unknown
    >;
    const { backgroundColor: _bg, background: _b, ...rest } = style;
    style =
      layer.fills.length === 0
        ? { ...rest, backgroundColor: "transparent" }
        : { ...rest, ...background };
  }
  return routeIndicatorFillStyle(type, style) as React.CSSProperties;
}

export function resolveStateLayerStyle(
  type: string,
  baseStyle: React.CSSProperties | undefined,
  projection: StateLayerProjection,
  active: ActiveVariantStates,
): React.CSSProperties | undefined {
  return applyStateLayerToStyle(
    type,
    baseStyle,
    resolveActiveStateLayer(projection.set, active),
    projection.own,
  );
}

// ─────────────────────────── 자손 층 (context) ───────────────────────────

export interface StateLayerDescendantsValue {
  /** 층을 가진 instance 의 렌더 path (`CanonicalNodeRenderer` currentPath). */
  rootPath: string;
  /** 켜진 층의 자손 patch — instance 기준 상대 id path. */
  patches: Record<string, Record<string, unknown>>;
  own: Record<string, OwnedPatchKeys>;
}

export const StateLayerDescendantsContext =
  React.createContext<StateLayerDescendantsValue | null>(null);

/** 켜진 층 → 자손 context 값 (자손 patch 가 없으면 null). */
export function toStateLayerDescendantsValue(
  rootPath: string,
  projection: StateLayerProjection,
  active: ActiveVariantStates,
): StateLayerDescendantsValue | null {
  const layer = resolveActiveStateLayer(projection.set, active);
  if (!layer?.descendants) return null;
  return {
    rootPath,
    patches: layer.descendants,
    own: projection.own.descendants,
  };
}

/** 이 층 집합에 자손 patch 가 하나라도 있나 (없으면 children 함수를 만들지 않는다). */
export function hasDescendantStateLayers(
  projection: StateLayerProjection,
): boolean {
  return Object.values(projection.set.layers).some(
    (layer) => layer?.descendants !== undefined,
  );
}

/**
 * 자손 노드의 props 에 켜진 층 patch 를 겹친다. 반환 `hidden` = 층이 `enabled: false` 로 숨김.
 * instance 소유 키 (자기 `descendants` 항목) 는 층이 건드리지 않는다.
 */
export function applyStateLayerToDescendant(
  value: StateLayerDescendantsValue | null,
  currentPath: string,
  props: Record<string, unknown>,
): { props: Record<string, unknown>; hidden: boolean } {
  if (!value || !currentPath.startsWith(`${value.rootPath}/`)) {
    return { props, hidden: false };
  }
  const relative = currentPath.slice(value.rootPath.length + 1);
  const patch = value.patches[relative];
  if (!patch) return { props, hidden: false };
  const {
    fills: _fills,
    enabled,
    sizing: _sizing,
    responsive: _responsive,
    ...rest
  } = patch;
  const own = value.own[relative];
  if (enabled === false) return { props, hidden: true };
  const filtered = omitOwnedKeys(rest, own);
  return {
    props: filtered ? applyPropsPatch(props, filtered) : props,
    hidden: false,
  };
}
