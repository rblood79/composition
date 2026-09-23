/**
 * ADR-234 Phase 2 — 상태 변형 = origin 의 instance. 실행 중 상태 → 변형 patch 층 (두 leg 공용).
 *
 * 변형 노드 (`<origin>--<state>`) 는 origin 의 `reusable` ref + 덮어쓰기다. instance 의 유효값은
 * **origin → (직접 ref 한 변형 · 상속 층) → 실행 중 상태 층 → instance 자기 patch** 순으로 쌓인다
 * (review round 1 m4). 이 모듈은 "실행 중 상태 층" 을 만든다:
 *
 * - 층 순서 `STATE_LAYER_ORDER` (뒤가 이김): 휴지 (`unselected`) → selected → focus-visible →
 *   hover → pressed → disabled. RAC 는 상태가 동시에 켜진다.
 * - 선택 가능한 가족은 origin = 선택 상태, 휴지 모양은 `--unselected` 층. 선택 상태 층은 이관 전
 *   복제본 (`--selected`) 이 남은 문서에서만 있다.
 * - 층 내용: ref 변형 = 자기 patch 전부 (props · style · fills · descendants · `enabled` — 관리 키
 *   제한 없음). 이관 전 복제본 변형 = ADR-230 계약 그대로 관리 키 (color · borderColor · opacity)
 *   + fills 만 — 한 장치로 두 모양을 다 읽는다 (이관 보류 가족도 같은 경로).
 * - 층끼리 합성은 `composePropsPatches` (`null` 보존) — 해석이 끝난 값에 적용하는 쪽이 지운다.
 */
import type { CanonicalNode } from "@composition/shared";

import { composePropsPatches } from "../../adapters/canonical/instanceResolver";
import {
  readStateVariantSelf,
  stateVariantOriginId,
} from "./stateVariantOrigins";
import { STATE_VARIANT_MANAGED_KEYS } from "./stateVariantResolution";

export type StateLayerName =
  | "unselected"
  | "selected"
  | "focus-visible"
  | "hover"
  | "pressed"
  | "disabled";

export const STATE_LAYER_ORDER: readonly StateLayerName[] = [
  "unselected",
  "selected",
  "focus-visible",
  "hover",
  "pressed",
  "disabled",
];

/** 한 상태의 덮어쓰기 — 필드 부재 = 그 상태가 건드리지 않음. */
export interface StateLayer {
  /** props patch (`style` 포함, 값 `null` = 지움). */
  props?: Record<string, unknown>;
  /** fills 교체 (`[]` = 채움 없음 명시). */
  fills?: unknown[];
  /** 자손 patch — origin 자식 기준 path (instance `descendants` 와 같은 규약). */
  descendants?: Record<string, Record<string, unknown>>;
  enabled?: boolean;
}

export interface StateLayerSet {
  originId: string;
  layers: Partial<Record<StateLayerName, StateLayer>>;
}

/** 실행 중 유효 상태 — Canvas 는 selected · disabled 만, Preview 는 RAC render props 전부. */
export interface ActiveVariantStates {
  selected: boolean;
  disabled: boolean;
  hovered?: boolean;
  pressed?: boolean;
  focusVisible?: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stateVariantNodeId(originId: string, name: StateLayerName): string {
  // `unselected` 는 ADR-230 상태 열 밖 (234 신규) — id 규약은 같다.
  return name === "unselected"
    ? `${originId}--unselected`
    : stateVariantOriginId(originId, name);
}

/** 변형 노드 하나 → 층. 이관 전 복제본은 ADR-230 관리 키만 (230 계약). 비면 null. */
export function readStateLayer(
  input: CanonicalNode | undefined,
): StateLayer | null {
  if (!input) return null;
  // Canvas scene 노드는 type 을 origin 으로 열고 props 를 origin 위에 접어 둔다 (ADR-228 scene merge) —
  //   층은 변형 자기 patch 여야 하므로 원본 canonical 노드 (`sourceNode`) 를 읽는다.
  const variant =
    ((input as { sourceNode?: unknown }).sourceNode as
      CanonicalNode | undefined) ?? input;
  if (variant.type === "ref") {
    const layer: StateLayer = {};
    if (isRecord(variant.props) && Object.keys(variant.props).length > 0) {
      layer.props = variant.props;
    }
    if (Array.isArray(variant.fills)) layer.fills = variant.fills;
    const descendants = (variant as { descendants?: unknown }).descendants;
    if (isRecord(descendants) && Object.keys(descendants).length > 0) {
      layer.descendants = descendants as StateLayer["descendants"];
    }
    if (typeof variant.enabled === "boolean") layer.enabled = variant.enabled;
    return Object.keys(layer).length > 0 ? layer : null;
  }
  // ADR-230 복제본 — 관리 키 (배경은 fills 채널) 만 읽는다.
  const style = isRecord(variant.props?.style) ? variant.props.style : {};
  const managed: Record<string, unknown> = {};
  for (const key of STATE_VARIANT_MANAGED_KEYS) {
    if (key === "backgroundColor") continue;
    const value = style[key];
    if (value !== undefined && value !== null && value !== "") {
      managed[key] = value;
    }
  }
  const legacyFills = (
    variant.metadata as { legacyProps?: { fills?: unknown } } | undefined
  )?.legacyProps?.fills;
  const fills = Array.isArray(variant.fills)
    ? variant.fills
    : Array.isArray(legacyFills)
      ? legacyFills
      : undefined;
  const layer: StateLayer = {};
  if (Object.keys(managed).length > 0) layer.props = { style: managed };
  if (fills && fills.length > 0) layer.fills = fills;
  return Object.keys(layer).length > 0 ? layer : null;
}

/**
 * origin 의 상태 변형 층 집합. 변형이 하나도 없으면 null (plain 과 같은 경로). 변형이 있어도 층이
 * 비면 (seed 그대로) 빈 layers — 두 leg 는 아무것도 겹치지 않는다.
 */
export function buildStateLayerSet(
  originId: string,
  lookup: (id: string) => CanonicalNode | undefined,
): StateLayerSet | null {
  const layers: StateLayerSet["layers"] = {};
  let any = false;
  for (const name of STATE_LAYER_ORDER) {
    const found = lookup(stateVariantNodeId(originId, name));
    if (!found) continue;
    const variant =
      ((found as { sourceNode?: unknown }).sourceNode as
        CanonicalNode | undefined) ?? found;
    // origin 자신을 가리키는 변형만 (다른 가족의 우연한 id 충돌 방지).
    if (
      variant.type === "ref" &&
      (variant as { ref?: unknown }).ref !== originId
    ) {
      continue;
    }
    const self = readStateVariantSelf(variant);
    if (self && self.variantOf !== originId) continue;
    any = true;
    const layer = readStateLayer(variant);
    if (layer) layers[name] = layer;
  }
  return any ? { originId, layers } : null;
}

/** 켜진 상태 → 겹칠 층 이름 (정해진 순서, 있는 층만). */
export function activeStateLayerNames(
  set: StateLayerSet,
  active: ActiveVariantStates,
): StateLayerName[] {
  const on = new Set<StateLayerName>();
  if (active.selected) on.add("selected");
  else on.add("unselected");
  if (active.focusVisible) on.add("focus-visible");
  if (active.hovered) on.add("hover");
  if (active.pressed) on.add("pressed");
  if (active.disabled) on.add("disabled");
  return STATE_LAYER_ORDER.filter((name) => on.has(name) && set.layers[name]);
}

/** 층들을 하나로 합성 (뒤가 이김 · `null` 보존). 층이 없으면 null. */
export function composeStateLayers(
  layers: readonly StateLayer[],
): StateLayer | null {
  if (layers.length === 0) return null;
  const out: StateLayer = {};
  for (const layer of layers) {
    if (layer.props) {
      out.props = out.props
        ? composePropsPatches(out.props, layer.props)
        : layer.props;
    }
    if (layer.fills !== undefined) out.fills = layer.fills;
    if (layer.enabled !== undefined) out.enabled = layer.enabled;
    if (layer.descendants) {
      const next = { ...(out.descendants ?? {}) };
      for (const [path, patch] of Object.entries(layer.descendants)) {
        next[path] = next[path]
          ? composePropsPatches(next[path]!, patch)
          : patch;
      }
      out.descendants = next;
    }
  }
  return Object.keys(out).length > 0 ? out : null;
}

/** ADR-234 G4 — 집합 · 켜진 층 이름이 같으면 같은 합성 (정적 목록 항목 500 개가 같은 층을 매번 합성했다). */
const activeLayerCache = new WeakMap<
  StateLayerSet,
  Map<string, StateLayer | null>
>();

/** 켜진 상태의 합성 층 (편의). 결과는 공유 객체 — 호출자는 고치지 않는다. */
export function resolveActiveStateLayer(
  set: StateLayerSet,
  active: ActiveVariantStates,
): StateLayer | null {
  const names = activeStateLayerNames(set, active);
  const key = names.join("|");
  let byKey = activeLayerCache.get(set);
  if (!byKey) {
    byKey = new Map();
    activeLayerCache.set(set, byKey);
  }
  if (byKey.has(key)) return byKey.get(key)!;
  const layer = composeStateLayers(names.map((name) => set.layers[name]!));
  byKey.set(key, layer);
  return layer;
}

/**
 * 변형 노드 자신 (Components 페이지 표시) 의 강제 상태 — `metadata.variant`. origin 에 붙은
 * `selected` (선택 가능한 가족 origin = 선택 상태) 도 여기서 읽는다. 아니면 null.
 */
export function readForcedVariantStates(
  node: { metadata?: unknown; reusable?: unknown } | null | undefined,
): Partial<ActiveVariantStates> | null {
  const variant = (node?.metadata as { variant?: unknown } | undefined)
    ?.variant;
  switch (variant) {
    case "selected":
      return { selected: true };
    case "unselected":
      return { selected: false };
    case "disabled":
      return { disabled: true };
    case "hover":
      return { hovered: true };
    case "pressed":
      return { pressed: true };
    case "focus-visible":
      return { focusVisible: true };
    default:
      return null;
  }
}

// ───────────────────── instance 자기 patch (최종 층) — 소유 키 표 ─────────────────────

/** instance 노드에 **직접 저장된** 키 (체인 중간 상속값 제외) — 상태 층이 건드리지 못한다. */
export interface OwnedPatchKeys {
  propKeys: string[];
  styleKeys: string[];
  fills: boolean;
}

export interface InstanceOwnedKeys extends OwnedPatchKeys {
  descendants: Record<string, OwnedPatchKeys>;
}

function readOwnedPatchKeys(
  patch: unknown,
  fillsOwned: boolean,
): OwnedPatchKeys {
  const record = isRecord(patch) ? patch : {};
  const style = isRecord(record.style) ? record.style : {};
  return {
    propKeys: Object.keys(record).filter((key) => key !== "style"),
    styleKeys: Object.keys(style),
    fills: fillsOwned,
  };
}

/** ref instance (raw canonical 노드) 의 자기 patch 키 표. */
/** ADR-234 G4 — 입력 노드 (불변 canonical · 해석 전 scene 노드) 마다 한 번. */
const ownedKeysCache = new WeakMap<object, InstanceOwnedKeys>();

export function readInstanceOwnedKeys(
  refNode: CanonicalNode | undefined,
): InstanceOwnedKeys {
  if (!refNode) return computeInstanceOwnedKeys(refNode);
  const hit = ownedKeysCache.get(refNode);
  if (hit) return hit;
  const owned = computeInstanceOwnedKeys(refNode);
  ownedKeysCache.set(refNode, owned);
  return owned;
}

function computeInstanceOwnedKeys(
  refNode: CanonicalNode | undefined,
): InstanceOwnedKeys {
  const descendants: Record<string, OwnedPatchKeys> = {};
  const raw = (refNode as { descendants?: unknown } | undefined)?.descendants;
  if (isRecord(raw)) {
    for (const [path, patch] of Object.entries(raw)) {
      if (!isRecord(patch)) continue;
      const {
        fills,
        sizing: _s,
        responsive: _r,
        enabled: _e,
        ...props
      } = patch;
      descendants[path] = readOwnedPatchKeys(
        isRecord(patch.props) ? patch.props : props,
        Array.isArray(fills),
      );
    }
  }
  return {
    ...readOwnedPatchKeys(refNode?.props, Array.isArray(refNode?.fills)),
    descendants,
  };
}

/** 상태 층 props patch 에서 instance 소유 키를 뺀다 (instance 가 이긴다). 비면 null. */
const omitOwnedCache = new WeakMap<
  Record<string, unknown>,
  WeakMap<OwnedPatchKeys, Record<string, unknown> | null>
>();

/** 결과는 (patch, owned) 쌍마다 공유 객체 — 호출자는 고치지 않는다 (ADR-234 G4). */
export function omitOwnedKeys(
  patch: Record<string, unknown> | undefined,
  owned: OwnedPatchKeys | undefined,
): Record<string, unknown> | null {
  if (!patch) return null;
  if (!owned) return patch;
  let byOwned = omitOwnedCache.get(patch);
  if (!byOwned) {
    byOwned = new WeakMap();
    omitOwnedCache.set(patch, byOwned);
  }
  if (byOwned.has(owned)) return byOwned.get(owned)!;
  const result = computeOmitOwnedKeys(patch, owned);
  byOwned.set(owned, result);
  return result;
}

function computeOmitOwnedKeys(
  patch: Record<string, unknown>,
  owned: OwnedPatchKeys,
): Record<string, unknown> | null {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(patch)) {
    if (key === "style") continue;
    if (owned.propKeys.includes(key)) continue;
    out[key] = value;
  }
  if (isRecord(patch.style)) {
    const style: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(patch.style)) {
      if (!owned.styleKeys.includes(key)) style[key] = value;
    }
    if (Object.keys(style).length > 0) out.style = style;
  }
  return Object.keys(out).length > 0 ? out : null;
}

// ───────────────────── Preview render-only projection ─────────────────────

/** resolved instance props 에 실리는 render-only 키 (Preview 전용 — Canvas 는 scene 에 직접 겹친다). */
export const STATE_LAYERS_PROP = "_stateLayers";

export interface StateLayerProjection {
  set: StateLayerSet;
  own: InstanceOwnedKeys;
}

export function readStateLayerProjection(
  value: unknown,
): StateLayerProjection | null {
  if (!isRecord(value)) return null;
  const set = value.set as StateLayerSet | undefined;
  const own = value.own as InstanceOwnedKeys | undefined;
  if (!set || typeof set.originId !== "string" || !isRecord(set.layers)) {
    return null;
  }
  if (!own || !Array.isArray(own.styleKeys)) return null;
  return { set, own };
}
