// @vitest-environment node
/**
 * ADR-150 Phase 2 · G2 — 데이터 행 hit → 템플릿 origin 의 대응 노드 해석 (breakdown §4-1 · §2-4 규칙).
 */
import { describe, expect, it } from "vitest";
import type { CanonicalNode, CompositionDocument } from "@composition/shared";
import { buildCanonicalSceneModel } from "../../scene/canonicalSceneModel";
import { flattenCanonicalDocumentNodes } from "../../scene/canonicalSceneModel";
import { resolveCanvasInteractionTarget } from "../resolveCanvasInteractionTarget";
import {
  resolveDataRowOriginTarget,
  type CanvasSourceHit,
} from "../resolveDataRowOriginTarget";
import { ensureListBoxTemplateOrigins } from "../../../../components/listbox/listBoxTemplateOrigins";

function documentOf(children: unknown[]): CompositionDocument {
  return {
    version: "composition-1.0",
    children: [
      {
        id: "page-1",
        type: "frame",
        metadata: { type: "legacy-page", pageId: "page-1" },
        children,
      },
    ],
  } as CompositionDocument;
}

const byIdOf = (doc: CompositionDocument) =>
  new Map<string, CanonicalNode>(
    flattenCanonicalDocumentNodes(doc).map((n) => [n.id, n]),
  );

/** 펼친 카드 — origin 에 역할 없는 자식이 있어 행 안에 자식 scene 노드가 생긴다 (ADR-162). */
function expandedDoc(originChildren: unknown[]): CompositionDocument {
  return documentOf([
    {
      id: "card-origin",
      type: "GridListItem",
      reusable: true,
      props: {},
      children: originChildren,
    },
    {
      id: "grid",
      type: "GridList",
      slot: ["card-origin"],
      props: {
        items: [
          { id: "a", label: "A", description: "A detail" },
          { id: "b", label: "B", description: "B detail" },
        ],
      },
      children: [{ id: "anchor", type: "ref", ref: "card-origin", props: {} }],
    },
  ]);
}

function sourceHitOf(
  doc: CompositionDocument,
  predicate: (node: { id: string; type: string }) => boolean,
) {
  const model = buildCanonicalSceneModel(doc);
  const hit = model.sceneNodes.find(
    (n) => n.projection?.kind === "gridlist-row" && predicate(n),
  );
  if (!hit) throw new Error("hit 노드 없음");
  const target = resolveCanvasInteractionTarget({
    candidateIds: [hit.id],
    elementsMap: model.sceneNodesMap,
    childrenMap: model.sceneChildrenByParent,
  });
  if (target.kind !== "select" || !target.sourceHit) {
    throw new Error("sourceHit 없음");
  }
  return { hit, sourceHit: target.sourceHit };
}

describe("resolveDataRowOriginTarget", () => {
  const TEXTS = [
    { id: "heading", type: "Text", props: { children: "{label}" } },
    { id: "detail", type: "Text", props: { children: "{description}" } },
  ];

  it("펼친 카드의 서로 다른 Text 자식 → 각자 다른 origin 자식 (round 3 h1)", () => {
    const doc = expandedDoc(TEXTS);
    const byId = byIdOf(doc);
    for (const child of ["heading", "detail"]) {
      for (const card of ["a", "b"]) {
        const { hit, sourceHit } = sourceHitOf(
          doc,
          (n) =>
            n.type === "Text" &&
            n.id.includes(`:${card}/`) &&
            n.id.endsWith(child),
        );
        expect(resolveDataRowOriginTarget(sourceHit, byId)).toEqual({
          targetId: child,
          originId: "card-origin",
        });
        // 교차 확인: 중첩이 아닐 때 path 결과 = 가상 자식의 sourceNode.id.
        expect((hit.sourceNode as { id?: string } | undefined)?.id).toBe(child);
      }
    }
  });

  it("카드 자체 (행 노드) → origin 루트", () => {
    const doc = expandedDoc(TEXTS);
    const { sourceHit } = sourceHitOf(
      doc,
      (n) => n.id === "projection:gridlist-row:grid:a",
    );
    expect(resolveDataRowOriginTarget(sourceHit, byIdOf(doc))).toEqual({
      targetId: "card-origin",
      originId: "card-origin",
    });
  });

  it("행 origin 이 상태 변형 (기본 origin 의 reusable ref) 이면 기본 origin 자식으로 간다 (live 2026-09-27)", () => {
    const doc = documentOf([
      {
        id: "card-origin",
        type: "GridListItem",
        reusable: true,
        props: {},
        children: [{ id: "label", type: "Text", name: "Label", props: {} }],
      },
      {
        id: "card-origin--unselected",
        type: "ref",
        ref: "card-origin",
        reusable: true,
        props: {},
      },
    ]);
    const sourceHit: CanvasSourceHit = {
      nodeId: "projection:gridlist-row:grid:a/Label",
      projection: {
        kind: "gridlist-row",
        listBoxId: "grid",
        itemKey: "a",
        templateOriginId: "card-origin--unselected",
      },
    };
    expect(resolveDataRowOriginTarget(sourceHit, byIdOf(doc))).toEqual({
      targetId: "label",
      originId: "card-origin",
    });
  });

  it("구간 이름은 legacy metadata customId 를 읽는다 (합성 자식 id 규칙과 같음)", () => {
    const doc = expandedDoc([
      {
        id: "t-1",
        type: "Text",
        props: { children: "{label}" },
        metadata: { type: "legacy-element-props", customId: "title" },
      },
    ]);
    const sourceHit: CanvasSourceHit = {
      nodeId: "projection:gridlist-row:grid:a/title",
      projection: {
        kind: "gridlist-row",
        listBoxId: "grid",
        itemKey: "a",
        templateOriginId: "card-origin",
      },
    };
    expect(resolveDataRowOriginTarget(sourceHit, byIdOf(doc))?.targetId).toBe(
      "t-1",
    );
  });

  it("origin 안 중첩 ref 를 만나면 `<ref>/<나머지 path>` (synthetic 자식 — master 로 들어가지 않음)", () => {
    const doc = documentOf([
      {
        id: "badge",
        type: "frame",
        reusable: true,
        props: {},
        children: [{ id: "badge-label", type: "Text", props: {} }],
      },
      {
        id: "card-origin",
        type: "GridListItem",
        reusable: true,
        props: {},
        children: [{ id: "inner", type: "ref", ref: "badge", props: {} }],
      },
    ]);
    const sourceHit: CanvasSourceHit = {
      nodeId: "projection:gridlist-row:grid:a/inner/badge-label",
      projection: {
        kind: "gridlist-row",
        listBoxId: "grid",
        itemKey: "a",
        templateOriginId: "card-origin",
      },
    };
    expect(resolveDataRowOriginTarget(sourceHit, byIdOf(doc))?.targetId).toBe(
      "inner/badge-label",
    );
  });

  it("ListBox 행 → 문서에 있는 항목 origin 루트", () => {
    const doc = ensureListBoxTemplateOrigins(
      documentOf([
        {
          id: "list",
          type: "ListBox",
          props: { items: [{ id: "k0", label: "Item 0" }] },
          children: [],
        },
      ]),
    );
    const model = buildCanonicalSceneModel(doc);
    const row = model.sceneNodes.find(
      (n) => n.projection?.kind === "listbox-row",
    )!;
    const target = resolveCanvasInteractionTarget({
      candidateIds: [row.id],
      elementsMap: model.sceneNodesMap,
      childrenMap: model.sceneChildrenByParent,
    });
    const sourceHit = target.kind === "select" ? target.sourceHit : undefined;
    const originId = sourceHit?.projection.templateOriginId;
    expect(originId).toBeTruthy();
    expect(resolveDataRowOriginTarget(sourceHit, byIdOf(doc))).toEqual({
      targetId: originId,
      originId,
    });
  });

  describe("해석 실패 → null (호출자는 owner 선택 유지, G2 e)", () => {
    const doc = expandedDoc(TEXTS);
    const byId = byIdOf(doc);
    const base = {
      kind: "gridlist-row",
      listBoxId: "grid",
      itemKey: "a",
      templateOriginId: "card-origin",
    };
    it.each([
      [
        "path 불일치",
        { nodeId: "projection:gridlist-row:grid:a/missing", projection: base },
      ],
      [
        "origin 이 문서에 없음",
        {
          nodeId: "projection:gridlist-row:grid:a",
          projection: { ...base, templateOriginId: "gone" },
        },
      ],
      [
        "templateOriginId 없음 (Table · Breadcrumbs)",
        {
          nodeId: "projection:table-row:t:r0",
          projection: {
            kind: "table-row",
            listBoxId: "t",
            itemKey: "r0",
            templateOriginId: null,
          },
        },
      ],
      [
        "다른 행의 hit (행 id 접두사 불일치)",
        { nodeId: "projection:gridlist-row:grid:b/heading", projection: base },
      ],
      [
        "rows 묶음 · spacer (행 kind 아님)",
        {
          nodeId: "projection:gridlist-rows:grid",
          projection: { ...base, kind: "gridlist-rows" },
        },
      ],
    ] as const)("%s", (_, sourceHit) => {
      expect(
        resolveDataRowOriginTarget(sourceHit as CanvasSourceHit, byId),
      ).toBeNull();
    });
    it("sourceHit 없음", () => {
      expect(resolveDataRowOriginTarget(undefined, byId)).toBeNull();
    });
  });
});
