import { afterEach, describe, expect, it, vi } from "vitest";

import type { CanonicalNode, CompositionDocument } from "@composition/shared";

import { planTabItemInsert } from "../collectionItemInsert";
import { ensureMenuTemplateOrigins } from "../menu/menuTemplateOrigins";
import { ensureReusableCompositeOrigins } from "../reusableCompositeOrigins";
import { isSlotHostElement } from "../slotHostPolicy";
import { indexNodes } from "../staticCollectionMigration";
import {
  TREE_ITEM_DEFAULT_ORIGIN_ID,
  TREE_ORIGIN_ID,
} from "../tree/treeTemplateOrigins";

/**
 * ADR-239 판독 M1 — 소속 Tree 가 없는 TreeItem (Components 의 TreeItem origin · 상태 변형 · Tree 밖 instance) 은 하위
 * 항목 host 가 아니다. Canvas 는 하위 행을 Tree 행 평탄화로만 그리고 (단독 TreeItem 상자에는 역할 자식만) Preview RAC
 * TreeItem 은 Tree collection 밖에서 행을 만들지 않는다 — origin 에 넣은 하위 항목은 origin 상자에 보이지 않고 모든 Tree
 * 항목 instance 에 상속됐다.
 */

afterEach(() => vi.restoreAllMocks());

function seededDoc(user: CanonicalNode[]): CompositionDocument {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  return ensureReusableCompositeOrigins(
    ensureMenuTemplateOrigins({
      version: "composition-1.0",
      children: [
        {
          id: "page-home",
          type: "frame",
          metadata: { type: "legacy-page", pageId: "page-home", slug: "/" },
          children: [
            {
              id: "body-home",
              type: "body" as CanonicalNode["type"],
              children: user,
            },
          ],
        },
      ],
    } as CompositionDocument),
  );
}

const plan = (document: CompositionDocument, hostId: string) =>
  planTabItemInsert({
    document,
    hostId,
    candidateId: TREE_ITEM_DEFAULT_ORIGIN_ID,
    newKey: "k-new",
  });

describe("ADR-239 판독 M1 — 소속 Tree 없는 TreeItem host", () => {
  const doc = seededDoc([
    {
      id: "t",
      type: "Tree",
      props: {},
      children: [
        {
          id: "in-tree",
          type: "ref",
          ref: TREE_ITEM_DEFAULT_ORIGIN_ID,
          props: { id: "in-tree" },
        },
      ],
    } as unknown as CanonicalNode,
    {
      id: "loose",
      type: "ref",
      ref: TREE_ITEM_DEFAULT_ORIGIN_ID,
      props: { id: "loose" },
    } as unknown as CanonicalNode,
  ]);
  const byId = indexNodes(doc);

  it("Slot 삽입 계획 — origin · 상태 변형 · Tree 밖 instance 는 null, Tree 안 항목은 그대로", () => {
    expect(plan(doc, TREE_ITEM_DEFAULT_ORIGIN_ID)).toBeNull();
    expect(plan(doc, `${TREE_ITEM_DEFAULT_ORIGIN_ID}--collapsed`)).toBeNull();
    expect(plan(doc, "loose")).toBeNull();
    expect(plan(doc, "in-tree")).toMatchObject({
      kind: "plain",
      tabListId: "in-tree",
    });
    // Tree origin instance 가 상속한 항목 (synthetic host) 도 그대로.
    const inst = seededDoc([
      { id: "ti", type: "ref", ref: TREE_ORIGIN_ID, props: {} },
    ] as unknown as CanonicalNode[]);
    expect(plan(inst, "ti/component-tree__item-2")).toMatchObject({
      kind: "instance",
      instanceId: "ti",
    });
    // 수리 검증 판독 — 사용자 컴포넌트 (frame origin) 안 Tree 의 상속 항목: 소속 Tree 는 origin 안쪽 경로에 있다.
    const user = seededDoc([
      {
        id: "uc",
        type: "frame",
        reusable: true,
        props: {},
        children: [
          {
            id: "uc-tree",
            type: "Tree",
            props: {},
            children: [
              {
                id: "uc-ti",
                type: "ref",
                ref: TREE_ITEM_DEFAULT_ORIGIN_ID,
                props: { id: "uc-ti" },
              },
            ],
          },
        ],
      },
      { id: "u1", type: "ref", ref: "uc", props: {} },
    ] as unknown as CanonicalNode[]);
    expect(plan(user, "u1/uc-tree/uc-ti")).toMatchObject({
      kind: "instance",
      instanceId: "u1",
    });
  });

  it('Slot host 표시 — origin · 상태 변형에는 Slot "+" 가 없다', () => {
    const origin = byId.get(TREE_ITEM_DEFAULT_ORIGIN_ID)!;
    const variant = byId.get(`${TREE_ITEM_DEFAULT_ORIGIN_ID}--collapsed`)!;
    const withSlot = (node: CanonicalNode) =>
      ({
        ...node,
        type: "TreeItem",
        slot: (origin as { slot?: unknown }).slot,
      }) as Parameters<typeof isSlotHostElement>[0] & object;
    expect(isSlotHostElement(withSlot(origin))).toBe(false);
    expect(isSlotHostElement(withSlot(variant))).toBe(false);
    expect(isSlotHostElement(withSlot(byId.get("in-tree")!))).toBe(true);
    // 패널 모양 — instance host 는 origin 필드 (reusable · metadata) 위에 자기 id (FrameSlotSection).
    expect(
      isSlotHostElement({ ...withSlot(origin), id: "in-tree" }),
    ).toBe(true);
  });
});
