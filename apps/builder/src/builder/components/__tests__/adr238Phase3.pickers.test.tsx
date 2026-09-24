import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  getCatalogCutoverTypes,
  resolveSelectDisplayValue,
  type CanonicalNode,
  type CompositionDocument,
  type ResolvedNode,
} from "@composition/shared";

import { buildCanonicalSceneModel } from "../../workspace/canvas/scene/canonicalSceneModel";
import { buildSpecNodeData } from "../../workspace/canvas/skia/buildSpecNodeData";
import { buildSlotMarkerTargets } from "../../workspace/canvas/skia/skiaOverlayHelpers";
import { resolveCanonicalDocument } from "../../../resolvers/canonical";
import { CanonicalNodeRenderer } from "../../../preview/components/CanonicalNodeRenderer";
import type { RenderContext } from "../../../preview/types/index";
import { ensureReusableCompositeOrigins } from "../reusableCompositeOrigins";
import { ensureMenuTemplateOrigins } from "../menu/menuTemplateOrigins";
import {
  indexNodes,
  isStaticCollectionOwner,
} from "../staticCollectionMigration";
import { planTabItemInsert } from "../collectionItemInsert";
import { resolveSlotInsertAction } from "../slotHostPolicy";

/**
 * ADR-238 Phase 3 — Select · ComboBox 항목 = ListBoxItem origin instance 자식 (breakdown §4 Phase 3 · G3).
 */

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

(globalThis as { ResizeObserver?: unknown }).ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

function page(user: CanonicalNode[]): CompositionDocument {
  return {
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
  } as CompositionDocument;
}

function seededDoc(user: CanonicalNode[] = []): CompositionDocument {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  return ensureReusableCompositeOrigins(ensureMenuTemplateOrigins(page(user)));
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

function renderById(
  doc: CompositionDocument,
  id: string,
  updateElementProps: (
    id: string,
    props: Record<string, unknown>,
  ) => void = () => {},
) {
  const resolved = findResolved(
    resolveCanonicalDocument(doc) as ResolvedNode[],
    id,
  )!;
  return render(
    <CanonicalNodeRenderer
      node={resolved}
      cutoverPrimitives={getCatalogCutoverTypes()}
      renderContext={
        {
          childrenByParent: new Map(),
          renderElement: () => null,
          updateElementProps,
        } as unknown as RenderContext
      }
    />,
  );
}

/** Canvas 트리거 표시 글자 — scene 의 SelectValue children (propagation transform = resolveSelectDisplayValue). */
function canvasDisplay(doc: CompositionDocument, ownerId: string): unknown {
  const model = buildCanonicalSceneModel(doc);
  const owner = model.sceneNodesMap.get(ownerId) as
    { props: Record<string, unknown> } | undefined;
  return resolveSelectDisplayValue({
    ownerProps: owner?.props,
    placeholder: owner?.props.placeholder,
  });
}

/** Select 행 fixture — 행 id ≠ value · 명시 textValue 1 (리뷰 r1 m1 · m2). */
const ROWS = [
  { id: "opt-1", value: "KR", label: "대한민국", textValue: "대한민국 Korea" },
  { id: "opt-2", value: "JP", label: "일본" },
  { id: "opt-3", value: "US", label: "미국", isDisabled: true },
];

function plainSelect(
  type: "Select" | "ComboBox",
  props: Record<string, unknown> = {},
): CanonicalNode {
  return {
    id: `my-${type.toLowerCase()}`,
    type,
    props: { items: ROWS, placeholder: "Pick", ...props },
    children: [
      { id: `my-${type}-label`, type: "Label", props: { children: "Country" } },
      {
        id: `my-${type}-trigger`,
        type: "SelectTrigger",
        props: {},
        children: [{ id: `my-${type}-value`, type: "SelectValue", props: {} }],
      },
    ],
  } as unknown as CanonicalNode;
}

describe("ADR-238 Phase 3 — 이관 모양", () => {
  it("Select · ComboBox origin: sub-part 뒤에 ListBoxItem instance 4 · items 0 · slot = 항목 후보 + section · 멱등", () => {
    const doc = seededDoc();
    const byId = indexNodes(doc);
    for (const id of ["component-select", "component-combobox"]) {
      const origin = byId.get(id)!;
      expect(origin.props?.items, id).toBeUndefined();
      const types = (origin.children ?? []).map((c) => c.type);
      expect(types.slice(0, 2), id).toEqual(["Label", "SelectTrigger"]);
      const items = (origin.children ?? []).filter((c) => c.type === "ref");
      expect(items, id).toHaveLength(4);
      expect(items[0], id).toMatchObject({
        ref: "component-listbox-item-default",
        props: { value: "aardvark" },
        descendants: { Label: { children: "Aardvark" } },
      });
      expect((origin as { slot?: unknown }).slot, id).toEqual([
        "component-listbox-item-default--unselected",
        "component-listbox-item-default",
        "component-listbox-section",
      ]);
    }
    expect(JSON.stringify(ensureReusableCompositeOrigins(doc))).toBe(
      JSON.stringify(doc),
    );
  });

  it("plain Select: 행 id → props.id · value → props.value · 명시 textValue 만 · isDisabled · 바인딩 Select 는 그대로", () => {
    const doc = seededDoc([
      plainSelect("Select"),
      {
        ...plainSelect("ComboBox"),
        id: "bound-cb",
        props: {
          items: ROWS,
          dataBinding: { source: "dataTable", name: "dt" },
        },
      } as CanonicalNode,
    ]);
    const byId = indexNodes(doc);
    const select = byId.get("my-select")!;
    expect(select.props?.items).toBeUndefined();
    const items = (select.children ?? []).filter((c) => c.type === "ref");
    expect(items.map((i) => i.props)).toEqual([
      { id: "opt-1", value: "KR", textValue: "대한민국 Korea" },
      { id: "opt-2", value: "JP" },
      { id: "opt-3", isDisabled: true, value: "US" },
    ]);
    expect(byId.get("bound-cb")!.props?.items).toHaveLength(3);
    expect(isStaticCollectionOwner(doc, "my-select")).toBe(true);
    expect(isStaticCollectionOwner(doc, "bound-cb")).toBe(false);
  });
});

describe("ADR-238 Phase 3 — 선택 계약 (G3 · R1)", () => {
  it("이관 전후 같은 항목: Canvas 트리거 글자 · Preview 초기 선택 (selectedKey = 행 id, id ≠ value)", () => {
    const user = [plainSelect("Select", { selectedKey: "opt-2" })];
    const before = page(user);
    const after = seededDoc(user);
    // Canvas — 이관 전 `items` · 이관 뒤 `_staticItems` 가 같은 글자.
    expect(
      resolveSelectDisplayValue({
        ownerProps: { items: ROWS, selectedKey: "opt-2" },
        placeholder: "Pick",
      }),
    ).toBe("일본");
    expect(canvasDisplay(after, "my-select")).toBe("일본");
    // Preview — 트리거 SelectValue 글자 (RAC 선택) 가 같다.
    const text = (doc: CompositionDocument) => {
      const { container } = renderById(doc, "my-select");
      const value = container.querySelector(".react-aria-SelectValue");
      const out = value?.textContent;
      cleanup();
      return out;
    };
    expect(text(before)).toContain("일본");
    expect(text(after)).toContain("일본");
  });

  it("section 안 항목 선택: 이관 뒤 Canvas 트리거 글자 (_staticItems) = Preview 글자", () => {
    const sectionRows = [
      {
        id: "asia",
        type: "section",
        header: "Asia",
        items: [
          { id: "kr", value: "KR", label: "Korea" },
          { id: "jp", value: "JP", label: "Japan" },
        ],
      },
      { id: "us", value: "US", label: "USA" },
    ];
    const user = [
      plainSelect("Select", { items: sectionRows, selectedKey: "jp" }),
    ];
    const after = seededDoc(user);
    expect(canvasDisplay(after, "my-select")).toBe("Japan");
    const { container } = renderById(after, "my-select");
    expect(
      container.querySelector(".react-aria-SelectValue")?.textContent,
    ).toContain("Japan");
  });

  it("Skia draw: 팔레트 모양 Select · ComboBox instance 선택 → SelectValue 가 그리는 글자 = 항목 글자 (미선택 = placeholder)", () => {
    const drawn = (type: "Select" | "ComboBox", props: Record<string, unknown>) => {
      const origin = type === "Select" ? "component-select" : "component-combobox";
      const doc = seededDoc([
        { id: "inst", type: "ref", ref: origin, props } as unknown as CanonicalNode,
      ]);
      const map = buildCanonicalSceneModel(doc).sceneNodesMap as Map<
        string,
        { id: string; type: string }
      >;
      const value = [...map.values()].find(
        (node) => node.id.startsWith("inst/") && node.type === "SelectValue",
      )!;
      const out = buildSpecNodeData({
        element: value,
        layout: { x: 0, y: 0, width: 200, height: 20 },
        theme: "light",
        childElements: [],
        elementsMap: map,
      } as unknown as Parameters<typeof buildSpecNodeData>[0]);
      type Drawn = { text?: { content: string }; children?: Drawn[] };
      const seek = (node: Drawn | null | undefined): string | null =>
        node?.text?.content ??
        (node?.children ?? []).map(seek).find((t) => t != null) ??
        null;
      return seek(out as Drawn | null);
    };
    expect(drawn("Select", { selectedValue: "cat" })).toBe("Cat");
    expect(drawn("ComboBox", { selectedValue: "dog" })).toBe("Dog");
    expect(drawn("Select", {})).toBe("Choose an option...");
  });

  it("Preview 클릭 writeback: selectedKey = 행 id · selectedValue = 행 value (이관 전과 같은 값)", async () => {
    const writes: Array<Record<string, unknown>> = [];
    const doc = seededDoc([plainSelect("Select")]);
    const { container, baseElement } = renderById(
      doc,
      "my-select",
      (_id, props) => writes.push(props),
    );
    await act(async () => {
      fireEvent.click(container.querySelector("button")!);
    });
    const options = Array.from(baseElement.querySelectorAll('[role="option"]'));
    expect(options.map((o) => o.getAttribute("data-key"))).toEqual([
      "opt-1",
      "opt-2",
      "opt-3",
    ]);
    expect(options[2]!.getAttribute("aria-disabled")).toBe("true");
    await act(async () => {
      fireEvent.click(options[0]!);
    });
    expect(writes.at(-1)).toMatchObject({
      selectedKey: "opt-1",
      selectedValue: "KR",
    });
  });

  it("ComboBox (이관 전 items 경로 — 조작 대조군): 명시 textValue 로 검색", async () => {
    const { container, baseElement } = renderById(
      page([plainSelect("ComboBox")]),
      "my-combobox",
    );
    const input = container.querySelector("input")!;
    await act(async () => {
      input.focus();
      fireEvent.change(input, { target: { value: "Korea" } });
    });
    expect(
      Array.from(baseElement.querySelectorAll('[role="option"]')).map((o) =>
        o.getAttribute("data-key"),
      ),
    ).toEqual(["opt-1"]);
  });

  it("ComboBox: 명시 textValue 로 검색 (label 과 다른 검색어) · 선택 writeback value = 행 value · 선택 유지", async () => {
    const writes: Array<Record<string, unknown>> = [];
    const doc = seededDoc([plainSelect("ComboBox")]);
    const { container, baseElement } = renderById(
      doc,
      "my-combobox",
      (_id, props) => writes.push(props),
    );
    const input = container.querySelector("input")!;
    await act(async () => {
      input.focus();
      fireEvent.change(input, { target: { value: "Korea" } });
    });
    const options = Array.from(baseElement.querySelectorAll('[role="option"]'));
    expect(options.map((o) => o.getAttribute("data-key"))).toEqual(["opt-1"]);
    await act(async () => {
      fireEvent.click(options[0]!);
    });
    // RAC 는 선택 뒤 입력칸을 항목 textValue 로 채운다 (onInputChange) — 선택은 유지된다.
    expect(writes.at(-1)).toMatchObject({
      selectedKey: "opt-1",
      selectedValue: "KR",
      inputValue: "대한민국 Korea",
    });
  });

  it("ComboBox 자유 입력 (inputValue) 은 선택보다 먼저 표시 — 이관 뒤에도", () => {
    const doc = seededDoc([
      plainSelect("ComboBox", {
        selectedKey: "opt-2",
        inputValue: "직접 입력",
      }),
    ]);
    expect(canvasDisplay(doc, "my-combobox")).toBe("직접 입력");
  });
});

describe("ADR-238 Phase 3 — ListBoxItem origin 편집이 popover 항목에 닿는다", () => {
  it("origin label slot style (fontWeight) · root style (배경) → Select popover 항목", async () => {
    // 항목 origin = 선택 모양 (ADR-234 — 휴지 모양은 `--unselected` 층) — root 배경은 선택 항목에 닿는다.
    const doc = seededDoc([plainSelect("Select", { selectedKey: "opt-1" })]);
    const edited = {
      ...doc,
      children: doc.children.map(function visit(node): CanonicalNode {
        if (node.id === "component-listbox-item-default") {
          return {
            ...node,
            props: {
              ...(node.props as Record<string, unknown>),
              style: { backgroundColor: "rgb(1, 2, 3)" },
            },
            children: (node.children ?? []).map((child) =>
              (child.metadata as Record<string, unknown> | undefined)
                ?.slotRole === "label"
                ? ({
                    ...child,
                    props: {
                      ...(child.props as Record<string, unknown>),
                      style: { fontWeight: 800 },
                    },
                  } as CanonicalNode)
                : child,
            ),
          } as CanonicalNode;
        }
        return node.children
          ? { ...node, children: node.children.map(visit) }
          : node;
      }),
    } as CompositionDocument;
    const { container, baseElement } = renderById(edited, "my-select");
    await act(async () => {
      fireEvent.click(container.querySelector("button")!);
    });
    const option = baseElement.querySelector('[role="option"]') as HTMLElement;
    expect(
      (option.querySelector('[slot="label"]') as HTMLElement).style.fontWeight,
    ).toBe("800");
    expect(option.style.backgroundColor).toBe("rgb(1, 2, 3)");
  });
});

describe('ADR-238 Phase 3 — Slot "+" · 진단 (d)', () => {
  it("Select origin host + ListBoxItem origin 후보 → 항목 instance (선택 key 는 쓰지 않는다)", () => {
    const doc = seededDoc();
    const byId = indexNodes(doc);
    expect(
      resolveSlotInsertAction(
        byId.get("component-select") as never,
        byId.get("component-listbox-item-default") as never,
      ),
    ).toEqual({ kind: "list-item" });
    const plan = planTabItemInsert({
      document: doc,
      hostId: "component-select",
      candidateId: "component-listbox-item-default",
      newKey: "k-new",
    });
    expect(plan).toMatchObject({
      kind: "plain",
      tabListId: "component-select",
      tab: { type: "ref", props: { id: "k-new" } },
      selection: null,
    });
  });
});

describe("ADR-238 G4 — popover 내용은 scene 에 세우지 않는다 (Canvas 는 트리거만)", () => {
  it("plain Select: 선택 행만 해석 (트리거 글자) · 나머지 항목 scene 노드 0 · 미선택이면 0", () => {
    const doc = seededDoc([
      plainSelect("Select", { selectedKey: "opt-2" }),
      { ...plainSelect("ComboBox"), id: "my-cb-empty" } as CanonicalNode,
    ]);
    const map = buildCanonicalSceneModel(doc).sceneNodesMap as Map<
      string,
      { id: string; type: string; parentId: string | null }
    >;
    const items = (owner: string) =>
      [...map.values()].filter(
        (n) => n.parentId === owner && n.type === "ListBoxItem",
      );
    expect(items("my-select")).toHaveLength(0);
    expect(items("my-cb-empty")).toHaveLength(0);
    expect(canvasDisplay(doc, "my-select")).toBe("일본");
  });

  it("Menu origin: 항목은 scene 에서 빠지지만 빈 slot 표시는 켜지지 않는다 (hasPopoverContent)", () => {
    const doc = seededDoc();
    const model = buildCanonicalSceneModel(doc);
    const map = model.sceneNodesMap as unknown as Map<
      string,
      { id: string; type: string; parentId: string | null; hasPopoverContent?: true }
    >;
    const menu = map.get("component-menu")!;
    expect(
      [...map.values()].filter(
        (n) => n.parentId === "component-menu" && n.type === "MenuItem",
      ),
    ).toHaveLength(0);
    expect(menu.hasPopoverContent).toBe(true);
    const bounds = new Map([
      ["component-menu", { x: 0, y: 0, width: 200, height: 30 }],
    ]);
    const targets = buildSlotMarkerTargets(
      bounds as never,
      model.sceneNodesMap,
      model.sceneChildrenByParent,
    );
    expect(targets.map((t) => (t as { id?: string }).id ?? t)).toEqual([]);
  });
});
