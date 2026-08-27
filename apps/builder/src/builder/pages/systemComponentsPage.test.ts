import { describe, expect, it } from "vitest";
import type { CanonicalNode, CompositionDocument } from "@composition/shared";
import {
  COMPONENTS_SYSTEM_BODY_ID,
  COMPONENTS_SYSTEM_PAGE_ID,
  ensureComponentsSystemPage,
} from "./systemComponentsPage";

/**
 * 회귀 방지 — 시스템 페이지(Components / fallback Home) body 의 overflow 기본값 (2026-07-21 사용자 보고).
 *
 * 근본 원인: 스크롤 동작(fullTreeLayout GAP4 maxScroll) / 렌더(buildSpecNodeData·buildBoxNodeData
 * scrollbar) / 휠(useScrollWheelInteraction) 4 소비자가 전부 raw `element.props.style.overflow`
 * 를 읽는다. catalog containerStyles.overflow fallback 은 buildNodeStyle(layout) + 패널만 소비 →
 * 시스템 페이지 body 가 props:{} 로 생성되면 콘텐츠가 pageHeight(기본 1080)를 넘어도 maxScrollTop 이
 * 0 → 스크롤바 미표시. 일반 사용자 페이지(createDefaultBodyProps)는 real overflow:auto 를 갖는데
 * 시스템 페이지만 이 채널을 빠뜨린 비대칭. → body 에 real overflow:auto 부여 (신규 생성 + 기존 repair).
 */

function makeEditorPage(id: string): CanonicalNode {
  return {
    id,
    type: "frame",
    name: id,
    metadata: {
      type: "legacy-page",
      pageId: id,
      slug: id === "page-home" ? "/" : `/${id}`,
      parent_id: null,
    },
    children: [
      { id: `${id}-body`, type: "body" as CanonicalNode["type"], props: {} },
    ],
  } as CanonicalNode;
}

function findComponentsBody(
  doc: CompositionDocument,
): CanonicalNode | undefined {
  const page = doc.children.find((n) => n.id === COMPONENTS_SYSTEM_PAGE_ID);
  return page?.children?.find((c) => c.id === COMPONENTS_SYSTEM_BODY_ID);
}

function bodyOverflow(body: CanonicalNode | undefined): unknown {
  return (body?.props?.style as Record<string, unknown> | undefined)?.overflow;
}

describe("ensureComponentsSystemPage — 시스템 body overflow:auto", () => {
  it("신규 생성: Components 페이지가 없으면 body 에 overflow:auto 를 실제 props.style 로 부여", () => {
    const doc: CompositionDocument = {
      version: "composition-1.0",
      children: [makeEditorPage("page-home")],
    };
    const out = ensureComponentsSystemPage(doc);
    expect(bodyOverflow(findComponentsBody(out))).toBe("auto");
  });

  it("기존 repair: Components body(props:{}) 에 overflow:auto 를 보강", () => {
    const componentsPage: CanonicalNode = {
      id: COMPONENTS_SYSTEM_PAGE_ID,
      type: "frame",
      name: "Components",
      metadata: {
        type: "legacy-page",
        pageId: COMPONENTS_SYSTEM_PAGE_ID,
        slug: "/components",
        parent_id: null,
        systemOwned: true,
      },
      children: [
        {
          id: COMPONENTS_SYSTEM_BODY_ID,
          type: "body" as CanonicalNode["type"],
          props: {},
        },
      ],
    } as CanonicalNode;

    const doc: CompositionDocument = {
      version: "composition-1.0",
      children: [componentsPage, makeEditorPage("page-home")],
    };
    const out = ensureComponentsSystemPage(doc);
    expect(bodyOverflow(findComponentsBody(out))).toBe("auto");
  });

  it("기존 명시 overflow 는 보존 (덮어쓰기 금지)", () => {
    const componentsPage: CanonicalNode = {
      id: COMPONENTS_SYSTEM_PAGE_ID,
      type: "frame",
      name: "Components",
      metadata: {
        type: "legacy-page",
        pageId: COMPONENTS_SYSTEM_PAGE_ID,
        slug: "/components",
        parent_id: null,
        systemOwned: true,
      },
      children: [
        {
          id: COMPONENTS_SYSTEM_BODY_ID,
          type: "body" as CanonicalNode["type"],
          props: { style: { overflow: "hidden" } },
        },
      ],
    } as CanonicalNode;

    const doc: CompositionDocument = {
      version: "composition-1.0",
      children: [componentsPage, makeEditorPage("page-home")],
    };
    const out = ensureComponentsSystemPage(doc);
    expect(bodyOverflow(findComponentsBody(out))).toBe("hidden");
  });
});
