import { describe, expect, it } from "vitest";

import type {
  CanonicalNode,
  CompositionDocument,
  ResolvedNode,
} from "@composition/shared";

import { projectPageFrameNode } from "../projectPageFrameTree";

/**
 * 프레임을 적용한 페이지의 DOM 축 합성.
 *
 * Why: `resolveCanonicalDocument` 는 ref 를 열 때 master 자식과 instance 자식을 **이어
 * 붙인다**. 페이지가 프레임을 참조하면 프레임 body(빈 슬롯)와 페이지 body(콘텐츠)가 형제로
 * 놓여, 빈 슬롯이 뷰포트를 채우고 콘텐츠는 그 아래로 밀려난다 — 사용자 눈에는 "프레임 적용
 * 후 preview 가 안 나온다".
 *
 * 실측(2026-07-27, `page-home` + 2-Row): Skia 는 page body 390×844 > 슬롯 60/784 > ListBox,
 * preview 는 page-home 390×**1688** > [프레임 body 844(빈 슬롯), page body 844].
 */

const FRAME_ID = "layout-1";
const PAGE_ID = "page-home";

function slot(
  id: string,
  name: string,
  style: Record<string, unknown> = {},
  children: CanonicalNode[] = [],
): CanonicalNode {
  return {
    id,
    type: "frame",
    name,
    props: { name, style },
    metadata: { type: "legacy-slot-hoisted", slotName: name },
    ...(children.length ? { children } : {}),
  } as CanonicalNode;
}

function doc(pageChildren: CanonicalNode[]): CompositionDocument {
  return {
    version: "1.0",
    children: [
      {
        id: FRAME_ID,
        type: "frame",
        name: "Frame 1",
        children: [
          {
            id: "frame-body",
            type: "body",
            props: {
              style: { display: "flex", flexDirection: "column", gap: 8 },
            },
            children: [
              slot("slot-header", "header", { minHeight: 60 }),
              slot("slot-content", "content", { minHeight: 60 }),
            ],
          } as unknown as CanonicalNode,
        ],
      } as CanonicalNode,
      {
        id: PAGE_ID,
        type: "ref",
        ref: FRAME_ID,
        name: "Home",
        metadata: { type: "legacy-page", pageId: PAGE_ID },
        children: pageChildren,
      } as CanonicalNode,
    ],
  } as CompositionDocument;
}

/** resolver 출력 모사 — origin(프레임) 자식 뒤에 instance(page) 자식이 이어 붙는다. */
function resolvedPage(d: CompositionDocument): ResolvedNode {
  const frame = d.children[0] as ResolvedNode;
  const page = d.children[1] as ResolvedNode;
  return {
    ...page,
    type: "frame",
    _resolvedFrom: FRAME_ID,
    children: [
      ...((frame.children ?? []) as ResolvedNode[]),
      ...((page.children ?? []) as ResolvedNode[]),
    ],
  };
}

const pageBody = (children: CanonicalNode[] = []): CanonicalNode =>
  ({
    id: "page-home-body",
    type: "body",
    props: { style: { overflow: "auto", width: "390px" } },
    ...(children.length ? { children } : {}),
  }) as unknown as CanonicalNode;

const content = (id: string, slotName?: string): CanonicalNode =>
  ({
    id,
    type: "Frame",
    ...(slotName ? { props: { slot_name: slotName } } : {}),
  }) as unknown as CanonicalNode;

describe("projectPageFrameNode", () => {
  it("body 를 하나로 합치고 슬롯을 그 자식으로 투영한다", () => {
    const d = doc([pageBody([content("listbox")])]);
    const out = projectPageFrameNode(resolvedPage(d), d);

    expect(out.children).toHaveLength(1);
    const body = out.children![0];
    expect(body.id).toBe("page-home-body");
    expect(body.children!.map((c) => c.id)).toEqual([
      `${PAGE_ID}::page-frame::slot-header`,
      `${PAGE_ID}::page-frame::slot-content`,
    ]);
  });

  it("종전 동작(형제 두 body)을 만들지 않는다 — 회귀 기준선", () => {
    const d = doc([pageBody([content("listbox")])]);
    const before = resolvedPage(d);
    // 수정 전 렌더 입력: 프레임 body + page body 가 형제 → 뷰포트 두 배
    expect(
      before.children!.filter((c) => (c.type as string) === "body"),
    ).toHaveLength(2);

    const out = projectPageFrameNode(before, d);
    expect(
      out.children!.filter((c) => (c.type as string) === "body"),
    ).toHaveLength(1);
  });

  it("슬롯 미지정 콘텐츠는 content 슬롯으로 들어간다", () => {
    const d = doc([pageBody([content("listbox")])]);
    const out = projectPageFrameNode(resolvedPage(d), d);
    const [header, contentSlot] = out.children![0].children!;

    expect(header.children ?? []).toHaveLength(0);
    expect(contentSlot.children!.map((c) => c.id)).toEqual(["listbox"]);
  });

  it("slot_name 이 선언되면 그 슬롯으로 라우팅한다", () => {
    const d = doc([
      pageBody([content("logo", "header"), content("listbox", "content")]),
    ]);
    const out = projectPageFrameNode(resolvedPage(d), d);
    const [header, contentSlot] = out.children![0].children!;

    expect(header.children!.map((c) => c.id)).toEqual(["logo"]);
    expect(contentSlot.children!.map((c) => c.id)).toEqual(["listbox"]);
  });

  it("어느 슬롯과도 안 맞는 콘텐츠는 body 직계로 남는다 (소실 금지)", () => {
    const d = doc([pageBody([content("stray", "sidebar")])]);
    const out = projectPageFrameNode(resolvedPage(d), d);
    const bodyKids = out.children![0].children!.map((c) => c.id);

    expect(bodyKids).toContain("stray");
    expect(bodyKids).toHaveLength(3); // 슬롯 2 + stray
  });

  it("채워진 슬롯은 프레임 기본 자식을 감추고, 빈 슬롯은 유지한다", () => {
    const d: CompositionDocument = {
      version: "1.0",
      children: [
        {
          id: FRAME_ID,
          type: "frame",
          name: "Frame 1",
          children: [
            {
              id: "frame-body",
              type: "body",
              props: { style: { display: "flex", flexDirection: "column" } },
              children: [
                slot("slot-header", "header", {}, [content("frame-logo")]),
                slot("slot-content", "content", {}, [content("placeholder")]),
              ],
            } as unknown as CanonicalNode,
          ],
        } as CanonicalNode,
        {
          id: PAGE_ID,
          type: "ref",
          ref: FRAME_ID,
          metadata: { type: "legacy-page", pageId: PAGE_ID },
          children: [pageBody([content("listbox")])],
        } as CanonicalNode,
      ],
    } as CompositionDocument;

    const [header, contentSlot] = projectPageFrameNode(resolvedPage(d), d)
      .children![0].children!;

    expect(header.children!.map((c) => c.id)).toEqual(["frame-logo"]); // 미채움 → 기본 유지
    expect(contentSlot.children!.map((c) => c.id)).toEqual(["listbox"]); // 채움 → 기본 감춤
  });

  it("style 은 프레임이 이기되 page 뷰포트 키는 page 가 되찾는다", () => {
    const d = doc([pageBody([content("listbox")])]);
    const style = projectPageFrameNode(resolvedPage(d), d).children![0].props!
      .style as Record<string, unknown>;

    expect(style.display).toBe("flex"); // 프레임 레이아웃 문법
    expect(style.flexDirection).toBe("column");
    expect(style.overflow).toBe("auto"); // page 고유
    expect(style.width).toBe("390px"); // 뷰포트 권한 = page
  });

  it("flex column 컨테이너에서 content 슬롯이 주축 여유를 먹는다", () => {
    const d = doc([pageBody([content("listbox")])]);
    const [header, contentSlot] = projectPageFrameNode(resolvedPage(d), d)
      .children![0].children!;

    const hs = header.props!.style as Record<string, unknown>;
    const cs = contentSlot.props!.style as Record<string, unknown>;
    expect(hs.width).toBe("100%");
    expect(hs.flexShrink).toBe(0);
    expect(cs.flex).toBe("1 1 auto");
    expect(cs.minHeight).toBe(60); // 슬롯 자기 선언 보존 (??= 라 덮지 않음)
  });

  it("프레임 미참조 페이지는 손대지 않는다", () => {
    const plain: CompositionDocument = {
      version: "1.0",
      children: [
        {
          id: PAGE_ID,
          type: "frame",
          metadata: { type: "legacy-page", pageId: PAGE_ID },
          children: [pageBody([content("listbox")])],
        } as CanonicalNode,
      ],
    } as CompositionDocument;
    const node = plain.children[0] as ResolvedNode;

    expect(projectPageFrameNode(node, plain)).toBe(node);
  });

  it("프레임 body 가 없는 ref (일반 컴포넌트) 는 손대지 않는다", () => {
    const d: CompositionDocument = {
      version: "1.0",
      children: [
        {
          id: "component-x",
          type: "Frame",
          reusable: true,
          children: [content("origin-child")],
        } as unknown as CanonicalNode,
        {
          id: "instance-x",
          type: "ref",
          ref: "component-x",
          children: [content("instance-child")],
        } as CanonicalNode,
      ],
    } as CompositionDocument;
    const node: ResolvedNode = {
      ...(d.children[1] as ResolvedNode),
      type: "Frame" as ResolvedNode["type"],
      children: [
        content("origin-child") as ResolvedNode,
        content("instance-child") as ResolvedNode,
      ],
    };

    expect(projectPageFrameNode(node, d)).toBe(node);
  });
});
