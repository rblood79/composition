import { describe, expect, it } from "vitest";
import type { CanonicalNode, CompositionDocument } from "@composition/shared";
import { resolveSlotComposition } from "@composition/shared";

import {
  ensureGridListTemplateOrigins,
  GRIDLIST_ITEM_DEFAULT_ORIGIN_ID,
  GRIDLIST_ORIGIN_ID,
} from "../gridListTemplateOrigins";

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

describe("ADR-148 Phase 4 GridList template origins", () => {
  it("bootstraps the GridListItem default origin with label/description slot children", () => {
    const doc = ensureGridListTemplateOrigins(makeDocument());

    const origin = findById(doc.children, GRIDLIST_ITEM_DEFAULT_ORIGIN_ID);
    expect(origin).toMatchObject({
      type: "GridListItem",
      reusable: true,
      props: {
        children: "{label}",
        textValue: "{label}",
        description: "{description}",
      },
      metadata: expect.objectContaining({
        type: "gridlist-template-origin",
        systemOwned: true,
        componentFamily: "GridList",
      }),
    });

    // slot 조합 자식 — 구성 SSOT (order + optional + slotRole 양축 병기).
    const composition = resolveSlotComposition(origin?.children);
    expect(composition?.order).toEqual(["label", "description"]);
    expect(composition?.slots.description?.optional).toBe(true);
  });

  it("is idempotent and preserves user edits on the origin (repair semantics)", () => {
    const once = ensureGridListTemplateOrigins(makeDocument());
    const twice = ensureGridListTemplateOrigins(once);
    // 재실행 시 내용 동일 + origin 중복 없음 (toolbar 선례 동형).
    expect(twice).toEqual(once);

    // 사용자 편집(자식 slot 제거 + style 부여)이 repair 로 되돌려지지 않아야 한다.
    const edited = JSON.parse(JSON.stringify(once)) as CompositionDocument;
    const origin = findById(edited.children, GRIDLIST_ITEM_DEFAULT_ORIGIN_ID);
    origin!.children = origin!.children!.filter(
      (child) => child.metadata?.slotRole !== "description",
    );
    origin!.children![0]!.props = {
      ...origin!.children![0]!.props,
      style: { fontWeight: 700 },
    };

    const repaired = ensureGridListTemplateOrigins(edited);
    const repairedOrigin = findById(
      repaired.children,
      GRIDLIST_ITEM_DEFAULT_ORIGIN_ID,
    );
    const composition = resolveSlotComposition(repairedOrigin?.children);
    expect(composition?.order).toEqual(["label"]);
    expect(composition?.slots.label?.style).toMatchObject({ fontWeight: 700 });
  });
});

// ADR-161 Phase 1/5 — 컨테이너 재사용 origin bootstrap (ListBox-parity, 타입 미변환).
//   기존 프로젝트(컨테이너 origin 없음)는 hydration 의 ensureGridListTemplateOrigins 로
//   component-gridlist 를 자동 획득한다 — standalone→ref 타입 변환 없이 origin bootstrap 만
//   (사용자 확정 2026-07-23, ListBox migrateLegacyListBoxTemplatesToOrigins 선례 동형).
describe("ADR-161 GridList 컨테이너 origin bootstrap", () => {
  it("legacy 문서(컨테이너 origin 부재)에 component-gridlist 를 slot → item origin 으로 추가한다", () => {
    const doc = ensureGridListTemplateOrigins(makeDocument());

    const container = findById(doc.children, GRIDLIST_ORIGIN_ID);
    expect(container).toMatchObject({
      type: "GridList",
      reusable: true,
      slot: [GRIDLIST_ITEM_DEFAULT_ORIGIN_ID],
      metadata: expect.objectContaining({
        systemOwned: true,
        componentFamily: "GridList",
      }),
    });
    // 컨테이너 origin 은 item origin 과 함께 Components body 에 등록 (양쪽 존재).
    expect(
      findById(doc.children, GRIDLIST_ITEM_DEFAULT_ORIGIN_ID),
    ).toBeDefined();
  });

  it("컨테이너 origin bootstrap 은 멱등 + 사용자 slot/props 편집 보존 (repair)", () => {
    const once = ensureGridListTemplateOrigins(makeDocument());
    const twice = ensureGridListTemplateOrigins(once);
    expect(twice).toEqual(once);

    // 사용자가 컨테이너 origin 의 props(layout) 를 편집하면 repair 로 되돌려지지 않는다.
    const edited = JSON.parse(JSON.stringify(once)) as CompositionDocument;
    const container = findById(edited.children, GRIDLIST_ORIGIN_ID);
    container!.props = { ...container!.props, layout: "grid", columns: 3 };

    const repaired = ensureGridListTemplateOrigins(edited);
    const repairedContainer = findById(repaired.children, GRIDLIST_ORIGIN_ID);
    expect(repairedContainer?.props).toMatchObject({
      layout: "grid",
      columns: 3,
    });
    // slot 참조는 코드 정본 유지 (metadata systemOwned repair).
    expect(repairedContainer?.slot).toEqual([GRIDLIST_ITEM_DEFAULT_ORIGIN_ID]);
  });
});
