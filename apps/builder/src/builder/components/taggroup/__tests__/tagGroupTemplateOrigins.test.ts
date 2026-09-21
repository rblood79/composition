import { describe, expect, it } from "vitest";
import type { CanonicalNode, CompositionDocument } from "@composition/shared";
import { catalogReusableOriginId, resolveSlotComposition } from "@composition/shared";

import {
  TAG_ITEM_DEFAULT_ORIGIN_ID,
  TAG_ITEM_SELECTED_ORIGIN_ID,
  TAGGROUP_ORIGIN_ID,
  ensureTagGroupTemplateOrigins,
  findTagGroupOriginTagList,
} from "../tagGroupTemplateOrigins";
import { getReusableOriginEnsurers } from "../../reusableCompositeOrigins";
import {
  TEMPLATE_ORIGIN_REUSABLE_TYPES,
  getCatalogOriginTypes,
} from "../../catalogOrigins";

function makeDocument(): CompositionDocument {
  return {
    version: "composition-1.0",
    children: [
      {
        id: "page-home",
        type: "frame",
        name: "Home",
        metadata: { type: "legacy-page", pageId: "page-home", slug: "/" },
        children: [{ id: "body-home", type: "body" as CanonicalNode["type"] }],
      },
    ],
  };
}

function findById(
  nodes: readonly CanonicalNode[],
  id: string,
): CanonicalNode | undefined {
  for (const node of nodes) {
    if (node.id === id) return node;
    const child = findById(node.children ?? [], id);
    if (child) return child;
  }
  return undefined;
}

function mapNodes(
  nodes: readonly CanonicalNode[],
  fn: (node: CanonicalNode) => CanonicalNode,
): CanonicalNode[] {
  return nodes.map((node) => {
    const next = fn(node);
    return next.children
      ? { ...next, children: mapNodes(next.children, fn) }
      : next;
  });
}

describe("ADR-229 Phase 1 — TagGroup item template origins", () => {
  it("Tag item default/selected origin 을 Icon·Avatar·Text(label) slot 자식으로 시드한다", () => {
    const doc = ensureTagGroupTemplateOrigins(makeDocument());

    const origin = findById(doc.children, TAG_ITEM_DEFAULT_ORIGIN_ID);
    expect(origin).toMatchObject({
      type: "Tag",
      reusable: true,
      props: { children: "{label}" },
      metadata: expect.objectContaining({
        type: "tag-template-origin",
        systemOwned: true,
        componentFamily: "TagGroup",
        variant: "default",
      }),
    });
    const composition = resolveSlotComposition(origin?.children);
    expect(composition?.order).toEqual(["icon", "avatar", "label"]);
    expect(composition?.slots.icon?.optional).toBe(true);
    expect(composition?.slots.avatar?.optional).toBe(true);
    expect(composition?.slots.label?.optional).toBeUndefined();
    expect(origin?.children?.map((c) => c.type)).toEqual([
      "Icon",
      "Avatar",
      "Text",
    ]);
    expect(origin?.children?.map((c) => c.props?.slot)).toEqual([
      "icon",
      "avatar",
      "label",
    ]);
    expect(origin?.children?.[1]?.props).toMatchObject({ src: "{avatar}" });

    const selected = findById(doc.children, TAG_ITEM_SELECTED_ORIGIN_ID);
    expect(selected?.metadata).toMatchObject({ variant: "selected" });
    expect(resolveSlotComposition(selected?.children)?.order).toEqual(
      composition?.order,
    );
    // id 에 `/` 없음 (descendants 경로 구분자) · 자식 id 는 origin id 파생.
    for (const node of [origin!, selected!]) {
      expect(node.id.includes("/")).toBe(false);
      for (const child of node.children ?? []) {
        expect(child.id.startsWith(`${node.id}__`)).toBe(true);
      }
    }
  });

  it("TagGroup origin 은 generic seed 와 같은 트리이고 root 가 slot: [default, selected] 를 갖는다 (ListBox 동형 · TagList 자식은 slot 없음)", () => {
    const doc = ensureTagGroupTemplateOrigins(makeDocument());
    const origin = findById(doc.children, TAGGROUP_ORIGIN_ID)!;
    expect(TAGGROUP_ORIGIN_ID).toBe(catalogReusableOriginId("TagGroup"));
    expect(origin).toMatchObject({
      type: "TagGroup",
      reusable: true,
      metadata: expect.objectContaining({
        systemOwned: true,
        componentFamily: "TagGroup",
      }),
    });
    expect(origin.children?.map((c) => c.type)).toEqual(["Label", "TagList"]);
    expect(origin.slot).toEqual([
      TAG_ITEM_DEFAULT_ORIGIN_ID,
      TAG_ITEM_SELECTED_ORIGIN_ID,
    ]);
    // Phase 2 정정: TagList 자식에 두면 Properties 가 instance 의 fill 대상 ("Target slot") 으로 읽는다.
    expect(findTagGroupOriginTagList(origin)?.slot).toBeUndefined();
    // ADR-228 generic seed 와 같은 root props (팔레트 생성과 같은 노드).
    expect(origin.props).toMatchObject({
      label: "Tag Group",
      size: "md",
      maxRows: 2,
    });
    expect(Array.isArray(origin.props?.items)).toBe(true);
  });

  it("등록 — TagGroup 은 template origin 보유자로 generic 50 에서 빠지고 ensurer 는 손 seed 모듈이다", () => {
    expect(TEMPLATE_ORIGIN_REUSABLE_TYPES.has("TagGroup")).toBe(true);
    expect(getCatalogOriginTypes()).not.toContain("TagGroup");
    expect(getReusableOriginEnsurers()[TAGGROUP_ORIGIN_ID]).toBe(
      ensureTagGroupTemplateOrigins,
    );
  });

  it("재hydration 멱등 + 기존 origin 편집 보존 (root style · slot 자식 삭제) + root slot 결손 보충 + Phase 1 당일 TagList slot 은 root 로 이동", () => {
    const once = ensureTagGroupTemplateOrigins(makeDocument());
    const twice = ensureTagGroupTemplateOrigins(once);
    expect(JSON.stringify(twice)).toBe(JSON.stringify(once));

    // 사용자가 origin 을 바꾼 상태: default 의 root style + Avatar slot 삭제 · TagGroup origin
    //   의 TagList 에서 slot 을 지운 legacy 모양 (ADR-228 generic seed 가 만든 문서).
    const edited: CompositionDocument = {
      ...once,
      children: mapNodes(once.children, (node) => {
        if (node.id === TAG_ITEM_DEFAULT_ORIGIN_ID) {
          return {
            ...node,
            props: { ...node.props, style: { paddingLeft: 20, fontSize: 18 } },
            children: (node.children ?? []).filter((c) => c.type !== "Avatar"),
          };
        }
        if (node.id === TAGGROUP_ORIGIN_ID) {
          // root slot 없음 + TagList 자식에 slot (Phase 1 당일 시드 모양).
          const { slot: _rootSlot, ...root } = node;
          return {
            ...root,
            children: (node.children ?? []).map((c) =>
              c.type === "TagList"
                ? { ...c, slot: [TAG_ITEM_DEFAULT_ORIGIN_ID, TAG_ITEM_SELECTED_ORIGIN_ID] }
                : c,
            ),
          };
        }
        return node;
      }),
    };
    const repaired = ensureTagGroupTemplateOrigins(edited);
    const origin = findById(repaired.children, TAG_ITEM_DEFAULT_ORIGIN_ID)!;
    expect(origin.props?.style).toEqual({ paddingLeft: 20, fontSize: 18 });
    expect(origin.children?.map((c) => c.type)).toEqual(["Icon", "Text"]);
    const tagGroup = findById(repaired.children, TAGGROUP_ORIGIN_ID)!;
    expect(tagGroup.slot).toEqual([
      TAG_ITEM_DEFAULT_ORIGIN_ID,
      TAG_ITEM_SELECTED_ORIGIN_ID,
    ]);
    expect(findTagGroupOriginTagList(tagGroup)?.slot).toBeUndefined();
    // 사용자가 바꾼 TagList slot (표준 두 id 가 아님) 은 옮기지 않고 보존, root 는 표준으로 보충.
    const custom = ensureTagGroupTemplateOrigins({
      ...once,
      children: mapNodes(once.children, (node) =>
        node.id === TAGGROUP_ORIGIN_ID
          ? {
              ...(({ slot: _s, ...r }) => r)(node),
              children: (node.children ?? []).map((c) =>
                c.type === "TagList" ? { ...c, slot: ["my-tag-item"] } : c,
              ),
            }
          : node,
      ),
    });
    const customGroup = findById(custom.children, TAGGROUP_ORIGIN_ID)!;
    expect(findTagGroupOriginTagList(customGroup)?.slot).toEqual(["my-tag-item"]);
    expect(customGroup.slot).toEqual([TAG_ITEM_DEFAULT_ORIGIN_ID, TAG_ITEM_SELECTED_ORIGIN_ID]);
  });
});
