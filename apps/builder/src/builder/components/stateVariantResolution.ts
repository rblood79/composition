/**
 * ADR-230 — 상태 변형 origin 의 두 leg 공용 해소 (pure).
 *
 * 입력 축을 나눈다 — origin 색인 (default + `<origin>--<state>` 변형) · **유효 상태** (Canvas 는
 * 조상/collection 투영 뒤, DOM 은 RAC data 속성) · baseline (catalog/default origin) · **명시
 * instance override** (ref 노드 자신의 style/fills). 출력은 render-only 다 — canonical 저장값은
 * 바뀌지 않는다.
 *
 * 관리 키 (`STATE_VARIANT_MANAGED_KEYS`) 는 비기하 시각 키만 — 상태에 따라 geometry 가 바뀌면
 * layout 입력까지 갈라야 하므로 Phase 1 은 색·opacity 로 한정한다 (breakdown §2 Phase 0 확정).
 *
 * 키별 우선순위 (본문 Decision "스타일 소유권"): instance 명시 > disabled > selected > baseline.
 * opacity 는 한 번만 — 상태 origin/instance 가 소유하면 catalog disabled opacity 를 대체한다
 * (Skia 는 `buildSpecNodeData` 의 Disabled opacity 분기, DOM 은 cascade 가 이미 그렇다 — F13).
 *
 * Preview 채널: origin 당 상태 규칙 한 벌 (`collectStateVariantCss`) — instance 는
 * `data-state-origin` 표식만 든다 (규칙 수 = origin × 상태, 문서 크기와 무관 — G3).
 * 방출 순서 = cascade 정책 (같은 specificity 는 후순 우선): selected → focus-visible → hover →
 * pressed → disabled. interaction 규칙은 `:not([data-disabled])` 로 disabled 를 차단한다 —
 * RAC 가 disabled 요소에 hover/pressed 를 안 붙이지만 stylesheet 가 자기 정책을 갖는다.
 *   - default origin 이 소유한 키 → inline 이 `var(--co-<key>, <baseline>)` 로 바뀌고 상태 규칙은
 *     변수만 세팅 (inline 이 stylesheet 를 이기는 F14 경합 회피).
 *   - 소유하지 않은 키 → 상태 규칙이 속성을 직접 세팅. selector 는 (0,3,0) — 생성 CSS
 *     `.react-aria-X[data-selected]` (0,2,0) 위. `!important` 0.
 *   - instance 명시 키 → inline 리터럴 그대로 (stylesheet 를 이긴다 = instance 우선).
 */
import type { CanonicalNode, CompositionDocument } from "@composition/shared";
import { camelToKebab, fillsToCssBackgroundStyle } from "@composition/shared";
import type { FillItem } from "../../types/builder/fill.types";
import {
  ALL_STATE_VARIANTS,
  type StateVariantState,
  isInteractionStateVariant,
  readStateVariantSelf,
  stateVariantOriginId,
} from "./stateVariantOrigins";

export const STATE_VARIANT_MANAGED_KEYS = [
  "backgroundColor",
  "color",
  "borderColor",
  "opacity",
] as const;
export type StateVariantManagedKey =
  (typeof STATE_VARIANT_MANAGED_KEYS)[number];

/** 변형 origin 이 소유한 시각 (관리 키 style + fills). */
export interface StateVariantStyleSet {
  style: Partial<Record<StateVariantManagedKey, unknown>>;
  fills?: FillItem[];
}

/** instance/scene props `_stateVariants` 로 실리는 render-only projection. */
export interface StateVariantProjection {
  originId: string;
  sets: Partial<Record<StateVariantState, StateVariantStyleSet>>;
  /** default origin 이 inline 으로 소유한 관리 키 (fills 는 backgroundColor). */
  defaultOwned: StateVariantManagedKey[];
  /** instance (ref 노드 자신) 가 명시한 관리 키 — 상태 origin 보다 우선. */
  instanceOwned: StateVariantManagedKey[];
}

export const STATE_VARIANTS_PROP = "_stateVariants";

function readFills(node: CanonicalNode | undefined): FillItem[] | undefined {
  if (!node) return undefined;
  const legacy = (
    node.metadata as { legacyProps?: { fills?: unknown } } | undefined
  )?.legacyProps?.fills;
  const fills = Array.isArray(node.fills)
    ? node.fills
    : Array.isArray(legacy)
      ? legacy
      : undefined;
  return fills && fills.length > 0 ? (fills as FillItem[]) : undefined;
}

function readStyle(node: CanonicalNode | undefined): Record<string, unknown> {
  const style = (node?.props as { style?: unknown } | undefined)?.style;
  return style && typeof style === "object"
    ? (style as Record<string, unknown>)
    : {};
}

/** 노드가 inline 으로 소유한 관리 키 (fills 가 있으면 backgroundColor). */
export function readOwnedManagedKeys(
  node: CanonicalNode | undefined,
): StateVariantManagedKey[] {
  const style = readStyle(node);
  const owned: StateVariantManagedKey[] = [];
  const hasFills = readFills(node) !== undefined;
  for (const key of STATE_VARIANT_MANAGED_KEYS) {
    if (key === "backgroundColor" && hasFills) {
      owned.push(key);
      continue;
    }
    if (style[key] !== undefined && style[key] !== null && style[key] !== "") {
      owned.push(key);
    }
  }
  return owned;
}

function readStyleSet(node: CanonicalNode): StateVariantStyleSet | null {
  const style = readStyle(node);
  const managed: StateVariantStyleSet["style"] = {};
  for (const key of STATE_VARIANT_MANAGED_KEYS) {
    if (key === "backgroundColor") continue; // 배경은 fills 채널 (Styles 패널 Background)
    const value = style[key];
    if (value !== undefined && value !== null && value !== "")
      managed[key] = value;
  }
  const fills = readFills(node);
  if (Object.keys(managed).length === 0 && !fills) return null;
  return fills ? { style: managed, fills } : { style: managed };
}

/**
 * master (default origin) 의 상태 변형 집합을 모아 instance 용 projection 을 만든다.
 * 변형 origin 이 하나도 없으면 null — 두 leg 는 종전 경로 (plain 과 동일).
 */
export function buildStateVariantProjection(
  master: CanonicalNode,
  refNode: CanonicalNode | undefined,
  lookup: (id: string) => CanonicalNode | undefined,
): StateVariantProjection | null {
  if (readStateVariantSelf(master)) return null;
  const sets: StateVariantProjection["sets"] = {};
  let any = false;
  // interaction 상태 set 은 DOM 축만 읽는다 (CSS 채널) — Skia overlay 는 선언적 두 상태만 본다.
  for (const state of ALL_STATE_VARIANTS) {
    const variant = lookup(stateVariantOriginId(master.id, state));
    if (!variant) continue;
    any = true;
    const set = readStyleSet(variant);
    if (set) sets[state] = set;
  }
  if (!any) return null;
  return {
    originId: master.id,
    sets,
    defaultOwned: readOwnedManagedKeys(master),
    instanceOwned: readOwnedManagedKeys(refNode),
  };
}

/** `props._stateVariants` 방어적 판독. */
export function readStateVariantProjection(
  value: unknown,
): StateVariantProjection | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Partial<StateVariantProjection>;
  if (typeof v.originId !== "string" || !v.sets || typeof v.sets !== "object")
    return null;
  if (!Array.isArray(v.defaultOwned) || !Array.isArray(v.instanceOwned))
    return null;
  return v as StateVariantProjection;
}

export interface EffectiveDeclarativeState {
  selected: boolean;
  disabled: boolean;
}

export interface StateVariantOverlay {
  /** 관리 키 style patch (fills 파생 배경은 `fills` 로 — 각 leg 가 자기 채널로 변환). */
  style: Partial<Record<StateVariantManagedKey, unknown>>;
  fills: FillItem[] | undefined;
  /** 이 overlay 가 소유하게 된 키 (instance 소유 제외). opacity 가 있으면 catalog disabled opacity 대체. */
  ownedKeys: StateVariantManagedKey[];
}

/** 유효 상태로 상태 origin 의 키를 baseline 위에 겹친다 — selected → disabled 순, instance 소유 키 제외. */
export function resolveStateVariantOverlay(
  projection: StateVariantProjection,
  effective: EffectiveDeclarativeState,
): StateVariantOverlay {
  const instanceOwned = new Set<string>(projection.instanceOwned);
  const style: StateVariantOverlay["style"] = {};
  let fills: FillItem[] | undefined;
  const active: StateVariantState[] = [];
  if (effective.selected) active.push("selected");
  if (effective.disabled) active.push("disabled");
  for (const state of active) {
    const set = projection.sets[state];
    if (!set) continue;
    for (const key of STATE_VARIANT_MANAGED_KEYS) {
      if (key === "backgroundColor") continue;
      const value = set.style[key];
      if (value === undefined || instanceOwned.has(key)) continue;
      style[key] = value;
    }
    if (set.fills && !instanceOwned.has("backgroundColor")) fills = set.fills;
  }
  const ownedKeys: StateVariantManagedKey[] = [];
  for (const key of STATE_VARIANT_MANAGED_KEYS) {
    if (
      key === "backgroundColor" ? fills !== undefined : style[key] !== undefined
    )
      ownedKeys.push(key);
  }
  return { style, fills, ownedKeys };
}

// ───────────────────────────── Preview CSS 채널 ─────────────────────────────

const STATE_DATA_ATTR: Readonly<Record<StateVariantState, string>> = {
  selected: "data-selected",
  disabled: "data-disabled",
  hover: "data-hovered",
  pressed: "data-pressed",
  "focus-visible": "data-focus-visible",
};

export const STATE_ORIGIN_DATA_ATTR = "data-state-origin";

export function stateVariantCssVar(key: StateVariantManagedKey): string {
  return `--co-${camelToKebab(key)}`;
}

function escapeAttrValue(id: string): string {
  return id.replace(/["\\]/g, "\\$&");
}

function formatManagedCssValue(
  key: StateVariantManagedKey,
  value: unknown,
): string | null {
  if (value == null) return null;
  if (typeof value === "number")
    return Number.isFinite(value) ? String(value) : null;
  const s = String(value).trim();
  // CSS 값 화이트리스트 — 선언 종결/블록/주석/URL 문자를 거른다 (문서 소유 값이 stylesheet 로 간다).
  if (s.length === 0 || /[;{}<>\\/]/.test(s)) return null;
  return s;
}

/** 변형 origin 의 style set → 상태 규칙 선언 (key, cssValue). fills 는 단일 backgroundColor 만 (그라디언트는 Phase 후속). */
function styleSetToDeclarations(
  set: StateVariantStyleSet,
): Array<[StateVariantManagedKey, string]> {
  const out: Array<[StateVariantManagedKey, string]> = [];
  if (set.fills) {
    const bg = fillsToCssBackgroundStyle(set.fills).backgroundColor;
    const css = formatManagedCssValue("backgroundColor", bg);
    if (css) out.push(["backgroundColor", css]);
  }
  for (const key of STATE_VARIANT_MANAGED_KEYS) {
    if (key === "backgroundColor") continue;
    const css = formatManagedCssValue(key, set.style[key]);
    if (css) out.push([key, css]);
  }
  return out;
}

interface VariantOriginEntry {
  defaultOrigin?: CanonicalNode;
  variants: Map<StateVariantState, CanonicalNode>;
}

function collectVariantOrigins(
  nodes: readonly CanonicalNode[],
  byOrigin: Map<string, VariantOriginEntry>,
): void {
  for (const node of nodes) {
    if (node.reusable === true) {
      const self = readStateVariantSelf(node);
      if (self) {
        const entry: VariantOriginEntry = byOrigin.get(self.variantOf) ?? {
          variants: new Map(),
        };
        entry.variants.set(self.state, node);
        byOrigin.set(self.variantOf, entry);
      } else {
        const entry: VariantOriginEntry = byOrigin.get(node.id) ?? {
          variants: new Map(),
        };
        entry.defaultOrigin = node;
        byOrigin.set(node.id, entry);
      }
    }
    if (node.children) collectVariantOrigins(node.children, byOrigin);
  }
}

/** CSS 방출 순서 — selected → focus-visible → hover → pressed → disabled (후순 우선). */
export const STATE_VARIANT_CSS_ORDER: readonly StateVariantState[] = [
  "selected",
  "focus-visible",
  "hover",
  "pressed",
  "disabled",
];

/**
 * 문서의 상태 변형 origin 전부 → Preview `<style>` 1장. origin 당 상태별 규칙
 * (`STATE_VARIANT_CSS_ORDER` — disabled 마지막 = 최우선 · interaction 은 disabled 차단).
 * 변형이 없으면 "".
 */
export function collectStateVariantCss(document: CompositionDocument): string {
  const byOrigin = new Map<string, VariantOriginEntry>();
  collectVariantOrigins(document.children, byOrigin);
  const parts: string[] = [];
  for (const [originId, entry] of byOrigin) {
    if (entry.variants.size === 0) continue;
    const defaultOwned = new Set<string>(
      readOwnedManagedKeys(entry.defaultOrigin),
    );
    const escaped = escapeAttrValue(originId);
    for (const state of STATE_VARIANT_CSS_ORDER) {
      const variant = entry.variants.get(state);
      if (!variant) continue;
      const set = readStyleSet(variant);
      if (!set) continue;
      const decls = styleSetToDeclarations(set).map(([key, css]) =>
        defaultOwned.has(key)
          ? `${stateVariantCssVar(key)}:${css}`
          : `${camelToKebab(key)}:${css}`,
      );
      if (decls.length === 0) continue;
      const attr = STATE_DATA_ATTR[state];
      const guard = isInteractionStateVariant(state)
        ? ":not([data-disabled])"
        : "";
      // 두 selector — 표식이 RAC 요소 자체에 있는 경로 (generic) 와 display:contents wrapper 에
      //   있는 경로 (rendererMap 위임 · RAC 요소는 직계 자식) 를 같이 맞춘다. 선언적 (0,3,0) ·
      //   interaction (0,4,0) — hover/pressed 가 selected 를 이기고 disabled 에는 안 붙는다.
      const selector =
        `[${STATE_ORIGIN_DATA_ATTR}="${escaped}"][data-element-id][${attr}]${guard},` +
        `[${STATE_ORIGIN_DATA_ATTR}="${escaped}"] > [data-element-id][${attr}]${guard}`;
      parts.push(`${selector}{${decls.join(";")}}`);
    }
  }
  return parts.join("\n");
}

/**
 * instance inline style 의 관리 키를 var() 로 옮긴다 — default origin 이 소유하고 instance 가
 * 명시하지 않은 키만. 상태 규칙이 변수를 세팅하면 inline 이 그 값을 읽고, 아니면 baseline.
 */
export function toStateVariantInlineStyle(
  style: Record<string, unknown> | undefined,
  projection: StateVariantProjection,
): Record<string, unknown> | undefined {
  if (!style) return style;
  const instanceOwned = new Set<string>(projection.instanceOwned);
  let next: Record<string, unknown> | undefined;
  for (const key of projection.defaultOwned) {
    if (instanceOwned.has(key)) continue;
    const value = style[key];
    if (value === undefined || value === null || value === "") continue;
    const baseline = formatManagedCssValue(key, value);
    if (!baseline) continue;
    next ??= { ...style };
    next[key] = `var(${stateVariantCssVar(key)}, ${baseline})`;
  }
  return next ?? style;
}
