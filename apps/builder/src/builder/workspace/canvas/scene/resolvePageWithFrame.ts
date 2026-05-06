/**
 * ADR-111 P3-θ — Page + Frame Slot Fill Resolution (D7=B / D8=A / D9=A 채택)
 *
 * page frame binding 이 set 된 경우, 해당 frame 의 element 들을 page rendering
 * pipeline 에 합성한다.
 *
 * 정책:
 *  - D7=B (별도 resolver) — pageIndex 의 page_id 의미 보존, page rendering 진입점
 *    `buildPageDataMap` 에서 명시 호출
 *  - D8=A (legacy slot ownership 매칭) — page root element 의 slot mirror
 *    value 가 frame Slot 의 name 과 일치 시
 *    page element 의 parent_id 를 해당 Slot 의 id 로 재매핑하여 fill
 *  - D9=A (무조건 적용) — feature flag 없이 모든 layout-bound page 에 적용
 *
 * Override 분리 (G3-θ c):
 *  - page slot fill 이 매칭된 Slot 의 default 자식 (frame element 중
 *    parent_id===slot.id) 은 결과에서 제외 (hide)
 *  - 매칭 안 된 Slot (예: page slot:content fill 만 있고 slot:header 미 fill 시)
 *    의 default 자식은 그대로 노출
 */

import type { Element, Page } from "../../../../types/core/store.types";
import { toPageFrameElementId } from "@composition/shared";
import { isLegacyFrameElementForFrame } from "../../../../adapters/canonical/frameElementLoader";
import {
  getFrameElementMirrorId,
  getNullablePageFrameBindingId,
} from "../../../../adapters/canonical/frameMirror";
import { getSlotMirrorName } from "../../../../adapters/canonical/slotMirror";

export interface ResolvePageWithFrameInput {
  /** 현재 page (frame binding 이 set 되어 있으면 frame 합성) */
  page: Page;
  /** page_id===page.id 인 element 들 (이미 order_num 정렬) */
  pageElements: Element[];
  /** 전체 elementsMap (frame elements 검색용) */
  elementsMap: Map<string, Element>;
}

export interface ResolvePageWithFrameOutput {
  /** root body element — frame binding 시 frame body, 미바인딩 시 page body */
  bodyElement: Element | null;
  /** body 제외 element 들 (frame slot subtree + page slot fill 합성) */
  pageElements: Element[];
  /** page frame binding 이 set + frame body 발견 시 true */
  hasFrameBinding: boolean;
}

export { toPageFrameElementId };

function isProjectedPageFrameElementId(pageId: string, elementId: string) {
  return elementId.startsWith(toPageFrameElementId(pageId, ""));
}

function isBodyType(type: string): boolean {
  return type.toLowerCase() === "body";
}

function isHydratedPageFrameElement(
  el: Element,
  pageId: string,
  layoutId: string,
): boolean {
  return (
    !el.deleted &&
    el.page_id === pageId &&
    getFrameElementMirrorId(el) === layoutId
  );
}

function readSlotName(el: Element): string {
  return getSlotMirrorName(el.props) ?? getSlotMirrorName(el) ?? "content";
}

function readSlotElementName(slot: Element): string {
  const fromProps = (slot.props as { name?: string } | undefined)?.name;
  return fromProps ?? getSlotMirrorName(slot) ?? "content";
}

function asPageResolvedSlot(slot: Element, parentId: string): Element {
  return {
    ...slot,
    parent_id: parentId,
    props: {
      ...slot.props,
      _slotChrome: "hidden",
      _slotMarkerChrome: "visible",
    },
  };
}

const PAGE_BODY_STYLE_PRESERVE_KEYS = [
  "width",
  "height",
  "minWidth",
  "minHeight",
  "maxWidth",
  "maxHeight",
  "background",
  "backgroundColor",
  "backgroundImage",
] as const;

function mergePageBodyWithFrameLayout(
  pageBody: Element,
  frameBody: Element,
): Element {
  const pageProps = (pageBody.props ?? {}) as Record<string, unknown>;
  const frameProps = (frameBody.props ?? {}) as Record<string, unknown>;
  const pageStyle = (pageProps.style ?? {}) as Record<string, unknown>;
  const frameStyle = (frameProps.style ?? {}) as Record<string, unknown>;

  const mergedStyle: Record<string, unknown> = {
    ...pageStyle,
    ...frameStyle,
  };

  // Page binding must keep the Page as the viewport authority. Frame body
  // contributes layout grammar, but page dimensions/background stay page-owned.
  for (const key of PAGE_BODY_STYLE_PRESERVE_KEYS) {
    if (pageStyle[key] !== undefined) {
      mergedStyle[key] = pageStyle[key];
    }
  }

  return {
    ...pageBody,
    props: {
      ...pageProps,
      style: mergedStyle,
    },
  };
}

function getPageResolvedSlotStyle(
  slot: Element,
  frameBody: Element,
): Record<string, unknown> {
  const slotProps = (slot.props ?? {}) as Record<string, unknown>;
  const slotStyle = (slotProps.style ?? {}) as Record<string, unknown>;
  const frameStyle =
    ((frameBody.props ?? {}) as { style?: Record<string, unknown> }).style ??
    {};
  const display = String(frameStyle.display ?? "").toLowerCase();
  const flexDirection = String(frameStyle.flexDirection ?? "row").toLowerCase();
  const slotName = readSlotElementName(slot);
  const nextStyle: Record<string, unknown> = { ...slotStyle };

  if (display === "flex" || display === "inline-flex") {
    if (flexDirection === "column" || flexDirection === "column-reverse") {
      nextStyle.width ??= "100%";
      if (
        slotName === "content" &&
        nextStyle.height == null &&
        nextStyle.flex == null
      ) {
        nextStyle.flex = "1 1 auto";
        nextStyle.minHeight ??= 0;
      } else {
        nextStyle.flexShrink ??= 0;
      }
    } else {
      nextStyle.height ??= "100%";
      if (
        slotName === "content" &&
        nextStyle.width == null &&
        nextStyle.flex == null
      ) {
        nextStyle.flex = "1 1 auto";
        nextStyle.minWidth ??= 0;
      } else {
        nextStyle.flexShrink ??= 0;
      }
    }
  }

  if (display === "grid" || display === "inline-grid") {
    nextStyle.gridArea ??= slotName;
    nextStyle.width ??= "100%";
    nextStyle.height ??= "100%";
  }

  return nextStyle;
}

function asPageResolvedRootSlot(
  slot: Element,
  parentId: string,
  frameBody: Element,
): Element {
  const resolved = asPageResolvedSlot(slot, parentId);
  const style = getPageResolvedSlotStyle(slot, frameBody);
  return {
    ...resolved,
    props: {
      ...resolved.props,
      style,
    },
  };
}

/**
 * page + (optional) frame element 합성 → ScenePageData 호환 출력.
 *
 * page frame 미바인딩: 기존 동작 — page body + page nonBody.
 * page frame 바인딩 + frame body 발견: page body 유지 (root) + frame body
 *   의 자식 (Slot 등) 을 page body 자식으로 reparent + frame Slot 의 default
 *   자식 (Text 등) 그대로 + page root element slot mirror 매칭 → 해당 Slot 자식
 *   으로 재매핑 + page non-root 그대로.
 *
 * 정책 정합 (design breakdown §4.10): "frame body subtree 를 page body 자식으로
 * 가상 merge" — frame body 자체가 아닌 frame body **의 자식들** 을 reparent.
 * page width/height/배경 등 시각 속성 보존 + slot mirror 미매칭 element orphan 방지.
 */
export function resolvePageWithFrame(
  input: ResolvePageWithFrameInput,
): ResolvePageWithFrameOutput {
  const { page, pageElements, elementsMap } = input;
  const layoutId = getNullablePageFrameBindingId(page);

  const splitPageBody = (): {
    body: Element | null;
    nonBody: Element[];
  } => {
    let body: Element | null = null;
    let boundFrameBody: Element | null = null;
    const nonBody: Element[] = [];
    for (const el of pageElements) {
      const frameElementId = getFrameElementMirrorId(el);
      if (frameElementId !== null) {
        if (layoutId && frameElementId === layoutId && isBodyType(el.type)) {
          boundFrameBody ??= el;
        }
        continue;
      }
      if (isBodyType(el.type)) {
        if (!body) body = el;
        continue;
      }
      nonBody.push(el);
    }
    return { body: body ?? boundFrameBody, nonBody };
  };

  if (!layoutId) {
    const { body, nonBody } = splitPageBody();
    return { bodyElement: body, pageElements: nonBody, hasFrameBinding: false };
  }

  const frameElements: Element[] = [];
  for (const el of elementsMap.values()) {
    if (
      !isLegacyFrameElementForFrame(el, layoutId) &&
      !isHydratedPageFrameElement(el, page.id, layoutId)
    ) {
      continue;
    }
    frameElements.push(el);
  }

  let frameBody: Element | null = null;
  for (const el of frameElements) {
    if (isBodyType(el.type)) {
      frameBody = el;
      break;
    }
  }

  const { body: pageBody, nonBody: pageNonBody } = splitPageBody();

  if (!frameBody || !pageBody) {
    return {
      bodyElement: pageBody,
      pageElements: pageNonBody,
      hasFrameBinding: false,
    };
  }

  const slotByName = new Map<string, Element>();
  for (const el of frameElements) {
    if (el.type !== "Slot") continue;
    const slotName = readSlotElementName(el);
    if (!slotByName.has(slotName)) slotByName.set(slotName, el);
  }

  const pageBodyId = pageBody.id;
  const frameBodyId = frameBody.id;
  const frameElementIds = new Set(frameElements.map((el) => el.id));
  const resolvedPageBody = mergePageBodyWithFrameLayout(pageBody, frameBody);
  const pageContentElements = pageNonBody.filter(
    (el) => !frameElementIds.has(el.id),
  );

  const projectFrameElementId = (id: string): string =>
    isProjectedPageFrameElementId(page.id, id)
      ? id
      : toPageFrameElementId(page.id, id);

  const projectFrameParentId = (parentId: string | null | undefined) => {
    if (!parentId || parentId === frameBodyId) return pageBodyId;
    return frameElementIds.has(parentId)
      ? projectFrameElementId(parentId)
      : parentId;
  };

  const projectFrameElement = (el: Element): Element => ({
    ...el,
    id: projectFrameElementId(el.id),
    parent_id: projectFrameParentId(el.parent_id),
    page_id: page.id,
  });

  const pageRootBySlot = new Map<string, Element[]>();
  const pageNonRoot: Element[] = [];
  for (const el of pageContentElements) {
    const isRoot = !el.parent_id || el.parent_id === pageBodyId;
    if (!isRoot) {
      pageNonRoot.push(el);
      continue;
    }
    const slotName = readSlotName(el);
    const list = pageRootBySlot.get(slotName);
    if (list) list.push(el);
    else pageRootBySlot.set(slotName, [el]);
  }

  const hiddenChildIds = new Set<string>();
  for (const [slotName, slot] of slotByName) {
    if (!pageRootBySlot.has(slotName)) continue;
    for (const el of frameElements) {
      if (el.parent_id === slot.id) hiddenChildIds.add(el.id);
    }
  }

  const result: Element[] = [];
  const projectedSlotByName = new Map<string, Element>();

  for (const el of frameElements) {
    if (el.id === frameBodyId) continue;
    if (hiddenChildIds.has(el.id)) continue;
    const projected = projectFrameElement(el);
    if (el.parent_id === frameBodyId) {
      const resolved =
        projected.type === "Slot"
          ? asPageResolvedRootSlot(projected, pageBodyId, frameBody)
          : projected;
      result.push(resolved);
      if (resolved.type === "Slot") {
        projectedSlotByName.set(readSlotElementName(el), resolved);
      }
    } else {
      result.push(projected);
      if (projected.type === "Slot") {
        projectedSlotByName.set(readSlotElementName(el), projected);
      }
    }
  }

  const fallbackSlot =
    projectedSlotByName.get("content") ??
    projectedSlotByName.values().next().value ??
    null;

  for (const [slotName, elements] of pageRootBySlot) {
    const targetSlot = projectedSlotByName.get(slotName) ?? fallbackSlot;
    if (!targetSlot) {
      result.push(...elements);
      continue;
    }
    for (const el of elements) {
      result.push({ ...el, parent_id: targetSlot.id });
    }
  }

  result.push(...pageNonRoot);

  result.sort((a, b) => (a.order_num ?? 0) - (b.order_num ?? 0));

  return {
    bodyElement: resolvedPageBody,
    pageElements: result,
    hasFrameBinding: true,
  };
}
