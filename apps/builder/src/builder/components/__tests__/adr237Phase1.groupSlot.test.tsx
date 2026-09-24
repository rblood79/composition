import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  getCatalogCutoverTypes,
  type CanonicalNode,
  type CompositionDocument,
  type ResolvedNode,
} from "@composition/shared";

import { createInitialProjectDocument } from "../../../dashboard/createInitialProjectDocument";
import { buildCanonicalSceneModel } from "../../workspace/canvas/scene/canonicalSceneModel";
import { resolveRadioGroupSelection } from "../../workspace/canvas/skia/buildSpecNodeData";
import type { CanvasSceneNode } from "../../workspace/canvas/scene/canvasSceneNode";
import { resolveCanonicalDocument } from "../../../resolvers/canonical";
import { CanonicalNodeRenderer } from "../../../preview/components/CanonicalNodeRenderer";
import type { RenderContext } from "../../../preview/types/index";
import { ensureReusableCompositeOrigins } from "../reusableCompositeOrigins";
import {
  planGroupItemInsert,
  type GroupItemInsertPlan,
} from "../groupItemInsert";
import {
  isSlotCandidateAllowed,
  isSlotContractItem,
  isSlotHostElement,
  resolveSlotInsertAction,
} from "../slotHostPolicy";
import { migrateCardViewCardsToRefs } from "../originChildRefs";

/**
 * ADR-237 Phase 1 — G1 (breakdown §4 Phase 1): slot host 표 · 그룹 9종 slot · Slot "+" 항목의 선택 값 · Radio
 * `value` 유일 · 단일 선택 정규화 · IconButton 변형 · CardView ref 이관.
 */

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

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

function mapNodes(
  document: CompositionDocument,
  fn: (node: CanonicalNode) => CanonicalNode,
): CompositionDocument {
  const visit = (nodes: readonly CanonicalNode[]): CanonicalNode[] =>
    nodes.map((node) => {
      const next = fn(node);
      return next.children ? { ...next, children: visit(next.children) } : next;
    });
  return { ...document, children: visit(document.children) };
}

/** 계획을 문서에 적용 (store 쓰기와 같은 모양 — props merge · 자식 append · instance descendants 교체). */
function applyPlan(
  document: CompositionDocument,
  plan: GroupItemInsertPlan,
): CompositionDocument {
  const updates = new Map(plan.propsUpdates.map((u) => [u.id, u.props]));
  return mapNodes(document, (node) => {
    let next = node;
    const patch = updates.get(node.id);
    if (patch) next = { ...next, props: { ...(next.props ?? {}), ...patch } };
    if (node.id === plan.hostId) {
      next = {
        ...next,
        children: [...(next.children ?? []), plan.child],
        ...(plan.instanceDescendants
          ? { descendants: plan.instanceDescendants }
          : {}),
      } as CanonicalNode;
    }
    return next;
  });
}

function page(
  base: CompositionDocument,
  children: CanonicalNode[],
): CompositionDocument {
  return mapNodes(base, (node) =>
    node.id === "body-1" ? { ...node, children } : node,
  );
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

function renderResolved(document: CompositionDocument, id: string) {
  const node = findResolved(
    resolveCanonicalDocument(document) as ResolvedNode[],
    id,
  )!;
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

function previewSelected(
  document: CompositionDocument,
  hostId: string,
  selector: string,
): string[] {
  const { container } = renderResolved(document, hostId);
  const ids = Array.from(
    container.querySelectorAll(`${selector}[data-selected]`),
  ).map((el) => el.getAttribute("data-element-id") ?? "?");
  cleanup();
  return ids;
}

function canvasSelectedRadios(
  document: CompositionDocument,
  hostId: string,
): string[] {
  const model = buildCanonicalSceneModel(document);
  const map = model.sceneNodesMap as unknown as Map<string, CanvasSceneNode>;
  return (model.sceneChildrenByParent.get(hostId) ?? [])
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

const GROUPS: Array<[string, string]> = [
  ["component-checkboxgroup", "CheckboxGroup"],
  ["component-radiogroup", "RadioGroup"],
  ["component-togglebuttongroup", "ToggleButtonGroup"],
  ["component-disclosuregroup", "DisclosureGroup"],
  ["component-buttongroup", "ButtonGroup"],
  ["component-pagination", "Pagination"],
  ["component-avatargroup", "AvatarGroup"],
  ["component-nav", "Nav"],
  ["component-toolbar", "Toolbar"],
];

describe("ADR-237 G1 — 그룹 slot seed · repair", () => {
  it("그룹 origin 9 = slot host · 재hydration 같은 모양 (Δ0)", () => {
    const doc = seedDocument();
    for (const [id] of GROUPS) {
      const origin = find(doc.children, id)!;
      expect(isSlotHostElement(origin as never), id).toBe(true);
    }
    const again = ensureReusableCompositeOrigins(doc);
    expect(JSON.stringify(again)).toBe(JSON.stringify(doc));
  });

  it("기존 문서 repair: slot 이 없을 때만 싣는다 — 사용자 slot · 끈 slot (`false`) 은 그대로 (Toolbar repair 포함)", () => {
    const doc = seedDocument();
    const edited = mapNodes(doc, (node) => {
      if (node.id === "component-checkboxgroup") {
        const { slot: _slot, ...rest } = node as CanonicalNode & {
          slot?: unknown;
        };
        return rest as CanonicalNode;
      }
      if (node.id === "component-radiogroup")
        return { ...node, slot: false } as CanonicalNode;
      if (node.id === "component-toolbar") {
        return { ...node, slot: ["component-button"] } as CanonicalNode;
      }
      return node;
    });
    const repaired = ensureReusableCompositeOrigins(edited);
    const slotOf = (id: string) =>
      (find(repaired.children, id) as { slot?: unknown }).slot;
    expect(slotOf("component-checkboxgroup")).toEqual([
      "component-checkbox--unselected",
      "component-checkbox",
    ]);
    expect(slotOf("component-radiogroup")).toBe(false);
    expect(slotOf("component-toolbar")).toEqual(["component-button"]);
  });
});

describe("ADR-237 G1 — slot host 표 (그룹 행)", () => {
  const host = {
    id: "component-radiogroup",
    type: "RadioGroup",
    reusable: true,
    slot: ["component-radio--unselected", "component-radio"],
  };

  it("후보 = 가족 origin · 그 변형만 · 배치 요소 (Label · 끌어 넣은 instance) 는 drop 허용", () => {
    expect(
      isSlotCandidateAllowed(host, {
        id: "component-radio",
        type: "Radio",
        reusable: true,
      }),
    ).toBe(true);
    expect(
      isSlotCandidateAllowed(host, {
        id: "component-radio--unselected",
        type: "ref",
        ref: "component-radio",
        reusable: true,
      }),
    ).toBe(true);
    expect(
      isSlotCandidateAllowed(host, {
        id: "component-button",
        type: "Button",
        reusable: true,
      }),
    ).toBe(false);
    expect(isSlotCandidateAllowed(host, { id: "label-1", type: "Label" })).toBe(
      true,
    );
    expect(
      resolveSlotInsertAction(host, { id: "component-radio", type: "Radio" }),
    ).toEqual({
      kind: "group-item",
    });
  });

  it("slot 계약 경고 대상 = 항목 type 만 (Label 은 아님) · slot 없는 사용자 그룹은 종전 그대로", () => {
    expect(isSlotContractItem(host, { type: "Label" })).toBe(false);
    expect(isSlotContractItem(host, { type: "Radio" })).toBe(true);
    const plain = { id: "rg-1", type: "RadioGroup" };
    expect(isSlotHostElement(plain)).toBe(false);
    expect(
      isSlotCandidateAllowed(plain, {
        id: "component-button",
        type: "Button",
        reusable: true,
      }),
    ).toBe(true);
  });
});

describe('ADR-237 G1 — Slot "+" 항목의 선택 값 (Checkbox · ToggleButton = 자식 isSelected · key = node id)', () => {
  it("선택 모양 후보 → isSelected:true · 휴지 후보 → false — Canvas 상태 · Preview 초기 선택이 같은 항목", () => {
    const doc = seedDocument();
    const selectedPlan = planGroupItemInsert({
      document: doc,
      hostId: "component-checkboxgroup",
      candidateId: "component-checkbox",
      newId: "cb-new",
    })!;
    expect(selectedPlan.child).toMatchObject({
      type: "ref",
      ref: "component-checkbox",
      props: { isSelected: true },
    });
    expect(selectedPlan.propsUpdates).toEqual([]);
    const restPlan = planGroupItemInsert({
      document: doc,
      hostId: "component-checkboxgroup",
      candidateId: "component-checkbox--unselected",
      newId: "cb-rest",
    })!;
    expect(restPlan.child).toMatchObject({
      ref: "component-checkbox",
      props: { isSelected: false },
    });
    const after = applyPlan(applyPlan(doc, selectedPlan), restPlan);
    expect(
      previewSelected(after, "component-checkboxgroup", ".react-aria-Checkbox"),
    ).toEqual(["cb-new"]);
    const model = buildCanonicalSceneModel(after);
    expect(model.sceneNodesMap.get("cb-new")?.props?.isSelected).toBe(true);
    expect(model.sceneNodesMap.get("cb-rest")?.props?.isSelected).toBe(false);
  });

  it("단일 선택 ToggleButtonGroup — 선택 형제 해제만 (그룹 값은 쓰지 않는다)", () => {
    const doc = page(seedDocument(), [
      {
        id: "tbg",
        type: "ToggleButtonGroup",
        props: { selectionMode: "single" },
        children: [
          {
            id: "t1",
            type: "ref",
            ref: "component-togglebutton",
            props: { isSelected: true },
          },
          { id: "t2", type: "ref", ref: "component-togglebutton", props: {} },
        ] as unknown as CanonicalNode[],
      } as CanonicalNode,
    ]);
    // 사용자 문서 그룹은 slot 이 없어도 계획은 선다 (host 판정은 패널 몫).
    const plan = planGroupItemInsert({
      document: doc,
      hostId: "tbg",
      candidateId: "component-togglebutton",
      newId: "t3",
    })!;
    expect(plan.propsUpdates).toEqual([
      { id: "t1", props: { isSelected: false } },
    ]);
    const after = applyPlan(doc, plan);
    expect(previewSelected(after, "tbg", ".react-aria-ToggleButton")).toEqual([
      "t3",
    ]);
  });
});

describe("ADR-237 G1 — Radio: value 유일 · 단일 선택 정규화 (round 2 h3)", () => {
  function radioDoc(): CompositionDocument {
    return page(seedDocument(), [
      {
        id: "rg",
        type: "RadioGroup",
        props: { label: "G", value: "a" },
        children: [
          {
            id: "ra",
            type: "ref",
            ref: "component-radio",
            props: { value: "a", isSelected: true },
          },
          {
            id: "rb",
            type: "ref",
            ref: "component-radio",
            props: { value: "option2" },
          },
        ] as unknown as CanonicalNode[],
      } as CanonicalNode,
    ]);
  }

  it("휴지 후보 두 번 → value 유일 · 형제 · 그룹 값 무변경", () => {
    const doc = radioDoc();
    const first = planGroupItemInsert({
      document: doc,
      hostId: "rg",
      candidateId: "component-radio--unselected",
      newId: "rc",
    })!;
    const once = applyPlan(doc, first);
    const second = planGroupItemInsert({
      document: once,
      hostId: "rg",
      candidateId: "component-radio--unselected",
      newId: "rd",
    })!;
    const values = [
      "a",
      "option2",
      first.child.props?.value,
      second.child.props?.value,
    ];
    expect(new Set(values).size).toBe(4);
    expect(first.propsUpdates).toEqual([]);
    const after = applyPlan(once, second);
    expect(canvasSelectedRadios(after, "rg")).toEqual(["ra"]);
    expect(previewSelected(after, "rg", ".react-aria-Radio")).toEqual(["ra"]);
  });

  it("선택된 Radio A 가 있는 그룹에 선택 후보 B → Canvas (그룹 value 우선) · Preview (첫 isSelected) 모두 B · A 해제", () => {
    const doc = radioDoc();
    expect(canvasSelectedRadios(doc, "rg")).toEqual(["ra"]);
    const plan = planGroupItemInsert({
      document: doc,
      hostId: "rg",
      candidateId: "component-radio",
      newId: "rb2",
    })!;
    const newValue = plan.child.props?.value;
    expect(plan.child.props).toMatchObject({ isSelected: true });
    expect(plan.propsUpdates).toEqual([
      { id: "ra", props: { isSelected: false } },
      { id: "rg", props: { value: newValue } },
    ]);
    const after = applyPlan(doc, plan);
    expect(canvasSelectedRadios(after, "rg")).toEqual(["rb2"]);
    expect(previewSelected(after, "rg", ".react-aria-Radio")).toEqual(["rb2"]);
  });

  it("instance host: origin 에서 상속한 선택 형제는 instance descendants 로 해제 · 그룹 value 는 instance props", () => {
    const seeded = seedDocument();
    const withSelectedOriginChild = mapNodes(seeded, (node) =>
      node.id === "component-radiogroup__2"
        ? { ...node, props: { ...(node.props ?? {}), isSelected: true } }
        : node,
    );
    const doc = page(withSelectedOriginChild, [
      {
        id: "rg-inst",
        type: "ref",
        ref: "component-radiogroup",
        props: { value: "option1" },
      } as unknown as CanonicalNode,
    ]);
    const plan = planGroupItemInsert({
      document: doc,
      hostId: "rg-inst",
      candidateId: "component-radio",
      newId: "rg-inst-new",
    })!;
    expect(plan.child.props?.value).toBe("option3");
    expect(plan.instanceDescendants).toEqual({
      "component-radiogroup__2": { isSelected: false },
    });
    expect(plan.propsUpdates).toEqual([
      { id: "rg-inst", props: { value: "option3" } },
    ]);
    const after = applyPlan(doc, plan);
    expect(previewSelected(after, "rg-inst", ".react-aria-Radio")).toEqual([
      "rg-inst-new",
    ]);
    expect(canvasSelectedRadios(after, "rg-inst")).toEqual(["rg-inst-new"]);
  });

  it("가족 밖 후보 · 그룹 아닌 host 는 계획 없음", () => {
    const doc = radioDoc();
    expect(
      planGroupItemInsert({
        document: doc,
        hostId: "rg",
        candidateId: "component-button",
        newId: "x",
      }),
    ).toBeNull();
    expect(
      planGroupItemInsert({
        document: doc,
        hostId: "ra",
        candidateId: "component-radio",
        newId: "x",
      }),
    ).toBeNull();
  });
});

describe("ADR-237 G1 — IconButton 변형 (F4)", () => {
  it("IconButton origin = Button 상태 열 4 ref 변형 · 재hydration Δ0", () => {
    const doc = seedDocument();
    for (const state of ["disabled", "hover", "pressed", "focus-visible"]) {
      const variant = find(doc.children, `component-iconbutton--${state}`);
      expect(variant, state).toMatchObject({
        type: "ref",
        ref: "component-iconbutton",
        reusable: true,
        metadata: { variant: state },
      });
    }
    expect(
      find(doc.children, "component-iconbutton--selected"),
    ).toBeUndefined();
    expect(JSON.stringify(ensureReusableCompositeOrigins(doc))).toBe(
      JSON.stringify(doc),
    );
  });
});

describe("ADR-237 G1 — CardView Card 자식 = Card origin ref (F3)", () => {
  it("seed · 기존 문서 이관 모두 ref + origin 자식 숨김 · 두 leg 의 Card 표시 입력이 이관 전과 같다", () => {
    const doc = seedDocument();
    const cards = find(doc.children, "component-cardview")!.children ?? [];
    expect(cards).toHaveLength(3);
    for (const card of cards) {
      expect(card).toMatchObject({ type: "ref", ref: "component-card" });
      expect(
        Object.values(
          (card as { descendants?: Record<string, unknown> }).descendants ?? {},
        ),
      ).toEqual([
        { enabled: false },
        { enabled: false },
        { enabled: false },
        { enabled: false },
      ]);
    }
    // 이관 전 (plain) 모양 = 종전 seed 의 Card 3.
    const plainCards = [1, 2, 3].map((n) => ({
      id: `component-cardview__${n}`,
      type: "Card",
      props: {
        variant: "primary",
        children: `Card ${n}`,
        style: { width: 200, height: 160, padding: 16 },
      },
    }));
    const before = mapNodes(doc, (node) =>
      node.id === "component-cardview"
        ? ({ ...node, children: plainCards } as unknown as CanonicalNode)
        : node,
    );
    const migrated = migrateCardViewCardsToRefs(before);
    expect(JSON.stringify(migrated)).toBe(JSON.stringify(doc));
    expect(migrateCardViewCardsToRefs(migrated)).toBe(migrated);

    const sceneBefore = buildCanonicalSceneModel(before);
    const sceneAfter = buildCanonicalSceneModel(migrated);
    const resolvedBefore = resolveCanonicalDocument(before) as ResolvedNode[];
    const resolvedAfter = resolveCanonicalDocument(migrated) as ResolvedNode[];
    for (const n of [1, 2, 3]) {
      const id = `component-cardview__${n}`;
      expect(sceneAfter.sceneNodesMap.get(id)?.type).toBe("Card");
      expect(sceneAfter.sceneNodesMap.get(id)?.props).toEqual(
        sceneBefore.sceneNodesMap.get(id)?.props,
      );
      expect(sceneAfter.sceneChildrenByParent.get(id) ?? []).toEqual([]);
      const r = findResolved(resolvedAfter, id)!;
      expect(r.type).toBe("Card");
      expect(r.children ?? []).toEqual([]);
      expect(r.props).toEqual(findResolved(resolvedBefore, id)!.props);
    }
  });
});

describe("ADR-237 G1 — 경고 0 (seed 변환 보류 · slot 계약)", () => {
  it("seed 의 조합 자식 ref 변환 보류 0 (CardView Card 포함)", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    createInitialProjectDocument(
      { id: "page-1", title: "P", slug: "/" },
      { id: "body-1", type: "body" },
    );
    expect(
      warn.mock.calls.filter((call) =>
        String(call[0]).includes("조합 자식 ref 변환 보류"),
      ),
    ).toEqual([]);
  });

  it("그룹 origin 의 Label · Toolbar Separator 는 slot 계약 경고 대상이 아니다 (Preview resolver)", () => {
    const doc = seedDocument();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    resolveCanonicalDocument(doc);
    expect(
      warn.mock.calls.filter((call) =>
        String(call[0]).includes("slot contract"),
      ),
    ).toEqual([]);
  });
});
