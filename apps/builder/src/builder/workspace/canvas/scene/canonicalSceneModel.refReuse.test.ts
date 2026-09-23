import { afterEach, describe, expect, it, vi } from "vitest";
import type { CanonicalNode, CompositionDocument } from "@composition/shared";

import { ensureReusableCompositeOrigins } from "../../../components/reusableCompositeOrigins";
import { ensureMenuTemplateOrigins } from "../../../components/menu/menuTemplateOrigins";
import {
  buildCanonicalSceneModel,
  resetSceneRefResolutionReuse,
  type CanonicalSceneModel,
} from "./canonicalSceneModel";

/**
 * ADR-234 G4 해석 증분화 — 직전 scene build 의 ref instance 해석 결과를 **같은 문서 · 같은 해석 입력 옵션**
 * 일 때 재사용한다 (breakpoint · collection window 전환). 재사용 결과는 새로 해석한 결과와 같아야 하고, 문서가
 * 바뀌면 (origin · 변형 · owner 선택 편집) 재사용하지 않는다.
 */

afterEach(() => {
  resetSceneRefResolutionReuse();
  vi.restoreAllMocks();
});

const rows = ["a", "b", "c"].map((id) => ({ id, title: id.toUpperCase() }));

function seededDoc(): CompositionDocument {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  const user = [
    {
      id: "tabs-plain",
      type: "Tabs",
      props: { items: rows, selectedKey: "b" },
      children: [
        { id: "tabs-plain-list", type: "TabList", props: {} },
        {
          id: "tabs-plain-panels",
          type: "TabPanels",
          props: {},
          children: rows.map((r) => ({
            id: `tp-${r.id}`,
            type: "TabPanel",
            props: { itemId: r.id },
          })),
        },
      ],
    },
    {
      id: "tabs-inst",
      type: "ref",
      ref: "component-tabs",
      props: { items: rows, defaultSelectedKey: "c" },
    },
    {
      id: "tag-plain",
      type: "TagGroup",
      props: { items: rows, selectedKeys: ["a"] },
      children: [{ id: "tag-plain-list", type: "TagList", props: {} }],
    },
    {
      id: "lb-inst",
      type: "ref",
      ref: "component-listbox",
      props: {},
      children: [
        {
          id: "lb-own",
          type: "ref",
          ref: "component-listbox-item-default",
          props: { id: "own" },
          descendants: { Label: { children: "Own" } },
        },
      ],
    },
    {
      id: "lb-bound",
      type: "ref",
      ref: "component-listbox",
      props: { dataBinding: { source: "dataTable", collectionId: "x" } },
    },
    { id: "form-inst", type: "ref", ref: "component-form", props: {} },
  ] as unknown as CanonicalNode[];
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

function stable(value: unknown, depth = 0): unknown {
  if (depth > 30) return "<deep>";
  if (Array.isArray(value)) return value.map((v) => stable(v, depth + 1));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value).sort()) {
      const v = (value as Record<string, unknown>)[key];
      if (v === undefined) continue;
      out[key] =
        key === "sourceNode"
          ? ((v as { id?: unknown })?.id ?? null)
          : stable(v, depth + 1);
    }
    return out;
  }
  return value;
}

function shape(model: CanonicalSceneModel) {
  return {
    nodes: model.sceneNodes.map((n) => stable(n)),
    children: [...model.sceneChildrenByParent.keys()]
      .sort()
      .map((k) => [k, model.sceneChildrenByParent.get(k)!.map((c) => c.id)]),
  };
}

function fresh(
  doc: CompositionDocument,
  options: Parameters<typeof buildCanonicalSceneModel>[1],
) {
  resetSceneRefResolutionReuse();
  const model = buildCanonicalSceneModel(doc, options);
  resetSceneRefResolutionReuse();
  return model;
}

/** 문서 안 노드 하나를 불변으로 바꾼다 (경로 복사 — canonical store 와 같은 방식). */
function editNode(
  doc: CompositionDocument,
  id: string,
  edit: (node: CanonicalNode) => CanonicalNode,
): CompositionDocument {
  const visit = (nodes: readonly CanonicalNode[]): CanonicalNode[] =>
    nodes.map((node) => {
      if (node.id === id) return edit(node);
      return node.children ? { ...node, children: visit(node.children) } : node;
    });
  return { ...doc, children: visit(doc.children) };
}

describe("ADR-234 G4 — scene build 의 ref 해석 재사용", () => {
  it("같은 문서 · breakpoint 전환: 재사용 결과 = 새 해석 결과 · resolved 노드 객체를 재사용한다", () => {
    const doc = seededDoc();
    const first = buildCanonicalSceneModel(doc, {
      activeBreakpoint: "desktop",
    });
    const second = buildCanonicalSceneModel(doc, {
      activeBreakpoint: "tablet",
    });
    expect(shape(second)).toEqual(
      shape(fresh(doc, { activeBreakpoint: "tablet" })),
    );
    // 정적 목록 항목 (Tab instance) · instance 의 synthetic 자식이 같은 객체 — 해석을 건너뛰었다.
    const tabItem = first.sceneChildrenByParent.get("tabs-plain-list")![0]!;
    expect(second.sceneNodesMap.get(tabItem.id)).toBe(tabItem);
    const synthetic = first.sceneNodes.find((n) =>
      n.id.startsWith("form-inst/"),
    )!;
    expect(second.sceneNodesMap.get(synthetic.id)).toBe(synthetic);
  });

  it("instance 자기 자식 (ListBox instance 의 항목) 순서 · 바인딩 목록 결과도 같다", () => {
    const doc = seededDoc();
    buildCanonicalSceneModel(doc, {});
    const again = buildCanonicalSceneModel(doc, {});
    const expected = fresh(doc, {});
    expect(shape(again)).toEqual(shape(expected));
    expect(
      again.sceneChildrenByParent.get("lb-inst")!.map((c) => c.id),
    ).toEqual(expected.sceneChildrenByParent.get("lb-inst")!.map((c) => c.id));
  });

  it.each([
    [
      "항목 origin 편집",
      "component-tab-item-default",
      (n: CanonicalNode) => ({
        ...n,
        props: {
          ...n.props,
          style: { ...(n.props?.style as object), paddingLeft: 40 },
        },
      }),
    ],
    [
      "휴지 변형 편집",
      "component-tab-item-default--unselected",
      (n: CanonicalNode) => ({
        ...n,
        props: { ...n.props, style: { paddingRight: 33 } },
      }),
    ],
    [
      "owner 선택 편집",
      "tabs-plain",
      (n: CanonicalNode) => ({ ...n, props: { ...n.props, selectedKey: "c" } }),
    ],
  ])(
    "문서가 바뀌면 (%s) 재사용하지 않고 새 해석과 같다",
    (_label, id, edit) => {
      const doc = seededDoc();
      buildCanonicalSceneModel(doc, {});
      const edited = editNode(doc, id, edit);
      const after = buildCanonicalSceneModel(edited, {});
      expect(shape(after)).toEqual(shape(fresh(edited, {})));
    },
  );

  it("해석 입력 옵션 (collections) 이 바뀌면 재사용하지 않는다", () => {
    const doc = seededDoc();
    const first = buildCanonicalSceneModel(doc, { collections: [] });
    const second = buildCanonicalSceneModel(doc, { collections: [] });
    const tabItem = first.sceneChildrenByParent.get("tabs-plain-list")![0]!;
    expect(second.sceneNodesMap.get(tabItem.id)).not.toBe(tabItem);
  });
});
