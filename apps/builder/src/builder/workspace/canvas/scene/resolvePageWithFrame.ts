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

import type { Page } from "../../../../types/core/store.types";
import type { CanvasSceneNode } from "./canvasSceneNode";
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
  /** page_id===page.id 인 element 들 (canonical/source order) */
  pageElements: CanvasSceneNode[];
  /** 전체 elementsMap (frame elements 검색용) */
  elementsMap: Map<string, CanvasSceneNode>;
}

export interface ResolvePageWithFrameOutput {
  /** root body element — frame binding 시 frame body, 미바인딩 시 page body */
  bodyElement: CanvasSceneNode | null;
  /** body 제외 element 들 (frame slot subtree + page slot fill 합성) */
  pageElements: CanvasSceneNode[];
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
  el: CanvasSceneNode,
  pageId: string,
  layoutId: string,
): boolean {
  return (
    !el.deleted &&
    el.page_id === pageId &&
    getFrameElementMirrorId(el) === layoutId
  );
}

function readSlotName(el: CanvasSceneNode): string {
  return getSlotMirrorName(el.props) ?? getSlotMirrorName(el) ?? "content";
}

function readSlotElementName(slot: CanvasSceneNode): string {
  const fromProps = (slot.props as { name?: string } | undefined)?.name;
  return fromProps ?? getSlotMirrorName(slot) ?? "content";
}

function getCanonicalSourceId(el: CanvasSceneNode): string {
  const sourceId = el.sourceNode?.id;
  return typeof sourceId === "string" && sourceId.length > 0 ? sourceId : el.id;
}

function getSlotDescendantPath(
  frameBody: CanvasSceneNode,
  slot: CanvasSceneNode,
): string {
  return `${getCanonicalSourceId(frameBody)}/${getCanonicalSourceId(slot)}`;
}

function asPageResolvedSlot(
  slot: CanvasSceneNode,
  parentId: string,
): CanvasSceneNode {
  return {
    ...slot,
    parentId,
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

type ResponsiveStyleMap = Record<string, unknown>;

/**
 * frame body 의 breakpoint override 를 page body 로 옮긴다 (2026-07-27).
 *
 * base style 은 `mergePageBodyWithFrameLayout` 이 이미 합치는데 `responsive` 는 최상위
 * canonical 필드라 `{...pageBody}` 스프레드가 **page body 것만** 실어 왔다. page body 는
 * 자기 override 가 없는 게 보통이라(실측: 3개 페이지 전부 `responsive: null`) 프리셋이 심은
 * 컨테이너 override 가 통째로 사라졌다 — 프레임을 페이지에 적용하면 breakpoint 를 바꿔도
 * 트랙과 `display` 가 desktop 값 그대로였다.
 *
 * 실측(2026-07-27, dashboard 프레임 바인딩된 페이지):
 *
 * | 맥락        | mobile 결과                                       |
 * | ----------- | ------------------------------------------------- |
 * | 프레임 편집 | 358 폭 세로 스택 60 / 60 / 652 (= 페이지 높이)    |
 * | 페이지 적용 | 2열 grid 유지 — sidebar 240 / **content 98**      |
 *
 * 슬롯 쪽 override 는 `asPageResolvedSlot` 의 스프레드가 노드를 통째로 옮겨 이미 살아 있었다.
 * 그래서 dashboard-widgets 는 tablet 에서 **item 만 이동하고 컨테이너 트랙은 그대로**가 되어
 * widgets 가 sidebar 와 겹쳤다 — ADR-168 G8("item placement override 는 컨테이너 template
 * override 를 동반한다")이 정의에서는 지켜졌는데 이 경로에서 한쪽만 살아남아 깨졌다.
 *
 * 병합 규칙은 base style 과 **같은 정책**이다: frame 이 이기되, page 가 선언한 viewport 키
 * ({@link PAGE_BODY_STYLE_PRESERVE_KEYS})는 page 가 되찾는다. `visibility` 는 page 것만
 * 쓴다 — 합쳐진 노드는 page body 이고, frame body 를 mobile 에서 숨기라는 선언을 그대로
 * 적용하면 page 소유 콘텐츠까지 함께 사라진다.
 */
function mergePageBodyResponsive(
  pageBody: CanvasSceneNode,
  frameBody: CanvasSceneNode,
): CanvasSceneNode["responsive"] {
  const frameStyles = frameBody.responsive?.styles as
    | ResponsiveStyleMap
    | undefined;
  if (!frameStyles || Object.keys(frameStyles).length === 0) {
    return pageBody.responsive;
  }

  const pageStyles = (pageBody.responsive?.styles ?? {}) as ResponsiveStyleMap;
  const styles: ResponsiveStyleMap = { ...pageStyles, ...frameStyles };

  for (const key of PAGE_BODY_STYLE_PRESERVE_KEYS) {
    if (pageStyles[key] !== undefined) {
      styles[key] = pageStyles[key];
    }
  }

  const next: NonNullable<CanvasSceneNode["responsive"]> = {
    styles: styles as NonNullable<CanvasSceneNode["responsive"]>["styles"],
  };
  if (pageBody.responsive?.visibility) {
    next.visibility = pageBody.responsive.visibility;
  }
  return next;
}

function mergePageBodyWithFrameLayout(
  pageBody: CanvasSceneNode,
  frameBody: CanvasSceneNode,
): CanvasSceneNode {
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

  const responsive = mergePageBodyResponsive(pageBody, frameBody);

  return {
    ...pageBody,
    props: {
      ...pageProps,
      style: mergedStyle,
    },
    ...(responsive ? { responsive } : {}),
  };
}

function getPageResolvedSlotStyle(
  slot: CanvasSceneNode,
  frameBody: CanvasSceneNode,
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
    // 배치만 보완한다. **크기는 주입하지 않는다** (2026-07-27) — grid item 은 기본 stretch 라
    // 자기 area 를 이미 채운다. 같은 슬롯이 프레임 편집 맥락에서는 주입 없이 정확히 채운다
    // (실측 desktop dashboard: sidebar 240×968 / content 1628×968).
    //
    // `height: 100%` 를 주입하면 `auto` 행이 컨테이너 높이로 부풀어 **행마다 페이지 한 장**이
    // 된다 (실측: navigation 60 → 1048, 두 번째 행이 y=1084 로 페이지 밖). CSS 에서 grid item
    // 의 백분율 높이는 자기 **grid area** 기준이고 `auto` 행은 불확정이라 auto 로 접히는데,
    // 엔진은 컨테이너 높이로 해석해 발산한다. 주입이 없으면 이 발산 경로 자체가 사라진다.
    //
    // 이 주입은 ADR-168(슬롯이 자기 배치·크기를 스스로 선언) 이전의 fallback 이었다.
    nextStyle.gridArea ??= slotName;
  }

  return nextStyle;
}

function asPageResolvedRootSlot(
  slot: CanvasSceneNode,
  parentId: string,
  frameBody: CanvasSceneNode,
): CanvasSceneNode {
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
    body: CanvasSceneNode | null;
    nonBody: CanvasSceneNode[];
  } => {
    let body: CanvasSceneNode | null = null;
    let boundFrameBody: CanvasSceneNode | null = null;
    const nonBody: CanvasSceneNode[] = [];
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

  const legacyFrameElements: CanvasSceneNode[] = [];
  const hydratedFrameElements: CanvasSceneNode[] = [];
  for (const el of elementsMap.values()) {
    if (isHydratedPageFrameElement(el, page.id, layoutId)) {
      hydratedFrameElements.push(el);
    } else if (isLegacyFrameElementForFrame(el, layoutId)) {
      legacyFrameElements.push(el);
    }
  }

  const hasHydratedFrameBody = hydratedFrameElements.some((el) =>
    isBodyType(el.type),
  );
  const frameElements = hasHydratedFrameBody
    ? hydratedFrameElements
    : legacyFrameElements;

  let frameBody: CanvasSceneNode | null = null;
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

  const slotByName = new Map<string, CanvasSceneNode>();
  for (const el of frameElements) {
    if (el.type !== "Slot") continue;
    const slotName = readSlotElementName(el);
    if (!slotByName.has(slotName)) slotByName.set(slotName, el);
  }

  const pageBodyId = pageBody.id;
  const frameBodyId = frameBody.id;
  const frameElementIds = new Set(frameElements.map((el) => el.id));
  const frameElementById = new Map(
    frameElements.map((el) => [el.id, el] as const),
  );
  const resolvedPageBody = mergePageBodyWithFrameLayout(pageBody, frameBody);
  const pageContentElements = pageNonBody.filter(
    (el) => el.id !== page.id && !frameElementIds.has(el.id),
  );

  const projectFrameElementId = (el: CanvasSceneNode): string => {
    if (isProjectedPageFrameElementId(page.id, el.id)) return el.id;
    return toPageFrameElementId(page.id, getCanonicalSourceId(el));
  };

  const resolveProjectableParentId = (
    parentId: string | null | undefined,
  ): string | null => {
    if (!parentId || parentId === frameBodyId) {
      return pageBodyId;
    }

    let currentParentId = parentId;
    let safety = 0;

    while (frameElementIds.has(currentParentId) && safety < 64) {
      const currentParent = frameElementById.get(currentParentId);
      if (!currentParent) {
        return currentParentId;
      }

      if (isBodyType(currentParent.type)) {
        const nextParentId = currentParent.parent_id ?? null;
        if (!nextParentId) {
          return pageBodyId;
        }
        if (nextParentId === frameBodyId) {
          return pageBodyId;
        }
        currentParentId = nextParentId;
        continue;
      }
      return projectFrameElementId(currentParent);
    }

    return currentParentId === frameBodyId || !currentParentId
      ? pageBodyId
      : currentParentId;
  };

  const projectFrameElement = (el: CanvasSceneNode): CanvasSceneNode => {
    const parentId = resolveProjectableParentId(el.parent_id);
    const slotName = el.type === "Slot" ? readSlotElementName(el) : undefined;
    return {
      ...el,
      id: projectFrameElementId(el),
      parentId,
      parent_id: parentId,
      pageId: page.id,
      page_id: page.id,
      projection: {
        kind: "page-frame-element",
        pageId: page.id,
        sourceElementId: getCanonicalSourceId(el),
        renderElementId: projectFrameElementId(el),
        renderParentId: parentId,
        canonicalParentId: el.parent_id ?? null,
        ...(slotName ? { slotName } : {}),
        ...(slotName
          ? { descendantPath: getSlotDescendantPath(frameBody, el) }
          : {}),
      },
    };
  };

  const slotNameByContentParentId = new Map<string, string>();
  for (const el of frameElements) {
    if (el.type !== "Slot") continue;
    const slotName = readSlotElementName(el);
    slotNameByContentParentId.set(el.id, slotName);
    slotNameByContentParentId.set(projectFrameElementId(el), slotName);
  }

  const pageRootBySlot = new Map<string, CanvasSceneNode[]>();
  const pageNonRoot: CanvasSceneNode[] = [];
  for (const el of pageContentElements) {
    const parentSlotName = el.parent_id
      ? slotNameByContentParentId.get(el.parent_id)
      : undefined;
    if (parentSlotName) {
      const list = pageRootBySlot.get(parentSlotName);
      if (list) list.push(el);
      else pageRootBySlot.set(parentSlotName, [el]);
      continue;
    }

    const isRoot =
      !el.parent_id || el.parent_id === pageBodyId || el.parent_id === page.id;
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

  const result: CanvasSceneNode[] = [];
  const projectedSlotByName = new Map<string, CanvasSceneNode>();

  for (const el of frameElements) {
    if (el.id === frameBodyId) continue;
    if (isBodyType(el.type)) continue;
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
    const targetSlotProjection = targetSlot.projection;
    const descendantPath =
      (targetSlotProjection?.kind === "page-frame-element" ||
      targetSlotProjection?.kind === "page-slot-fill"
        ? targetSlotProjection.descendantPath
        : undefined) ??
      `${getCanonicalSourceId(frameBody)}/${getCanonicalSourceId(targetSlot)}`;
    for (const el of elements) {
      result.push({
        ...el,
        parentId: targetSlot.id,
        parent_id: targetSlot.id,
        projection: {
          kind: "page-slot-fill",
          pageId: page.id,
          sourceElementId: getCanonicalSourceId(el),
          renderElementId: el.id,
          renderParentId: targetSlot.id,
          canonicalParentId: el.parent_id ?? null,
          slotName,
          descendantPath,
        },
      });
    }
  }

  result.push(...pageNonRoot);

  return {
    bodyElement: resolvedPageBody,
    pageElements: result,
    hasFrameBinding: true,
  };
}
