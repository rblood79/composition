import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  getCatalogCutoverTypes,
  isDisclosureExpandedInContext,
  type CanonicalNode,
  type CompositionDocument,
  type ResolvedNode,
} from "@composition/shared";

import { createInitialProjectDocument } from "../../../dashboard/createInitialProjectDocument";
import { buildCanonicalSceneModel } from "../../workspace/canvas/scene/canonicalSceneModel";
import { resolveRadioGroupSelection } from "../../workspace/canvas/skia/buildSpecNodeData";
import { resolveCanonicalDocument } from "../../../resolvers/canonical";
import { CanonicalNodeRenderer } from "../../../preview/components/CanonicalNodeRenderer";
import type { RenderContext } from "../../../preview/types/index";
import type { CanvasSceneNode } from "../../workspace/canvas/scene/canvasSceneNode";
import { isSlotHostElement } from "../slotHostPolicy";
import { isStateVariantState } from "../stateVariantOrigins";

/**
 * ADR-237 Phase 0 — 진단 RED (breakdown §4 Phase 0 (a)~(h)).
 * `it` = G0 실측 기준선 (바꾸지 않는 계약 · 이미 GREEN). `it.fails` = 현재 결함 — 닫는 Phase 가 `it` 으로 바꾼다:
 *   (a) (b) (d) (h) → Phase 1 · (e) (f) → Phase 2 · (g) → Phase 3. Phase 1 로 (a) (d) · Phase 2 로 (e) (f) · Phase 3 로 (g) GREEN — (b) (h) 는 삽입
 *   경로 (`groupItemInsert`) 가 닫고 `adr237Phase1.groupSlot.test.ts` 가 고정한다 (이 파일의 (b) (h) 는 정규화 없는
 *   입력의 결함 모양 기록으로 남긴다).
 */

afterEach(cleanup);

function seedDocument(): CompositionDocument {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  return createInitialProjectDocument(
    { id: "page-1", title: "P", slug: "/" },
    { id: "body-1", type: "body" },
  ) as CompositionDocument;
}

function find(
  nodes: readonly CanonicalNode[],
  id: string,
): CanonicalNode | undefined {
  for (const node of nodes) {
    if (node.id === id) return node;
    const hit = find(node.children ?? [], id);
    if (hit) return hit;
  }
  return undefined;
}

function page(children: CanonicalNode[]): CompositionDocument {
  return {
    version: "composition-1.0",
    children: [
      {
        id: "page-1",
        type: "frame",
        metadata: { type: "legacy-page", pageId: "page-1" },
        children: [
          { id: "body-1", type: "Body", props: {}, children } as CanonicalNode,
        ],
      } as CanonicalNode,
    ],
  } as CompositionDocument;
}

function findResolved(
  nodes: readonly ResolvedNode[],
  id: string,
): ResolvedNode | undefined {
  for (const node of nodes) {
    if (node.id === id) return node;
    const hit = findResolved((node.children ?? []) as ResolvedNode[], id);
    if (hit) return hit;
  }
  return undefined;
}

function renderResolved(node: ResolvedNode) {
  return render(
    <CanonicalNodeRenderer
      node={node}
      cutoverPrimitives={getCatalogCutoverTypes()}
      renderContext={
        {
          childrenByParent: new Map(),
          renderElement: () => null,
          updateElementProps: () => {},
        } as unknown as RenderContext
      }
    />,
  );
}

const GROUP_ORIGINS = [
  "component-checkboxgroup",
  "component-radiogroup",
  "component-togglebuttongroup",
  "component-disclosuregroup",
  "component-buttongroup",
  "component-pagination",
  "component-avatargroup",
  "component-nav",
  "component-toolbar",
];

// ── (a) 그룹 컨테이너 slot ───────────────────────────────────────────────────
describe("ADR-237 진단 (a) — 그룹 컨테이너는 slot host 가 아니다 (F1 · F2)", () => {
  it("그룹 origin 9 의 자식은 origin ref · slot = 추천 목록 (Phase 1 seed)", () => {
    const doc = seedDocument();
    for (const id of GROUP_ORIGINS) {
      const origin = find(doc.children, id);
      expect(origin, id).toBeDefined();
      expect(Array.isArray((origin as { slot?: unknown }).slot), id).toBe(true);
      expect(
        (origin!.children ?? []).some((child) => child.type === "ref"),
        id,
      ).toBe(true);
    }
  });

  it('그룹 origin 은 slot host 다 (Slot "+" 가 보인다)', () => {
    const doc = seedDocument();
    for (const id of GROUP_ORIGINS) {
      const origin = find(doc.children, id)!;
      expect(isSlotHostElement(origin as never), id).toBe(true);
    }
  });
});

// ── (b) · (h) Radio key · 단일 선택 ──────────────────────────────────────────
function radioGroupDoc(
  groupValue: string,
  radios: Array<{ id: string; value: string; isSelected?: boolean }>,
): CompositionDocument {
  return page([
    {
      id: "rg",
      type: "RadioGroup",
      props: { label: "G", value: groupValue },
      children: radios.map(
        (radio) =>
          ({
            id: radio.id,
            type: "Radio",
            props: {
              children: radio.id,
              value: radio.value,
              ...(radio.isSelected !== undefined
                ? { isSelected: radio.isSelected }
                : {}),
            },
          }) as CanonicalNode,
      ),
    } as CanonicalNode,
  ]);
}

/** Canvas 표시 reader (F14 — `buildSpecNodeData` 의 Radio 선택 판정). */
function canvasSelectedRadios(doc: CompositionDocument): string[] {
  const model = buildCanonicalSceneModel(doc);
  const map = model.sceneNodesMap as unknown as Map<string, CanvasSceneNode>;
  return (model.sceneChildrenByParent.get("rg") ?? [])
    .filter((node) => node.type === "Radio")
    .filter(
      (node) =>
        resolveRadioGroupSelection(
          node as unknown as CanvasSceneNode,
          map,
          (node.props as Record<string, unknown>)?.isSelected,
        ) === true,
    )
    .map((node) => node.id);
}

/** Preview 표시 reader (F14 — RAC RadioGroup `defaultValue`). */
function previewSelectedRadios(doc: CompositionDocument): string[] {
  const resolved = findResolved(
    resolveCanonicalDocument(doc) as ResolvedNode[],
    "rg",
  )!;
  const { container } = renderResolved(resolved);
  return Array.from(
    container.querySelectorAll(".react-aria-Radio[data-selected]"),
  ).map((el) => el.getAttribute("data-element-id") ?? "?");
}

describe("ADR-237 진단 (b) — Slot 으로 넣은 Radio 의 key (F11)", () => {
  it.fails(
    "Frame 식 삽입 (origin ref · props {}) 두 번 → Radio value 가 유일하다",
    () => {
      const doc = seedDocument();
      const radioOrigin = find(doc.children, "component-radio")!;
      const originValue = (radioOrigin.props as Record<string, unknown>).value;
      // 현행 Frame 식 삽입 = `{type:"ref", ref, props:{}}` — value 는 origin 값 그대로 상속.
      const inserted = [{ value: originValue }, { value: originValue }].map(
        (props) => props.value,
      );
      expect(new Set(inserted).size).toBe(inserted.length);
    },
  );
});

describe("ADR-237 진단 (h) — 선택된 Radio A + 선택 후보 B 삽입 (F14 · round 2 h3)", () => {
  it("기준선: 정규화된 모양 (그룹 value = B · A 해제) 은 두 leg 가 같은 B", () => {
    const doc = radioGroupDoc("b", [
      { id: "ra", value: "a", isSelected: false },
      { id: "rb", value: "b", isSelected: true },
    ]);
    expect(canvasSelectedRadios(doc)).toEqual(["rb"]);
    expect(previewSelectedRadios(doc)).toEqual(["rb"]);
  });

  it.fails(
    "정규화 없는 삽입 (그룹 value 비어 있음 · A · B 둘 다 isSelected) → 두 leg 가 같은 항목",
    () => {
      const doc = radioGroupDoc("", [
        { id: "ra", value: "a", isSelected: true },
        { id: "rb", value: "b", isSelected: true },
      ]);
      // Canvas = [ra, rb] (자기 isSelected) · Preview = [ra] (첫 isSelected 자식).
      expect(canvasSelectedRadios(doc)).toEqual(previewSelectedRadios(doc));
    },
  );
});

// ── (c) 선택 계약 기준선 (바꾸지 않는 것) ────────────────────────────────────
describe("ADR-237 진단 (c) — Checkbox 그룹 선택 = 자식 isSelected (F6 · F11, GREEN 기준선)", () => {
  it("Preview: 자식 isSelected 인 Checkbox 만 선택 · 그룹 value 만 있는 문서는 비선택", () => {
    const doc = page([
      {
        id: "cg",
        type: "CheckboxGroup",
        props: { label: "G", value: ["c2"] },
        children: [
          {
            id: "c1",
            type: "Checkbox",
            props: { children: "1", isSelected: true },
          },
          { id: "c2", type: "Checkbox", props: { children: "2" } },
        ],
      } as CanonicalNode,
    ]);
    const resolved = findResolved(
      resolveCanonicalDocument(doc) as ResolvedNode[],
      "cg",
    )!;
    const { container } = renderResolved(resolved);
    const selected = Array.from(
      container.querySelectorAll(".react-aria-Checkbox[data-selected]"),
    ).map((el) => el.getAttribute("data-element-id"));
    expect(selected).toEqual(["c1"]);
  });
});

// ── (d) IconButton 변형 ──────────────────────────────────────────────────────
describe("ADR-237 진단 (d) — IconButton origin 변형 (F4)", () => {
  it("IconButton origin 에 상태 변형이 있다", () => {
    const doc = seedDocument();
    expect(find(doc.children, "component-iconbutton--hover")).toBeDefined();
  });
});

// ── (e) 항목 상호작용 변형 ───────────────────────────────────────────────────
describe("ADR-237 진단 (e) — 항목 템플릿 5종 상호작용 변형 (F5)", () => {
  it("Tab · Tag · ListBoxItem · GridListItem · MenuItem 에 hover 변형이 있다", () => {
    const doc = seedDocument();
    for (const origin of [
      "component-tab-item-default",
      "component-tag-item-default",
      "component-listbox-item-default",
      "component-gridlist-item-default",
      "component-menu-item-default",
    ]) {
      expect(find(doc.children, origin), origin).toBeDefined();
      expect(find(doc.children, `${origin}--hover`), origin).toBeDefined();
    }
  });

  it("GridListItem origin = 선택 상태 + `--unselected`", () => {
    const doc = seedDocument();
    expect(
      find(doc.children, "component-gridlist-item-default--unselected"),
    ).toBeDefined();
  });
});

// ── (f) Disclosure 펼침 ──────────────────────────────────────────────────────
describe("ADR-237 진단 (f) — Disclosure expanded (F7 · F12 · F13)", () => {
  it("상태 어휘에 collapsed (Disclosure 접힘 변형) 가 있다", () => {
    expect(isStateVariantState("collapsed")).toBe(true);
  });

  it("기준선 F12: `enabled:false` 로 숨긴 ref 자식은 `isExpanded:true` 여도 돌아오지 않는다 (두 leg)", () => {
    const doc = page([
      {
        id: "disc-origin",
        type: "Disclosure",
        reusable: true,
        props: {},
        children: [
          {
            id: "disc-origin__h",
            type: "DisclosureHeader",
            props: { children: "H" },
          },
          {
            id: "disc-origin__c",
            type: "DisclosureContent",
            props: { children: "C" },
          },
        ],
      } as CanonicalNode,
      {
        id: "disc",
        type: "ref",
        ref: "disc-origin",
        props: { isExpanded: true },
        descendants: { "disc-origin__c": { enabled: false } },
      } as unknown as CanonicalNode,
    ]);
    const resolved = findResolved(
      resolveCanonicalDocument(doc) as ResolvedNode[],
      "disc",
    )!;
    expect((resolved.children ?? []).map((c) => c.type)).toEqual([
      "DisclosureHeader",
    ]);
    const model = buildCanonicalSceneModel(doc);
    expect(
      (model.sceneChildrenByParent.get("disc") ?? []).map((c) => c.type),
    ).toEqual(["DisclosureHeader"]);
  });

  it("기준선 F13: 단일 펼침 그룹의 둘째 Disclosure 는 raw isExpanded:true 여도 접힘", () => {
    const group = {
      id: "g",
      type: "DisclosureGroup",
      props: { allowsMultipleExpanded: false },
    };
    const d1 = { id: "d1", type: "Disclosure", props: { isExpanded: true } };
    const d2 = { id: "d2", type: "Disclosure", props: { isExpanded: true } };
    expect(isDisclosureExpandedInContext(d1, group, [d1, d2])).toBe(true);
    expect(isDisclosureExpandedInContext(d2, group, [d1, d2])).toBe(false);
  });
});

// ── (g) Breadcrumbs 정적 자식 ────────────────────────────────────────────────
function breadcrumbChildrenDoc(): CompositionDocument {
  return page([
    {
      id: "bc",
      type: "Breadcrumbs",
      props: { "aria-label": "B" },
      children: [
        {
          id: "b1",
          type: "Breadcrumb",
          props: { children: "Home", href: "/" },
        },
        { id: "b2", type: "Breadcrumb", props: { children: "Page" } },
      ],
    } as CanonicalNode,
  ]);
}

describe("ADR-237 진단 (g) — Breadcrumbs 정적 자식 (F8)", () => {
  it("기준선: Preview 는 items 가 비면 Breadcrumb 자식을 그린다 (BC 폴백)", () => {
    const resolved = findResolved(
      resolveCanonicalDocument(breadcrumbChildrenDoc()) as ResolvedNode[],
      "bc",
    )!;
    expect((resolved.children ?? []).map((c) => c.type)).toEqual([
      "Breadcrumb",
      "Breadcrumb",
    ]);
  });

  it("기준선 (F8 정정): Canvas 도 items 가 없으면 정적 Breadcrumb 자식을 scene 자식으로 세운다 (마지막 = current 는 paint 시점 `resolveBreadcrumbItemContext`)", () => {
    const model = buildCanonicalSceneModel(breadcrumbChildrenDoc());
    expect(
      (model.sceneChildrenByParent.get("bc") ?? []).map((c) => c.id),
    ).toEqual(["b1", "b2"]);
  });

  it("seed Breadcrumbs origin = 항목 origin 의 instance 자식 + slot (items 아님)", () => {
    const doc = seedDocument();
    const origin = find(doc.children, "component-breadcrumbs")!;
    expect((origin.props as Record<string, unknown>).items).toBeUndefined();
    expect(Array.isArray((origin as { slot?: unknown }).slot)).toBe(true);
    expect(
      find(doc.children, "component-breadcrumb-item-default"),
    ).toBeDefined();
  });
});
