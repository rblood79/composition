import { describe, expect, it, vi } from "vitest";

import type {
  CanonicalNode,
  CompositionDocument,
  RefNode,
  ResolvedNode,
} from "@composition/shared";

import { createInitialProjectDocument } from "../../../dashboard/createInitialProjectDocument";
import { normalizeMainDocument } from "../../../adapters/canonical/mainDocumentNormalization";
import { buildCanonicalSceneModel } from "../../workspace/canvas/scene/canonicalSceneModel";
import { resolveCanonicalDocument } from "../../../resolvers/canonical";
import { applyCanonicalHistoryEventsToDocument } from "../../stores/history/canonicalHistoryEvents";
import { collectCanonicalPanelNodes } from "../../panels/canonicalPanelNodes";
import type { PanelNode } from "../../panels/panelNode";
import { COMPONENTS_SYSTEM_BODY_ID } from "../../pages/systemComponentsPage";
import { CARD_ORIGIN_ID } from "../card/cardTemplateOrigins";
import {
  DIALOG_ACTIONS_REGION_ID,
  DIALOG_CONTENT_REGION_ID,
} from "../dialogRegionPaths";
import { REGION_SLOT_SEEDS, ensureRegionSlots } from "../regionSlotOrigins";
import {
  SELF_LIST_SLOT_HOST_TYPES,
  isSlotContractItem,
  isSlotHostElement,
} from "../slotHostPolicy";
import {
  collectSlotFillHosts,
  readSlotFill,
  writeSlotFill,
} from "../slotFillPath";

/**
 * ADR-240 Phase 1 (G1) — 영역 slot seed · Dialog 영역 구조 이관 + instance 경로 전치 · history 재생 전치 · Slot 채우기
 * 경로 키 (segment) · 두 leg (Preview resolver · Canvas scene).
 */

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

function withBodyChildren(
  doc: CompositionDocument,
  added: CanonicalNode[],
): CompositionDocument {
  return {
    ...doc,
    children: mapNodes(doc.children, (node) =>
      node.id === "body-1"
        ? { ...node, children: [...(node.children ?? []), ...added] }
        : node,
    ),
  };
}

/**
 * 240 전 문서 모양 (G0 seed 실측 — breakdown §5): 영역 `slot` 없음 · Dialog 본문 = Heading · Description ·
 * DialogFooter > Close. 240 seed 를 되돌려 만든다.
 */
function toPre240(doc: CompositionDocument): CompositionDocument {
  const strip = (node: CanonicalNode): CanonicalNode => {
    const role = node.metadata?.slotRole;
    const isRegionHost =
      (node.id.startsWith(`${CARD_ORIGIN_ID}__`) && typeof role === "string") ||
      node.id === "component-popover" ||
      node.id === "component-tooltip";
    if (isRegionHost && "slot" in node) {
      const { slot: _slot, ...rest } = node as CanonicalNode & {
        slot?: unknown;
      };
      return rest as CanonicalNode;
    }
    const children = node.children;
    if (!children) return node;
    const flattened = children.flatMap((child) =>
      child.id === DIALOG_CONTENT_REGION_ID
        ? (child.children ?? [])
        : child.id === DIALOG_ACTIONS_REGION_ID
          ? []
          : [child],
    );
    return flattened.length === children.length &&
      flattened.every((child, index) => child === children[index])
      ? node
      : { ...node, children: flattened };
  };
  return { ...doc, children: mapNodes(doc.children, strip) };
}

const BODY = "component-dialog__2";
const DESC = "component-dialog__2_2";
const FOOTER = "component-dialog__2_3";
const CLOSE = "component-dialog__2_3_1";

function dialogInstance(descendants: Record<string, unknown>): CanonicalNode {
  return {
    id: "dlg",
    type: "ref",
    ref: "component-dialog",
    props: {},
    descendants,
  } as unknown as CanonicalNode;
}

function resolvedDialogBody(doc: CompositionDocument): ResolvedNode {
  const inst = findResolved(
    resolveCanonicalDocument(doc) as ResolvedNode[],
    "dlg",
  )!;
  return (inst.children ?? []).find((c) => c.type === "Dialog") as ResolvedNode;
}

function scene(doc: CompositionDocument) {
  const model = buildCanonicalSceneModel(doc);
  return {
    node: (id: string) =>
      model.sceneNodesMap.get(id) as
        { type: string; props?: Record<string, unknown> } | undefined,
    childTypes: (id: string) =>
      (model.sceneChildrenByParent.get(id) ?? []).map((n) => n.type),
  };
}

// ── seed ────────────────────────────────────────────────────────────────────
describe("ADR-240 G1 — 영역 slot seed", () => {
  it("Card origin 영역 4 · Popover · Tooltip root 에 추천 목록이 실린다", () => {
    const doc = seedDocument();
    const card = find(doc.children, CARD_ORIGIN_ID)!;
    const slots = Object.fromEntries(
      (card.children ?? []).map((child) => [
        child.metadata?.slotRole,
        (child as { slot?: unknown }).slot,
      ]),
    );
    expect(slots).toEqual(REGION_SLOT_SEEDS.card);
    expect(
      (find(doc.children, "component-popover") as { slot?: unknown }).slot,
    ).toEqual(REGION_SLOT_SEEDS.popover);
    expect(
      (find(doc.children, "component-tooltip") as { slot?: unknown }).slot,
    ).toEqual(REGION_SLOT_SEEDS.tooltip);
  });

  it("Dialog origin: Description → Content 영역 · DialogFooter = [Actions 영역, Close]", () => {
    const doc = seedDocument();
    const content = find(doc.children, DIALOG_CONTENT_REGION_ID)!;
    expect(content).toMatchObject({
      type: "frame",
      name: "Content",
      slot: REGION_SLOT_SEEDS.dialogContent,
      metadata: { slotRole: "content" },
    });
    expect((content.children ?? []).map((c) => c.id)).toEqual([DESC]);
    const footer = find(doc.children, FOOTER)!;
    expect((footer.children ?? []).map((c) => c.id)).toEqual([
      DIALOG_ACTIONS_REGION_ID,
      CLOSE,
    ]);
    expect(find(doc.children, DIALOG_ACTIONS_REGION_ID)).toMatchObject({
      name: "Actions",
      slot: REGION_SLOT_SEEDS.dialogActions,
      metadata: { slotRole: "action" },
      children: [],
    });
  });

  it("멱등 — seed 문서를 다시 hydration 해도 같은 객체 (재hydration Δ0)", () => {
    const doc = seedDocument();
    expect(ensureRegionSlots(doc)).toBe(doc);
    expect(JSON.stringify(normalizeMainDocument(doc))).toBe(
      JSON.stringify(doc),
    );
  });

  it("사용자 값 보존 — 끈 slot (`false`) · 편집한 추천 목록은 그대로", () => {
    const pre = toPre240(seedDocument());
    const edited = {
      ...pre,
      children: mapNodes(pre.children, (node) =>
        node.id === `${CARD_ORIGIN_ID}__header`
          ? ({ ...node, slot: false } as CanonicalNode)
          : node.id === "component-popover"
            ? ({ ...node, slot: ["component-badge"] } as CanonicalNode)
            : node,
      ),
    };
    const next = normalizeMainDocument(edited);
    expect(
      (find(next.children, `${CARD_ORIGIN_ID}__header`) as { slot?: unknown })
        .slot,
    ).toBe(false);
    expect(
      (find(next.children, "component-popover") as { slot?: unknown }).slot,
    ).toEqual(["component-badge"]);
    expect(
      (find(next.children, `${CARD_ORIGIN_ID}__content`) as { slot?: unknown })
        .slot,
    ).toEqual(REGION_SLOT_SEEDS.card.content);
  });

  it("host 판정 — CardPreview · Popover · Tooltip 은 slot host · Popover/Tooltip instance 는 root slot 을 읽는다", () => {
    for (const type of ["CardPreview", "Popover", "Tooltip"]) {
      expect(isSlotHostElement({ id: "x", type } as never), type).toBe(true);
    }
    expect(SELF_LIST_SLOT_HOST_TYPES.has("Popover")).toBe(true);
    expect(SELF_LIST_SLOT_HOST_TYPES.has("Tooltip")).toBe(true);
  });

  it("영역 계약 대상 = 채운 reusable instance 만 (상속 Title · Description 은 경고 밖)", () => {
    const region = {
      id: "r",
      type: "CardContent",
      metadata: { slotRole: "content" },
    } as never;
    expect(isSlotContractItem(region, { type: "Description" })).toBe(false);
    expect(
      isSlotContractItem(region, {
        type: "Button",
        _resolvedFrom: "component-button",
      }),
    ).toBe(true);
    const popover = { id: "p", type: "Popover" } as never;
    expect(isSlotContractItem(popover, { type: "Heading" })).toBe(false);
  });
});

// ── 기존 문서 이관 · 경로 전치 ────────────────────────────────────────────────
describe("ADR-240 G1 — Dialog 구조 이관 · instance 경로 전치", () => {
  function preDoc(descendants: Record<string, unknown>) {
    return withBodyChildren(toPre240(seedDocument()), [
      dialogInstance(descendants),
    ]);
  }

  it("fixture 는 240 전 모양이다 (Description 이 본문 직계 · Actions 없음)", () => {
    const pre = toPre240(seedDocument());
    expect((find(pre.children, BODY)!.children ?? []).map((c) => c.id)).toEqual(
      ["component-dialog__2_1", DESC, FOOTER],
    );
    expect(
      (find(pre.children, FOOTER)!.children ?? []).map((c) => c.id),
    ).toEqual([CLOSE]);
  });

  it("Description patch 키 전치 · Close · title 키 불변 (Δbyte = +8 per 키)", () => {
    const before = {
      [`${BODY}/${DESC}`]: { children: "Edited" },
      [`${BODY}/component-dialog__2_1`]: { children: "Title!" },
      [`${BODY}/${FOOTER}/${CLOSE}`]: { children: "Done" },
    };
    const next = normalizeMainDocument(preDoc(before));
    const inst = find(next.children, "dlg") as RefNode;
    expect(Object.keys(inst.descendants ?? {}).sort()).toEqual(
      [
        `${BODY}/Content/${DESC}`,
        `${BODY}/component-dialog__2_1`,
        `${BODY}/${FOOTER}/${CLOSE}`,
      ].sort(),
    );
    expect(
      JSON.stringify(inst.descendants).length - JSON.stringify(before).length,
    ).toBe("Content/".length);
    // 멱등 — 두 번째 hydration 은 같은 키
    expect(
      (find(normalizeMainDocument(next).children, "dlg") as RefNode)
        .descendants,
    ).toEqual(inst.descendants);
  });

  it("기존 patch 가 새 경로에서 같은 결과 — Preview · Canvas (Description · Close override)", () => {
    const next = normalizeMainDocument(
      preDoc({
        [`${BODY}/${DESC}`]: { children: "Edited" },
        [`${BODY}/${FOOTER}/${CLOSE}`]: { children: "Done" },
      }),
    );
    const body = resolvedDialogBody(next);
    const content = (body.children ?? []).find(
      (c) => c.type === "frame",
    ) as ResolvedNode;
    expect(content.children?.[0]?.props?.children).toBe("Edited");
    const footer = (body.children ?? []).find(
      (c) => c.type === "DialogFooter",
    ) as ResolvedNode;
    expect(
      (footer.children ?? []).map((c) => [c.type, c.props?.children]),
    ).toEqual([
      ["frame", undefined],
      ["Button", "Done"],
    ]);
    const s = scene(next);
    expect(s.node(`dlg/${BODY}/Content/${DESC}`)?.props?.children).toBe(
      "Edited",
    );
    expect(s.node(`dlg/${BODY}/${FOOTER}/${CLOSE}`)?.props?.children).toBe(
      "Done",
    );
  });

  it("구 세대 문서 (trigger 이관 전 id — `component-dialog--content`) 도 구조로 Description 을 찾는다", () => {
    const legacyOrigin = {
      id: "component-dialog",
      type: "DialogTrigger",
      reusable: true,
      props: {},
      children: [
        { id: "component-dialog--trigger", type: "Button", props: {} },
        {
          id: "component-dialog--content",
          type: "Dialog",
          props: {},
          children: [
            { id: "component-dialog__1", type: "Heading", props: {} },
            { id: "component-dialog__2", type: "Description", props: {} },
            {
              id: "component-dialog__3",
              type: "DialogFooter",
              props: {},
              children: [
                {
                  id: "component-dialog__3_1",
                  type: "Button",
                  props: { slot: "close" },
                },
              ],
            },
          ],
        },
      ],
    } as unknown as CanonicalNode;
    const doc = {
      version: "composition-1.0",
      children: [
        {
          id: COMPONENTS_SYSTEM_BODY_ID,
          type: "Body",
          props: {},
          children: [legacyOrigin],
        },
        dialogInstance({
          "component-dialog--content/component-dialog__2": { children: "X" },
        }),
      ],
    } as unknown as CompositionDocument;
    const next = ensureRegionSlots(doc);
    const inst = next.children[1] as RefNode;
    expect(Object.keys(inst.descendants ?? {})).toEqual([
      "component-dialog--content/Content/component-dialog__2",
    ]);
    expect(
      (find(next.children, "component-dialog__3")!.children ?? []).map(
        (c) => c.id,
      ),
    ).toEqual([DIALOG_ACTIONS_REGION_ID, "component-dialog__3_1"]);
  });

  it("history 재생 — 이관 전 스냅샷 (옛 경로 A) 을 Undo 하면 새 경로로 A · Redo 는 B", () => {
    const migrated = normalizeMainDocument(
      preDoc({ [`${BODY}/${DESC}`]: { children: "B" } }),
    );
    const oldSnapshot = dialogInstance({
      [`${BODY}/${DESC}`]: { children: "A" },
    });
    const newSnapshot = dialogInstance({
      [`${BODY}/${DESC}`]: { children: "B" },
    });
    const events = [
      {
        type: "remove" as const,
        node: oldSnapshot,
        parentId: "body-1",
        index: 0,
      },
      {
        type: "insert" as const,
        node: newSnapshot,
        parentId: "body-1",
        index: 0,
      },
    ];
    const descText = (doc: CompositionDocument) =>
      (
        (resolvedDialogBody(doc).children ?? []).find(
          (c) => c.type === "frame",
        ) as ResolvedNode
      ).children?.[0]?.props?.children;
    const undone = applyCanonicalHistoryEventsToDocument(
      migrated,
      events,
      "undo",
    );
    expect(descText(undone)).toBe("A");
    expect(
      Object.keys((find(undone.children, "dlg") as RefNode).descendants ?? {}),
    ).toEqual([`${BODY}/Content/${DESC}`]);
    const redone = applyCanonicalHistoryEventsToDocument(
      undone,
      events,
      "redo",
    );
    expect(descText(redone)).toBe("B");
  });
});

// ── Slot 채우기 (추천 origin) ────────────────────────────────────────────────
function panelChildren(doc: CompositionDocument) {
  const map = new Map<string, PanelNode[]>();
  for (const node of collectCanonicalPanelNodes(doc)) {
    const parent = node.parent_id ?? "";
    map.set(parent, [...(map.get(parent) ?? []), node]);
  }
  return map;
}

describe("ADR-240 G1 — Slot 채우기 절 · 추천 origin 두 leg", () => {
  it("Card · Dialog instance 의 영역 host = segment 경로 (Canvas · Properties 쓰기 키와 같다)", () => {
    const children = panelChildren(seedDocument());
    expect(
      collectSlotFillHosts(CARD_ORIGIN_ID, children).map((h) => [
        h.path,
        h.legacyPath,
      ]),
    ).toEqual([
      ["Preview", "component-card__preview"],
      ["Header", "component-card__header"],
      ["Content", "component-card__content"],
      ["Footer", "component-card__footer"],
    ]);
    expect(
      collectSlotFillHosts("component-dialog", children).map((h) => h.path),
    ).toEqual([`${BODY}/Content`, `${BODY}/${FOOTER}/Actions`]);
  });

  it("옛 id 키 채움은 읽기 폴백 · 다음 쓰기에서 segment 키로 옮긴다", () => {
    const host = { path: "Content", legacyPath: "component-card__content" };
    const legacy = {
      "component-card__content": { children: [{ id: "a" }] },
      Other: { children: "x" },
    };
    expect(readSlotFill(legacy, host)).toEqual([{ id: "a" }]);
    expect(writeSlotFill(legacy, host, [{ id: "a" }, { id: "b" }])).toEqual({
      Other: { children: "x" },
      Content: { children: [{ id: "a" }, { id: "b" }] },
    });
    expect(writeSlotFill(legacy, host, null)).toEqual({
      Other: { children: "x" },
    });
  });

  it("Card content 에 Button origin 채움 → 두 leg 에 Button (mode C 교체 — 상속 Description 은 빠진다)", () => {
    const doc = withBodyChildren(seedDocument(), [
      {
        id: "card",
        type: "ref",
        ref: CARD_ORIGIN_ID,
        props: {},
        descendants: {
          Content: {
            children: [
              { id: "component-button", type: "ref", ref: "component-button" },
            ],
          },
        },
      } as unknown as CanonicalNode,
    ]);
    const inst = findResolved(
      resolveCanonicalDocument(doc) as ResolvedNode[],
      "card",
    )!;
    const content = (inst.children ?? []).find(
      (c) => c.type === "CardContent",
    ) as ResolvedNode;
    expect((content.children ?? []).map((c) => c.type)).toEqual(["Button"]);
    expect(scene(doc).childTypes("card/Content")).toEqual(["Button"]);
  });

  it("Dialog Actions 채움 → Close 존재 · Close override 적용 · 두 leg 같은 순서", () => {
    const doc = withBodyChildren(seedDocument(), [
      dialogInstance({
        [`${BODY}/${FOOTER}/Actions`]: {
          children: [{ id: "ok", type: "ref", ref: "component-button" }],
        },
        [`${BODY}/${FOOTER}/${CLOSE}`]: { children: "Cancel" },
      }),
    ]);
    const footer = (resolvedDialogBody(doc).children ?? []).find(
      (c) => c.type === "DialogFooter",
    ) as ResolvedNode;
    expect(
      (footer.children ?? []).map((c) => [
        c.type,
        (c.children ?? []).map((cc) => cc.type),
        c.props?.children,
      ]),
    ).toEqual([
      ["frame", ["Button"], undefined],
      ["Button", [], "Cancel"],
    ]);
    const s = scene(doc);
    expect(s.childTypes(`dlg/${BODY}/${FOOTER}`)).toEqual(["frame", "Button"]);
    expect(s.childTypes(`dlg/${BODY}/${FOOTER}/Actions`)).toEqual(["Button"]);
    expect(s.node(`dlg/${BODY}/${FOOTER}/${CLOSE}`)?.props?.children).toBe(
      "Cancel",
    );
  });

  it("Dialog Content 채움 → 두 leg 에 TextField (Description 교체)", () => {
    const doc = withBodyChildren(seedDocument(), [
      dialogInstance({
        [`${BODY}/Content`]: {
          children: [{ id: "tf", type: "ref", ref: "component-textfield" }],
        },
      }),
    ]);
    const content = (resolvedDialogBody(doc).children ?? []).find(
      (c) => c.type === "frame",
    ) as ResolvedNode;
    expect((content.children ?? []).map((c) => c.type)).toEqual(["TextField"]);
    expect(scene(doc).childTypes(`dlg/${BODY}/Content`)).toEqual(["TextField"]);
  });
});
