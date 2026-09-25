/**
 * ADR-222 Phase 0 — 캔버스 padding·gap 직접 편집의 capability 판정과 effective 값 공급.
 *
 * 순수 코어 (`resolveSpacingCapabilityFromInputs`) 는 store 를 모르고, store 바인딩
 * (`resolveSpacingCapability`) 은 canonical 노드 · store elements · 엔진 style 을 모아
 * 코어에 넘긴다. 어느 쪽도 저장하지 않는 read-only 파생값이다 (breakdown §3.1).
 *
 * effective 값의 유일한 원천은 엔진이 마지막으로 소비한 style record
 * (`readPersistentEngineStyle`) 다 — catalog 기본값 · 미지정 0 · 명시 px 가 전부
 * `"Npx"` 로 정규화돼 있어 canonical raw 값이 없어도 편집을 시작할 수 있다.
 * canonical raw 값은 provenance (단위 보존 여부) 판정에만 쓴다.
 *
 * 비-desktop breakpoint (2026-09-17 사용자 승인 — scope 확장): 쓰기 목적지는 Inspector 와
 * 같은 `shouldWriteBreakpointOverride` 판정이다 (eligible + 해당 tier 토글 ON → tier
 * override, 아니면 base). provenance 도 그 목적지의 raw 값으로 본다. 토글 OFF 인데 상위
 * tier override 가 cascade 로 덮고 있으면 base 쓰기가 화면에 안 보이므로 편집을 열지
 * 않는다 (`cascade-shadowed`) — "편집 가능해 보이는데 아무 일도 안 일어남" 을 금지한
 * ADR-222 R5 와 같은 원칙.
 *
 * instance 루트 (2026-09-26 사용자 승인 — scope 확장): 팔레트 배치 요소 대부분이 `type: "ref"`
 * 다. 쓰기는 instance 자신의 `props.style` (origin ⊕ instance patch 의 instance 쪽) 이라 origin
 * 우회 쓰기가 아니다. 판정 입력만 instance 를 알아야 한다 — 타입은 origin 타입, 자식은 store 에
 * 없는 synthetic 노드라 엔진이 배치한 자식 목록에서 읽는다 (`resolveSpacingOwnerStructure`).
 * instance 안쪽 synthetic 자식 (`ref-descendant`) 은 여전히 범위 밖이다.
 */

import {
  containerTypeSet,
  getResponsiveValueWithCascade,
  isBodyType,
  type BreakpointName,
  type ElementResponsiveConfig,
  type ResponsiveValue,
} from "@composition/shared";
import { useStore } from "../stores";
import { useCanonicalDocumentStore } from "../stores/canonical/canonicalDocumentStore";
import { canOperate } from "../domain/canOperate";
import { shouldWriteBreakpointOverride } from "../stores/utils/responsiveWriteRouting";
import {
  editorPresentationCanonicalRuntimeOptions,
  getEditorPresentationTargetNode,
  resolveEditorPresentationTarget,
} from "./editorPresentationCommitAdapter";
import { normalizePresentationSpacingStyle } from "./editorPresentationStyleNormalization";
import type { EditorPresentationTargetRef } from "./editorPresentationTypes";
import {
  getSharedFilteredChildrenMap,
  readPersistentEngineStyle,
} from "../workspace/canvas/layout/engines/fullTreeLayout";
import { getCanonicalRefTarget } from "../../adapters/canonical/canonicalRefResolution";

export type SpacingSide = "top" | "right" | "bottom" | "left";
export const SPACING_SIDES: readonly SpacingSide[] = [
  "top",
  "right",
  "bottom",
  "left",
];

export type SpacingPaddingProperty =
  "paddingTop" | "paddingRight" | "paddingBottom" | "paddingLeft";
export type SpacingGapProperty = "rowGap" | "columnGap";
export type SpacingProperty = SpacingPaddingProperty | SpacingGapProperty;

export const PADDING_PROPERTY_BY_SIDE: Readonly<
  Record<SpacingSide, SpacingPaddingProperty>
> = {
  top: "paddingTop",
  right: "paddingRight",
  bottom: "paddingBottom",
  left: "paddingLeft",
};

export type SpacingUnsupportedReason =
  | "no-selection"
  | "multi-selection"
  | "not-canonical-node"
  | "body"
  | "cascade-shadowed"
  | "engine-style-missing"
  | "position-unsupported"
  | "grid"
  | "grid-ancestor"
  | "transform"
  | "locked"
  | "not-container"
  | "raw-unit-preserved"
  | "not-flex"
  | "wrap"
  | "distributed-alignment"
  | "auto-margin-child"
  | "fewer-than-two-children";

export interface SpacingBoxMetrics {
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly left: number;
}

export type SpacingAxisCapability =
  | {
      readonly supported: true;
      /** 주축 gap property — row 계열은 columnGap, column 계열은 rowGap */
      readonly property: SpacingGapProperty;
      readonly axis: "horizontal" | "vertical";
      readonly reverse: boolean;
      /** effective px (엔진 소비값) */
      readonly value: number;
      /** in-flow 자식 ID (layout 순서) */
      readonly flowChildIds: readonly string[];
    }
  | { readonly supported: false; readonly reason: SpacingUnsupportedReason };

export type SpacingPaddingCapability =
  | {
      readonly supported: true;
      /** effective px (엔진 소비값) — 미지정은 0 */
      readonly values: SpacingBoxMetrics;
      /** raw canonical 에 있는 변 (없으면 catalog/기본값 유래) */
      readonly rawSides: ReadonlySet<SpacingSide>;
      /** padding 을 늘리면 박스가 그 축으로 커지는가 (hug) — 드래그 부호 입력 (`resolvePaddingGrowth`) */
      readonly growth: SpacingPaddingGrowth;
    }
  | { readonly supported: false; readonly reason: SpacingUnsupportedReason };

export interface SpacingPaddingGrowth {
  readonly x: boolean;
  readonly y: boolean;
}

export interface SpacingCapability {
  readonly projectId: string;
  readonly target: Extract<
    EditorPresentationTargetRef,
    { kind: "canonical-node" }
  >;
  readonly rootKey: string;
  readonly nodeType: string;
  /** border 두께 px (padding-box 계산용) */
  readonly border: SpacingBoxMetrics;
  readonly padding: SpacingPaddingCapability;
  readonly gap: SpacingAxisCapability;
  readonly rawStyle: Readonly<Record<string, unknown>>;
}

export interface SpacingCapabilityChildInput {
  readonly id: string;
  /** 엔진 style record (없으면 canonical style 로 대체) */
  readonly engineStyle: Readonly<Record<string, unknown>> | null;
  readonly rawStyle: Readonly<Record<string, unknown>>;
}

export interface SpacingCapabilityInputs {
  readonly projectId: string;
  readonly nodeId: string;
  readonly nodeType: string;
  readonly rootKey: string;
  readonly rawStyle: Readonly<Record<string, unknown>>;
  readonly engineStyle: Readonly<Record<string, unknown>> | null;
  /** 조상 엔진 style 목록 (부모 → 루트 순) — grid ancestry 판정 */
  readonly ancestorEngineStyles: readonly (Readonly<
    Record<string, unknown>
  > | null)[];
  readonly children: readonly SpacingCapabilityChildInput[];
  readonly activeBreakpoint: BreakpointName;
  /** canonical `responsive` (tier override) — 비-desktop 쓰기 목적지·provenance 판정 */
  readonly responsive?: ElementResponsiveConfig;
  readonly locked: boolean;
}

const SPACING_SHORTHAND_OF: Readonly<
  Record<SpacingProperty, "padding" | "gap">
> = {
  paddingTop: "padding",
  paddingRight: "padding",
  paddingBottom: "padding",
  paddingLeft: "padding",
  rowGap: "gap",
  columnGap: "gap",
};

interface RoutedSpacingRaw {
  /** 쓰기 목적지의 raw 값 (tier override 또는 base) — provenance 판정 대상 */
  readonly value: unknown;
  /** base 로 쓰는데 상위 tier override (longhand 또는 legacy shorthand) 가 cascade 로 덮는다 */
  readonly shadowed: boolean;
}

/**
 * 비-desktop 에서 이 property 의 쓰기 목적지 raw 값. desktop 은 base 그대로.
 * 목적지 판정은 commit 어댑터와 같은 `shouldWriteBreakpointOverride` 하나다.
 */
function readRoutedSpacingRaw(
  input: SpacingCapabilityInputs,
  property: SpacingProperty,
): RoutedSpacingRaw {
  const raw = normalizePresentationSpacingStyle(input.rawStyle);
  const breakpoint = input.activeBreakpoint;
  if (breakpoint === "desktop")
    return { value: raw[property], shadowed: false };
  const styles = input.responsive?.styles as
    Record<string, ResponsiveValue<unknown> | undefined> | undefined;
  if (shouldWriteBreakpointOverride(input.responsive, property, breakpoint)) {
    return { value: styles?.[property]?.[breakpoint], shadowed: false };
  }
  const cascaded =
    getResponsiveValueWithCascade(styles?.[property], breakpoint, undefined) ??
    getResponsiveValueWithCascade(
      styles?.[SPACING_SHORTHAND_OF[property]],
      breakpoint,
      undefined,
    );
  return { value: raw[property], shadowed: cascaded !== undefined };
}

/** 구조 컨테이너 타입 (소문자, body 제외). */
const PADDING_CONTAINER_TYPES: ReadonlySet<string> = new Set(
  [...containerTypeSet("structural", { lowercase: true })].filter(
    (type) => !isBodyType(type),
  ),
);

export function parseSpacingPx(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) && value >= 0 ? value : null;
  }
  if (typeof value !== "string") return null;
  const match = /^\s*(\d+(?:\.\d+)?)(?:px)?\s*$/.exec(value);
  if (!match) return null;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * raw canonical 값이 있고 px 로 표현되지 않으면 (%, rem, calc, var, 토큰) 원문을
 * 보존해야 하므로 캔버스 편집을 열지 않는다 (breakdown §1.1).
 */
function isRawUnitPreserved(value: unknown): boolean {
  if (value === undefined || value === null || value === "") return false;
  return parseSpacingPx(value) === null;
}

function readBox(
  style: Readonly<Record<string, unknown>>,
  prefix: "padding" | "border",
): SpacingBoxMetrics {
  const key = (side: string): string =>
    prefix === "padding" ? `padding${side}` : `border${side}`;
  return {
    top: parseSpacingPx(style[key("Top")]) ?? 0,
    right: parseSpacingPx(style[key("Right")]) ?? 0,
    bottom: parseSpacingPx(style[key("Bottom")]) ?? 0,
    left: parseSpacingPx(style[key("Left")]) ?? 0,
  };
}

function isGridDisplay(
  style: Readonly<Record<string, unknown>> | null,
): boolean {
  const display = style?.display;
  return display === "grid" || display === "inline-grid";
}

function isOutOfFlowChild(style: Readonly<Record<string, unknown>>): boolean {
  return (
    style.position === "absolute" ||
    style.position === "fixed" ||
    style.display === "none"
  );
}

function hasAutoMargin(
  style: Readonly<Record<string, unknown>>,
  axis: "horizontal" | "vertical",
): boolean {
  const keys =
    axis === "horizontal"
      ? ["marginLeft", "marginRight"]
      : ["marginTop", "marginBottom"];
  return keys.some((key) => style[key] === "auto") || style.margin === "auto";
}

const INTRINSIC_SIZE_KEYWORDS: ReadonlySet<string> = new Set([
  "auto",
  "fit-content",
  "max-content",
  "min-content",
]);

function isDefiniteSize(value: unknown): boolean {
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  return trimmed !== "" && !INTRINSIC_SIZE_KEYWORDS.has(trimmed);
}

/**
 * padding 을 늘리면 박스가 그 축으로 커지는가 (hug) — 엔진 style + 부모 엔진 style 로 판정한다.
 * 드래그 부호가 이 값을 읽는다: 움직이는 띠 가장자리가 포인터를 따라가야 한다 (2026-09-26 사용자
 * 신고 — 고정 폭 · hug 높이 Card 에서 bottom 만 맞고 나머지가 반대였다). 박스는 시작 (좌·상)
 * 쪽에 붙어 있다고 본다 — 부모 정렬이 center/end 로 박스를 미는 경우는 구분하지 않는다.
 */
export function resolvePaddingGrowth(
  style: Readonly<Record<string, unknown>>,
  parentStyle: Readonly<Record<string, unknown>> | null,
): SpacingPaddingGrowth {
  const grows = (axis: "x" | "y"): boolean => {
    const size = axis === "x" ? style.width : style.height;
    if (isDefiniteSize(size)) return false;
    const intrinsic = typeof size === "string" && size.trim() !== "auto";
    const parentDisplay = parentStyle?.display;
    if (parentDisplay === "flex" || parentDisplay === "inline-flex") {
      const mainIsY = String(parentStyle?.flexDirection ?? "row").startsWith(
        "column",
      );
      if ((axis === "y") === mainIsY) {
        if (Number(style.flexGrow ?? 0) > 0) return false;
        return !isDefiniteSize(style.flexBasis);
      }
      if (intrinsic) return true;
      const alignSelf = String(style.alignSelf ?? "auto");
      const align =
        alignSelf === "auto"
          ? String(parentStyle?.alignItems ?? "stretch")
          : alignSelf;
      return align !== "stretch" && align !== "normal";
    }
    if (axis === "y") return true;
    if (intrinsic) return true;
    const display = String(style.display ?? "");
    return display.startsWith("inline");
  };
  return { x: grows("x"), y: grows("y") };
}

function resolvePaddingCapability(
  input: SpacingCapabilityInputs,
  engineStyle: Readonly<Record<string, unknown>>,
): SpacingPaddingCapability {
  const type = input.nodeType.toLowerCase();
  const display = engineStyle.display;
  const isLayoutContainer =
    input.children.length > 0 &&
    (display === "flex" || display === "inline-flex" || display === "block");
  if (!PADDING_CONTAINER_TYPES.has(type) && !isLayoutContainer) {
    return { supported: false, reason: "not-container" };
  }
  const rawSides = new Set<SpacingSide>();
  for (const side of SPACING_SIDES) {
    const property = PADDING_PROPERTY_BY_SIDE[side];
    const routed = readRoutedSpacingRaw(input, property);
    if (routed.shadowed) {
      return { supported: false, reason: "cascade-shadowed" };
    }
    if (isRawUnitPreserved(routed.value)) {
      return { supported: false, reason: "raw-unit-preserved" };
    }
    if (
      routed.value !== undefined &&
      routed.value !== null &&
      routed.value !== ""
    ) {
      rawSides.add(side);
    }
  }
  return {
    supported: true,
    values: readBox(engineStyle, "padding"),
    rawSides,
    growth: resolvePaddingGrowth(
      engineStyle,
      input.ancestorEngineStyles[0] ?? null,
    ),
  };
}

function resolveGapCapability(
  input: SpacingCapabilityInputs,
  engineStyle: Readonly<Record<string, unknown>>,
): SpacingAxisCapability {
  const display = engineStyle.display;
  if (display !== "flex" && display !== "inline-flex") {
    return { supported: false, reason: "not-flex" };
  }
  const wrap = engineStyle.flexWrap;
  if (wrap !== undefined && wrap !== "nowrap") {
    return { supported: false, reason: "wrap" };
  }
  const justify = String(engineStyle.justifyContent ?? "");
  if (justify.startsWith("space-")) {
    return { supported: false, reason: "distributed-alignment" };
  }
  const direction = String(engineStyle.flexDirection ?? "row");
  const axis: "horizontal" | "vertical" = direction.startsWith("column")
    ? "vertical"
    : "horizontal";
  const property: SpacingGapProperty =
    axis === "horizontal" ? "columnGap" : "rowGap";
  const routed = readRoutedSpacingRaw(input, property);
  if (routed.shadowed) {
    return { supported: false, reason: "cascade-shadowed" };
  }
  if (isRawUnitPreserved(routed.value)) {
    return { supported: false, reason: "raw-unit-preserved" };
  }
  const flowChildIds: string[] = [];
  for (const child of input.children) {
    const style = child.engineStyle ?? child.rawStyle;
    if (isOutOfFlowChild(style)) continue;
    if (hasAutoMargin(style, axis)) {
      return { supported: false, reason: "auto-margin-child" };
    }
    flowChildIds.push(child.id);
  }
  if (flowChildIds.length < 2) {
    return { supported: false, reason: "fewer-than-two-children" };
  }
  return {
    supported: true,
    property,
    axis,
    reverse: direction.endsWith("-reverse"),
    value: parseSpacingPx(engineStyle[property]) ?? 0,
    flowChildIds,
  };
}

/** store 를 모르는 순수 판정. 공통 차단 사유는 padding·gap 양쪽에 같은 reason 으로 실린다. */
export function resolveSpacingCapabilityFromInputs(
  input: SpacingCapabilityInputs,
): SpacingCapability {
  const unsupported = (
    reason: SpacingUnsupportedReason,
  ): SpacingCapability => ({
    projectId: input.projectId,
    target: { kind: "canonical-node", nodeId: input.nodeId },
    rootKey: input.rootKey,
    nodeType: input.nodeType,
    border: input.engineStyle
      ? readBox(input.engineStyle, "border")
      : {
          top: 0,
          right: 0,
          bottom: 0,
          left: 0,
        },
    padding: { supported: false, reason },
    gap: { supported: false, reason },
    rawStyle: input.rawStyle,
  });

  if (isBodyType(input.nodeType)) return unsupported("body");
  if (input.locked) return unsupported("locked");
  const engineStyle = input.engineStyle;
  if (!engineStyle) return unsupported("engine-style-missing");
  const position = engineStyle.position;
  if (position === "fixed" || position === "sticky") {
    return unsupported("position-unsupported");
  }
  if (isGridDisplay(engineStyle)) return unsupported("grid");
  if (input.ancestorEngineStyles.some(isGridDisplay)) {
    return unsupported("grid-ancestor");
  }
  if (
    input.rawStyle.transform !== undefined &&
    input.rawStyle.transform !== "none"
  ) {
    return unsupported("transform");
  }

  return {
    projectId: input.projectId,
    target: { kind: "canonical-node", nodeId: input.nodeId },
    rootKey: input.rootKey,
    nodeType: input.nodeType,
    border: readBox(engineStyle, "border"),
    padding: resolvePaddingCapability(input, engineStyle),
    gap: resolveGapCapability(input, engineStyle),
    rawStyle: input.rawStyle,
  };
}

interface SpacingOwnerNodeLike {
  readonly id: string;
  readonly type: string;
  /** instance 의 origin id (canonical `ref`) */
  readonly ref?: string;
}

export interface SpacingOwnerStructureInputs {
  readonly node: SpacingOwnerNodeLike;
  readonly lookupNode: (id: string) => SpacingOwnerNodeLike | null;
  /** store `childrenMap` 의 자식 — plain 노드의 자식 정본 */
  readonly storeChildIds: readonly string[];
  /** 엔진이 이 노드 아래 배치한 자식 (filtered children map) — instance 의 synthetic 자식 */
  readonly layoutChildIds: readonly string[] | null;
}

/**
 * 판정 입력의 타입 · 자식. instance (`ref`) 는 origin 타입 (ref 사슬 끝, 순환은 `ref` 로
 * 끝나 not-container) 과 엔진 배치 자식을 쓴다 — store 에는 자식이 없다.
 */
export function resolveSpacingOwnerStructure(
  input: SpacingOwnerStructureInputs,
): { readonly nodeType: string; readonly childIds: readonly string[] } {
  if (input.node.type !== "ref") {
    return { nodeType: input.node.type, childIds: input.storeChildIds };
  }
  let current: SpacingOwnerNodeLike = input.node;
  const visited = new Set<string>([current.id]);
  while (current.type === "ref") {
    const masterId = getCanonicalRefTarget(current);
    if (!masterId || visited.has(masterId)) break;
    const master = input.lookupNode(masterId);
    if (!master) break;
    visited.add(masterId);
    current = master;
  }
  return { nodeType: current.type, childIds: input.layoutChildIds ?? [] };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/**
 * store 바인딩 — 현재 선택 하나에 대한 capability. 지원 불가 사유가 선택 구조에
 * 있으면 (다중 선택 · ref-descendant · 프로젝트 없음) null 을 돌려 UI 를 통째로 닫는다.
 */
export function resolveSpacingCapability(
  selectedElementIds: readonly string[],
): SpacingCapability | null {
  if (selectedElementIds.length !== 1) return null;
  const selectedElementId = selectedElementIds[0];
  const canonical = useCanonicalDocumentStore.getState();
  const projectId = canonical.currentProjectId;
  if (!projectId || !canonical.documents.has(projectId)) return null;
  const target = resolveEditorPresentationTarget(projectId, selectedElementId);
  if (
    !target ||
    target.kind !== "canonical-node" ||
    !editorPresentationCanonicalRuntimeOptions.hasTarget(projectId, target)
  ) {
    return null;
  }
  const node = getEditorPresentationTargetNode(projectId, target);
  if (!node) return null;

  const state = useStore.getState();
  const element = state.elementsMap.get(target.nodeId);
  if (!element) return null;
  // read-only sub-part (SelectTrigger 래퍼 등) 의 padding · gap 은 owner rule 이 정한다 — 띠를 내지 않는다.
  if (
    !canOperate("editStyle", target.nodeId, (id) => state.elementsMap.get(id))
      .ok
  ) {
    return null;
  }
  const rootKey = element.page_id ?? null;
  if (!rootKey) return null;

  const rawStyle = isRecord(node.props?.style) ? node.props.style : {};
  const ancestorEngineStyles: (Readonly<Record<string, unknown>> | null)[] = [];
  let cursor = element.parent_id ?? null;
  while (cursor) {
    ancestorEngineStyles.push(readPersistentEngineStyle(rootKey, cursor));
    cursor = state.elementsMap.get(cursor)?.parent_id ?? null;
  }
  const storeChildren = state.childrenMap.get(target.nodeId) ?? [];
  const structure = resolveSpacingOwnerStructure({
    node,
    lookupNode: (id) =>
      getEditorPresentationTargetNode(projectId, {
        kind: "canonical-node",
        nodeId: id,
      }),
    storeChildIds: storeChildren.map((child) => child.id),
    layoutChildIds:
      node.type === "ref"
        ? (getSharedFilteredChildrenMap()?.get(target.nodeId) ?? null)
        : null,
  });
  const children = structure.childIds.map((id) => {
    const storeChild = storeChildren.find((child) => child.id === id);
    return {
      id,
      engineStyle: readPersistentEngineStyle(rootKey, id),
      rawStyle: isRecord(storeChild?.props?.style) ? storeChild.props.style : {},
    };
  });
  const props = isRecord(element.props) ? element.props : {};

  return resolveSpacingCapabilityFromInputs({
    projectId,
    nodeId: target.nodeId,
    nodeType: structure.nodeType,
    rootKey,
    rawStyle,
    engineStyle: readPersistentEngineStyle(rootKey, target.nodeId),
    ancestorEngineStyles,
    children,
    activeBreakpoint: state.activeBreakpoint,
    responsive: node.responsive,
    locked: Boolean(props.isLocked ?? props.locked),
  });
}
