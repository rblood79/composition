/**
 * ADR-150 A1 — Skia hover/pressed 상태 fill overlay 재렌더.
 *
 * hovered/pressed leaf 노드를 상태 fill(catalog `FillStateTokens.hover/pressed`)로 재빌드해
 * overlay pass 에서 default shape 위에 덮어 그린다. command stream(default shape)은 무변경 —
 * 상태 시각은 overlay 전용이라 scene rebuild 0 (ADR-136 §9: sceneVersion signature 에 상태
 * 미포함). 무효화는 기존 `overlayVersion` 채널 재사용(useElementHoverInteraction 이 hover 변경
 * 시 overlayVersionRef 를 ++ 한다) — 신규 캐시 키/무효화 채널 신설 불필요.
 *
 * 성능(ADR-150 R1): renderFrameCore 는 매 RAF 도므로, (registryVersion, theme, state,
 *   hoveredLeafIds) 시그니처로 캐싱해 hover 대상·scene·theme 이 그대로면 재빌드를 건너뛴다.
 */

import type { StoreRenderBridge } from "./StoreRenderBridge";
import type { SkiaNodeData } from "./nodeRendererTypes";
import type { CanvasSceneNode } from "../scene/canvasSceneNode";
import type { ComputedLayout } from "../layout/engines/LayoutEngine";
import type { BoundingBox } from "../selection/types";
import type { ElementHoverState } from "../hooks/useElementHoverInteraction";
import type { RacStateInput } from "@composition/specs";

export interface HoverStateNodeCache {
  key: string;
  nodes: SkiaNodeData[];
}

export interface ComputeHoverStateNodesParams {
  bridge: StoreRenderBridge | null;
  hoverState: ElementHoverState;
  treeBoundsMap: Map<string, BoundingBox>;
  elementsMap: Map<string, CanvasSceneNode>;
  layoutMap: Map<string, ComputedLayout> | null;
  theme: "light" | "dark";
  childrenMap: Map<string, CanvasSceneNode[]> | null;
  registryVersion: number;
  /** RAC 상호작용 상태 — 현재 { isHovered: true }. pressed(S3)는 { isPressed: true }. */
  racStateInput: RacStateInput;
  cacheRef: { current: HoverStateNodeCache | null };
}

function stateKeyOf(input: RacStateInput): string {
  // racStateAttrs 우선순위(disabled > pressed > hover > focusVisible) 와 동일.
  if (input.isPressed) return "pressed";
  if (input.isHovered) return "hover";
  if (input.isFocusVisible) return "focusVisible";
  return "default";
}

/**
 * hovered leaf 노드들을 상태 fill 로 재빌드해 overlay draw 대상 SkiaNodeData[] 를 만든다.
 * 좌표: buildInteractionStateNode 결과 x/y 는 layout 상대 → treeBoundsMap 절대좌표로
 *   오버라이드(renderNode 는 씬-로컬 절대좌표계에서 node.x/y 로 translate). 자식은 부모
 *   상대좌표를 유지하고 renderNodeInternal 이 재귀 translate 한다.
 */
export function computeHoverStateNodes(
  params: ComputeHoverStateNodesParams,
): SkiaNodeData[] {
  const {
    bridge,
    hoverState,
    treeBoundsMap,
    elementsMap,
    layoutMap,
    theme,
    childrenMap,
    registryVersion,
    racStateInput,
    cacheRef,
  } = params;

  // hover fill 대상 = hoveredElementId(interactive 요소 자체 — 배경 fill 소유) + hoveredLeafIds
  //   (내부 leaf — 텍스트/아이콘). RAC data-hovered 는 hover 된 요소에 붙으므로 배경 fill 은
  //   hoveredElementId 가 소유하고, leaf(Label/Icon)는 fill 이 없다. element 를 먼저 그려
  //   배경을 깔고 leaf(텍스트)를 그 위에 얹는다(z-order). 컨테이너 hover(fill 없음)면 재빌드
  //   결과가 default 와 동일해 무해하다.
  const targetIds: string[] = [];
  if (hoverState.hoveredElementId) targetIds.push(hoverState.hoveredElementId);
  for (const lid of hoverState.hoveredLeafIds) {
    if (lid !== hoverState.hoveredElementId) targetIds.push(lid);
  }
  if (!bridge || targetIds.length === 0) {
    cacheRef.current = null;
    return [];
  }

  const key = `${registryVersion}:${theme}:${stateKeyOf(racStateInput)}:${targetIds.join("|")}`;
  if (cacheRef.current?.key === key) return cacheRef.current.nodes;

  const nodes: SkiaNodeData[] = [];
  for (const id of targetIds) {
    // 위치 불명(레이아웃 미배치/컬링 대상)은 그리지 않는다 — 절대좌표 없이는 배치 불가.
    const bounds = treeBoundsMap.get(id);
    if (!bounds) continue;
    const node = bridge.buildInteractionStateNode(
      id,
      racStateInput,
      elementsMap,
      layoutMap,
      theme,
      childrenMap,
    );
    if (!node) continue;
    node.x = bounds.x;
    node.y = bounds.y;
    nodes.push(node);
  }

  cacheRef.current = { key, nodes };
  return nodes;
}
