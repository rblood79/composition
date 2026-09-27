import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import type {
  CanonicalNode,
  CompositionDocument,
  ResolvedNode,
} from "@composition/shared";

import { resolveCanonicalDocument } from "../../resolvers/canonical";
import { buildPreviewPresentationProjectionIndex } from "./editorPresentationProjectionIndex";

const nodes = [
  {
    id: "page-1",
    type: "frame",
    children: [
      {
        id: "origin-card",
        type: "Card",
        children: [
          {
            id: "origin-label-id",
            customId: "stable-label-key",
            type: "Text",
          },
        ],
      },
      ...["instance-a", "instance-b"].map((id) => ({
        id,
        type: "Card",
        _resolvedFrom: "origin-card",
        children: [
          {
            id: "origin-label-id",
            customId: "stable-label-key",
            // resolver 가 원본 형제 목록으로 센 segment (MEDIUM-3 — index 는 이 값만 읽는다).
            _pathSegment: "stable-label-key",
            type: "Text",
          },
        ],
      })),
    ],
  },
] as unknown as ResolvedNode[];

describe("ADR-187 Preview presentation projection index", () => {
  it("fans out canonical origin targets to actual traversal render keys", () => {
    const index = buildPreviewPresentationProjectionIndex(nodes);

    expect(
      index.resolve({ kind: "canonical-node", nodeId: "origin-card" }),
    ).toEqual(["page-1/origin-card", "page-1/instance-a", "page-1/instance-b"]);
    expect(
      index.resolve({ kind: "canonical-node", nodeId: "origin-label-id" }),
    ).toEqual([
      "page-1/origin-card/origin-label-id",
      "page-1/instance-a/origin-label-id",
      "page-1/instance-b/origin-label-id",
    ]);
  });

  it("resolves one ref descendant without leaking Preview render keys into protocol identity", () => {
    const index = buildPreviewPresentationProjectionIndex(nodes);

    expect(
      index.resolve({
        kind: "ref-descendant",
        refId: "instance-b",
        pathKey: "stable-label-key",
      }),
    ).toEqual(["page-1/instance-b/origin-label-id"]);
  });

  it("inherited color는 own color 없는 descendant만 atomic set으로 확장한다", () => {
    const roots = [
      {
        id: "button-1",
        type: "Button",
        props: { style: { color: "red" } },
        children: [
          { id: "label-1", type: "Text" },
          {
            id: "explicit-1",
            type: "Text",
            props: { style: { color: "blue" } },
          },
        ],
      },
    ] as unknown as ResolvedNode[];
    const index = buildPreviewPresentationProjectionIndex(roots);

    expect(
      index.resolve(
        { kind: "canonical-node", nodeId: "button-1" },
        "inherited-subtree",
      ),
    ).toEqual(["button-1", "button-1/label-1"]);
  });

  it.each([50, 500, 5000])(
    "N=%i canonical nodes에서도 paint lookup 결과는 affected render key k=1이다",
    (count) => {
      const roots = Array.from({ length: count }, (_, index) => ({
        id: `node-${index}`,
        type: "frame",
      })) as unknown as ResolvedNode[];
      const index = buildPreviewPresentationProjectionIndex(roots, 1);
      expect(
        index.resolve({ kind: "canonical-node", nodeId: `node-${count - 1}` }),
      ).toEqual([`node-${count - 1}`]);
    },
  );
});

/**
 * ADR-150 후속 MEDIUM-3 — 실제 resolver 출력으로 index 를 만들어 편집기 키 (Canvas synthetic id 의 경로 = 원본 형제
 * 목록 기준 segment) 로 찾는다. 종전 index 는 해석 노드로 segment 를 다시 세어, 이름 없는 항목 ref 가 master name
 * (`Item/Default`) 으로 · 걸러진 목록의 번호로 · 중첩 ref 에서 끊긴 경로로 등록됐다.
 */
describe("ADR-150 후속 MEDIUM-3 — Preview index 키 = 편집기 키", () => {
  const ITEM = { type: "legacy-element-props" };
  function makeDoc(
    descendants: Record<string, unknown> = {},
    instanceChildren: CanonicalNode[] = [],
  ): CompositionDocument {
    return {
      version: "composition-1.0",
      children: [
        {
          id: "page-c",
          type: "frame",
          metadata: { type: "legacy-page", pageId: "page-c" },
          children: [
            {
              id: "item-origin",
              type: "frame",
              reusable: true,
              name: "Item/Default",
              children: [{ id: "item-label", type: "Text", name: "Label" }],
            },
            {
              id: "grid-origin",
              type: "frame",
              reusable: true,
              name: "Grid",
              children: [
                { id: "grid__item-1", type: "ref", ref: "item-origin" },
                { id: "grid__item-2", type: "ref", ref: "item-origin" },
                { id: "dup-a", type: "Text", name: "Dup" },
                { id: "dup-b", type: "Text", name: "Dup" },
                {
                  id: "grid__text",
                  type: "Text",
                  metadata: { ...ITEM, customId: "text_1" },
                },
              ],
            },
          ],
        },
        {
          id: "page-h",
          type: "frame",
          metadata: { type: "legacy-page", pageId: "page-h" },
          children: [
            {
              id: "inst",
              type: "ref",
              ref: "grid-origin",
              descendants,
              ...(instanceChildren.length
                ? { children: instanceChildren }
                : {}),
            } as unknown as CanonicalNode,
          ],
        },
      ],
    } as unknown as CompositionDocument;
  }
  const lookup = (doc: CompositionDocument, pathKey: string) =>
    buildPreviewPresentationProjectionIndex(
      resolveCanonicalDocument(doc),
    ).resolve({ kind: "ref-descendant", refId: "inst", pathKey });

  it("이름 없는 항목 ref 는 master name 이 아니라 원본 id segment 로 찾는다", () => {
    const doc = makeDoc();
    expect(lookup(doc, "grid__item-1")).toEqual(["page-h/inst/grid__item-1"]);
    expect(lookup(doc, "grid__item-2")).toEqual(["page-h/inst/grid__item-2"]);
    expect(lookup(doc, "Item/Default")).toEqual([]);
  });

  it("legacy metadata customId 자식은 customId segment", () => {
    expect(lookup(makeDoc(), "text_1")).toEqual(["page-h/inst/grid__text"]);
  });

  it("중첩 ref 안 자식은 바깥 instance 기준 이어진 경로로 찾는다", () => {
    expect(lookup(makeDoc(), "grid__item-1/Label")).toEqual([
      "page-h/inst/grid__item-1/item-label",
    ]);
  });

  it("앞 형제가 꺼져도 같은 이름 두 번째 형제는 `Dup~2` 그대로", () => {
    const doc = makeDoc({ Dup: { enabled: false } });
    expect(lookup(doc, "Dup~2")).toEqual(["page-h/inst/dup-b"]);
    expect(lookup(doc, "Dup")).toEqual([]);
  });

  it("instance 자기 자식은 origin 자식과 따로 센다 (origin 번호를 밀지 않는다)", () => {
    const doc = makeDoc({}, [{ id: "own-dup", type: "Text", name: "Dup" }]);
    // 최상위 instance 의 자기 자식은 편집기에서 실제 노드 (canonical-node 대상) — instance 의 ref-descendant 로
    //   등록하지 않는다 (같은 segment origin 자식과 섞이면 한쪽 편집이 다른 쪽에도 칠해진다, 판독 1).
    expect(lookup(doc, "Dup")).toEqual(["page-h/inst/dup-a"]);
    expect(lookup(doc, "Dup~2")).toEqual(["page-h/inst/dup-b"]);
  });

  it("mode C 교체 목록은 Canvas 교체 규칙 (id 먼저) 으로 찾는다", () => {
    const doc = makeDoc({
      grid__text: {
        children: [{ id: "fill-1", type: "Text", name: "Fill" }],
      },
    });
    expect(lookup(doc, "text_1/fill-1")).toEqual([
      "page-h/inst/grid__text/fill-1",
    ]);
  });

  it("해석 결과의 ref 문맥 자식은 전부 `_pathSegment` 를 갖는다 (index 가 다시 세지 않는다)", () => {
    const missing: string[] = [];
    const walk = (nodes: readonly ResolvedNode[], inRef: boolean) => {
      for (const node of nodes) {
        if (inRef && node._pathSegment === undefined) missing.push(node.id);
        walk(node.children ?? [], inRef || Boolean(node._resolvedFrom));
      }
    };
    walk(
      resolveCanonicalDocument(
        makeDoc({ grid__text: { children: [{ id: "f", type: "Text" }] } }, [
          { id: "own", type: "Text" },
        ]),
      ),
      false,
    );
    expect(missing).toEqual([]);
  });

  it("index 모듈은 segment 를 계산하지 않는다 (규칙 함수 import 0 — resolver `_pathSegment` 만 읽는다)", () => {
    const source = readFileSync(
      resolve(__dirname, "editorPresentationProjectionIndex.ts"),
      "utf8",
    );
    expect(source).not.toMatch(/canonicalRefResolution|RefChildSegment/);
  });

  it("변형 (ref chain) instance 도 origin 원본 목록 기준 segment — 변형이 숨긴 형제 · metadata customId 중첩 ref", () => {
    const doc = {
      version: "composition-1.0",
      children: [
        {
          id: "page-c",
          type: "frame",
          metadata: { type: "legacy-page", pageId: "page-c" },
          children: [
            {
              id: "btn-origin",
              type: "frame",
              reusable: true,
              name: "Button",
              children: [{ id: "btn-label", type: "Text", name: "Label" }],
            },
            {
              id: "card-origin",
              type: "frame",
              reusable: true,
              name: "Card",
              children: [
                {
                  id: "card__btn",
                  type: "ref",
                  ref: "btn-origin",
                  metadata: { ...ITEM, customId: "button_7" },
                },
                { id: "dup-a", type: "Text", name: "Dup" },
                { id: "dup-b", type: "Text", name: "Dup" },
              ],
            },
            {
              id: "card-origin--hover",
              type: "ref",
              ref: "card-origin",
              reusable: true,
              descendants: { Dup: { enabled: false } },
            },
          ],
        },
        {
          id: "page-h",
          type: "frame",
          metadata: { type: "legacy-page", pageId: "page-h" },
          children: [{ id: "inst", type: "ref", ref: "card-origin--hover" }],
        },
      ],
    } as unknown as CompositionDocument;
    expect(lookup(doc, "button_7")).toEqual(["page-h/inst/card__btn"]);
    expect(lookup(doc, "button_7/Label")).toEqual([
      "page-h/inst/card__btn/btn-label",
    ]);
    expect(lookup(doc, "Dup~2")).toEqual(["page-h/inst/dup-b"]);
  });

  it("mode C 교체 목록 안 ref 의 자기 자식도 교체 규칙 (id 먼저)", () => {
    const doc = makeDoc({
      grid__text: {
        children: [
          {
            id: "fill-ref",
            type: "ref",
            ref: "item-origin",
            children: [
              {
                id: "cell-1",
                type: "Text",
                name: "Cell",
                metadata: { ...ITEM, customId: "cell_3" },
              },
            ],
          },
        ],
      },
    });
    expect(lookup(doc, "text_1/fill-ref/cell-1")).toEqual([
      "page-h/inst/grid__text/fill-ref/cell-1",
    ]);
  });

  it("origin 안 중첩 ref 의 자기 자식은 바깥 instance 기준 이어진 경로 (ADR-241 행 · 셀 모양)", () => {
    const doc = makeDoc();
    const grid = (doc.children[0]!.children ?? []).find(
      (n) => n.id === "grid-origin",
    )!.children as CanonicalNode[];
    grid.push({
      id: "grid__row",
      type: "ref",
      ref: "item-origin",
      children: [{ id: "row-cell", type: "Text", name: "Label" }],
    } as unknown as CanonicalNode);
    // 자기 자식은 origin 자식 (item-label "Label") 과 따로 센다 — Canvas 도 같은 synthetic 경로.
    expect(lookup(doc, "grid__row/Label")).toEqual([
      "page-h/inst/grid__row/item-label",
      "page-h/inst/grid__row/row-cell",
    ]);
  });

  it("변형 instance 의 patch 도 원본 목록 segment 키로 적용된다 (Preview 해석기)", () => {
    const doc = {
      version: "composition-1.0",
      children: [
        {
          id: "page-c",
          type: "frame",
          metadata: { type: "legacy-page", pageId: "page-c" },
          children: [
            {
              id: "card-origin",
              type: "frame",
              reusable: true,
              children: [
                {
                  id: "dup-a",
                  type: "Text",
                  name: "Dup",
                  props: { title: "A" },
                },
                {
                  id: "dup-b",
                  type: "Text",
                  name: "Dup",
                  props: { title: "B" },
                },
              ],
            },
            {
              id: "card-origin--hover",
              type: "ref",
              ref: "card-origin",
              reusable: true,
              descendants: { Dup: { enabled: false } },
            },
          ],
        },
        {
          id: "page-h",
          type: "frame",
          metadata: { type: "legacy-page", pageId: "page-h" },
          children: [
            {
              id: "inst",
              type: "ref",
              ref: "card-origin--hover",
              descendants: { "Dup~2": { title: "edited" } },
            },
          ],
        },
      ],
    } as unknown as CompositionDocument;
    const inst = resolveCanonicalDocument(doc)[1]!.children![0]!;
    expect(
      inst.children!.map((child) => [child.id, child.props?.title]),
    ).toEqual([["dup-b", "edited"]]);
  });
});
