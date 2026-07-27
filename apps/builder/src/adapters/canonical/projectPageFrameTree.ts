/**
 * Page ↔ Frame 합성 — **canonical resolved 트리** 축 (DOM 소비자용).
 *
 * `resolveCanonicalDocument` 는 ref 를 열 때 master 자식과 instance 자식을 **이어 붙인다**
 * (`[...originChildren, ...instanceChildren]`). 일반 컴포넌트 ref 에는 그게 맞지만, 페이지가
 * 프레임을 참조하는 형태에서는 틀린다 — 프레임의 body(슬롯 보유)와 페이지의 body(콘텐츠
 * 보유)가 **형제로 나란히** 놓여, 프레임의 빈 슬롯이 뷰포트를 채우고 페이지 콘텐츠는 그
 * 아래로 밀려난다. 사용자 눈에는 "프레임 적용 후 preview 가 안 나온다" 로 보인다.
 *
 * 실측(2026-07-27, `page-home` + 2-Row 프레임):
 *
 * | 소비자        | 결과                                                            |
 * | ------------- | --------------------------------------------------------------- |
 * | Skia (canvas) | page body 390×844 > 슬롯 60 / 784 > ListBox  (정상)             |
 * | Preview (DOM) | page-home 390×**1688** > [프레임 body 844(빈 슬롯), page body 844] |
 *
 * ADR-903 의 `slot` 계약은 **추천 목록 검증**일 뿐 배치 기제가 아니라(비차단 warn),
 * resolver 안에서 해결될 문제가 아니다. 그래서 Skia 축의 `resolvePageWithFrame` 과 같은
 * 위상의 합성 층을 트리 표현으로 둔다 — 두 축의 **정책은** `pageFrameProjection.ts` 한 곳에서
 * 공유한다(규칙이 두 벌이 되면 그 순간 시각 발산이 시작된다).
 */

import type {
  CanonicalNode,
  CompositionDocument,
  RefNode,
  ResolvedNode,
} from "@composition/shared";
import { toPageFrameElementId } from "@composition/shared";

import {
  mergePageBodyResponsive,
  mergePageBodyStyle,
  resolvePageSlotStyle,
  type ResponsiveBag,
  type StyleMap,
} from "./pageFrameProjection";
import { getPageOwnedChildrenFromFrameRef } from "./pageFrameRefChildren";
import { getSlotMirrorName } from "./slotMirror";

const DEFAULT_SLOT_NAME = "content";

type PropsBag = Record<string, unknown> | undefined;

function readProps(node: CanonicalNode): Record<string, unknown> {
  return (node.props ?? {}) as Record<string, unknown>;
}

function isBodyNode(node: CanonicalNode): boolean {
  return node.type.toLowerCase() === "body";
}

/**
 * 슬롯 노드 판정 — canonical 은 hoisted slot 을 `type:"frame"` +
 * `metadata.type:"legacy-slot-hoisted"` 로 표현한다 (flat 축의 `type:"Slot"` 과 다름).
 */
function isSlotNode(node: CanonicalNode): boolean {
  if (node.type === "Slot") return true;
  const metaType = (node.metadata as { type?: unknown } | undefined)?.type;
  return metaType === "legacy-slot-hoisted";
}

function readSlotDeclaredName(node: CanonicalNode): string {
  const props = readProps(node);
  if (typeof props.name === "string" && props.name.length > 0) {
    return props.name;
  }
  const metaName = (node.metadata as { slotName?: unknown } | undefined)
    ?.slotName;
  if (typeof metaName === "string" && metaName.length > 0) return metaName;
  return getSlotMirrorName(node) ?? DEFAULT_SLOT_NAME;
}

/** 페이지 콘텐츠가 어느 슬롯으로 갈지 — 미선언은 `content` (flat 축 `readSlotName` 동형). */
function readContentTargetSlot(node: CanonicalNode): string {
  return (
    getSlotMirrorName(node.props) ??
    getSlotMirrorName(node) ??
    DEFAULT_SLOT_NAME
  );
}

function readPageId(node: ResolvedNode): string {
  const pageId = (node.metadata as { pageId?: unknown } | undefined)?.pageId;
  return typeof pageId === "string" && pageId.length > 0 ? pageId : node.id;
}

/**
 * 프레임을 참조하는 페이지 노드 하나를 투영한다. 그 형태가 아니면 **원본 그대로** 반환.
 *
 * 결과 구조 (Skia 축과 동형):
 *   page > page body(프레임 레이아웃 병합) > 투영 슬롯들 > 페이지 콘텐츠
 */
export function projectPageFrameNode(
  node: ResolvedNode,
  doc: CompositionDocument,
): ResolvedNode {
  const canonical = doc.children.find((child) => child.id === node.id);
  if (!canonical || canonical.type !== "ref") return node;

  const resolvedChildren = node.children ?? [];
  if (resolvedChildren.length === 0) return node;

  // instance(page) 소유 자식 id — descendants override 로 들어온 것까지 포함한다.
  const pageOwnedIds = new Set(
    getPageOwnedChildrenFromFrameRef(canonical as RefNode).map(
      (child) => child.id,
    ),
  );

  const frameChildren: ResolvedNode[] = [];
  const pageChildren: ResolvedNode[] = [];
  for (const child of resolvedChildren) {
    (pageOwnedIds.has(child.id) ? pageChildren : frameChildren).push(child);
  }

  const frameBody = frameChildren.find(isBodyNode);
  const pageBody = pageChildren.find(isBodyNode);
  // 프레임 body 와 page body 가 **둘 다** 있어야 이 합성이 성립한다. 하나라도 없으면
  // 프레임 미바인딩(또는 다른 ref 형태)이므로 손대지 않는다.
  if (!frameBody || !pageBody) return node;

  const pageId = readPageId(node);
  const frameBodyStyle = readProps(frameBody).style as StyleMap | undefined;

  // 페이지 콘텐츠를 슬롯 이름별로 나눈다. 매칭 안 된 것은 page body 직계로 남긴다
  // (flat 축의 orphan 방지와 동일 — 조용히 사라지면 안 된다).
  const slotNames = new Set(
    (frameBody.children ?? []).filter(isSlotNode).map(readSlotDeclaredName),
  );
  const contentBySlot = new Map<string, ResolvedNode[]>();
  const unslotted: ResolvedNode[] = [];
  for (const child of pageBody.children ?? []) {
    const target = readContentTargetSlot(child);
    if (!slotNames.has(target)) {
      unslotted.push(child);
      continue;
    }
    const bucket = contentBySlot.get(target);
    if (bucket) bucket.push(child);
    else contentBySlot.set(target, [child]);
  }

  const projectedFrameChildren = (frameBody.children ?? []).map((child) => {
    const projectedId = toPageFrameElementId(pageId, child.id);
    if (!isSlotNode(child)) return { ...child, id: projectedId };

    const slotName = readSlotDeclaredName(child);
    const filled = contentBySlot.get(slotName);
    return {
      ...child,
      id: projectedId,
      props: {
        ...readProps(child),
        style: resolvePageSlotStyle({
          slotStyle: readProps(child).style as StyleMap | undefined,
          slotName,
          frameBodyStyle,
        }),
      },
      // 채워진 슬롯은 프레임의 기본 자식을 감춘다. 미채움 슬롯은 기본 자식을 그대로 노출
      // (flat 축 G3-θ c 와 동일 정책).
      children: filled ?? child.children,
    } satisfies ResolvedNode;
  });

  const pageBodyProps = readProps(pageBody);
  const mergedResponsive = mergePageBodyResponsive(
    pageBody.responsive as ResponsiveBag | null | undefined,
    frameBody.responsive as ResponsiveBag | null | undefined,
  );

  const mergedBody: ResolvedNode = {
    ...pageBody,
    props: {
      ...pageBodyProps,
      style: mergePageBodyStyle(
        pageBodyProps.style as StyleMap | undefined,
        frameBodyStyle,
      ),
    } as PropsBag as ResolvedNode["props"],
    ...(mergedResponsive
      ? { responsive: mergedResponsive as ResolvedNode["responsive"] }
      : {}),
    children: [...projectedFrameChildren, ...unslotted],
  };

  // page body 외의 page 소유 자식(있으면)은 그대로 뒤에 남긴다.
  const otherPageChildren = pageChildren.filter((child) => child !== pageBody);
  return { ...node, children: [mergedBody, ...otherPageChildren] };
}

/** {@link projectPageFrameNode} 를 페이지 노드 배열에 적용한다. */
export function projectPageFrameNodes(
  nodes: ResolvedNode[],
  doc: CompositionDocument,
): ResolvedNode[] {
  return nodes.map((node) => projectPageFrameNode(node, doc));
}
