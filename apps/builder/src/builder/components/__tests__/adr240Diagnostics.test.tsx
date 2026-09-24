import { describe, expect, it, vi } from "vitest";

import type {
  CanonicalNode,
  CompositionDocument,
  RefNode,
  ResolvedNode,
} from "@composition/shared";

import { createInitialProjectDocument } from "../../../dashboard/createInitialProjectDocument";
import { buildCanonicalSceneModel } from "../../workspace/canvas/scene/canonicalSceneModel";
import { resolveCanonicalDocument } from "../../../resolvers/canonical";
import { applyCanonicalHistoryEventsToDocument } from "../../stores/history/canonicalHistoryEvents";
import { isSlotHostElement } from "../slotHostPolicy";
import { CARD_ORIGIN_ID } from "../card/cardTemplateOrigins";
import { LEGACY_DIALOG_CONTENT_ID } from "../migrateDialogTriggerInstances";

/**
 * ADR-240 Phase 0 — 진단 RED (breakdown §4 Phase 0 (a)~(f)).
 * `it` = G0 실측 기준선 (이미 GREEN). `it.fails` = 현재 결함 — 닫는 Phase 가 `it` 으로 바꾼다:
 *   (a) (c) → Phase 1 · (e) → Phase 2 · (f) → Phase 1 (history 전치).
 * Phase 1 로 (a) (c) (f) GREEN — 모양 고정은 `adr240Phase1.regionSlots.test.tsx`. (g) 는 Canvas 가 id 키를 계속 안 읽는다
 *   (UI 가 segment 키를 쓰도록 바꿔 닫음 — 기존 id 키 채움은 LOW deferred, breakdown §5 Phase 1).
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

/** seed 문서의 body 에 노드를 덧붙인다 (origin 은 seed 의 Components 페이지 것을 그대로 쓴다). */
function withBodyChildren(
  doc: CompositionDocument,
  added: CanonicalNode[],
): CompositionDocument {
  const visit = (nodes: CanonicalNode[]): CanonicalNode[] =>
    nodes.map((node) =>
      node.id === "body-1"
        ? { ...node, children: [...(node.children ?? []), ...added] }
        : node.children
          ? { ...node, children: visit(node.children) }
          : node,
    );
  return { ...doc, children: visit(doc.children) };
}

function textOf(node: { props?: Record<string, unknown> } | undefined) {
  return node?.props?.children;
}

function sceneNode(doc: CompositionDocument, id: string) {
  const model = buildCanonicalSceneModel(doc);
  return model.sceneNodesMap.get(id) as
    { id: string; type: string; props?: Record<string, unknown> } | undefined;
}

function sceneChildTypes(doc: CompositionDocument, parentId: string) {
  const model = buildCanonicalSceneModel(doc);
  return (model.sceneChildrenByParent.get(parentId) ?? []).map((n) => n.type);
}

// ── (a) Card 영역에 slot 배열이 없다 ──────────────────────────────────────────
describe("ADR-240 진단 (a) — Card instance 의 Slot 채우기 절이 비어 있다 (F3 · F5)", () => {
  const REGIONS = ["preview", "header", "content", "footer"];

  it("기준선 F5: Card origin 영역 자식 4 = slotRole 보유 (G0 에서는 slot 배열 0)", () => {
    const card = find(seedDocument().children, CARD_ORIGIN_ID)!;
    const regions = (card.children ?? []).filter((child) =>
      REGIONS.includes(String(child.metadata?.slotRole)),
    );
    expect(regions.map((r) => r.metadata?.slotRole)).toEqual(REGIONS);
  });

  it("Card origin 영역 host 4 개가 slot 배열을 가진다 (Slot 채우기 절 대상 — Phase 1 GREEN)", () => {
    const card = find(seedDocument().children, CARD_ORIGIN_ID)!;
    for (const role of REGIONS) {
      const region = (card.children ?? []).find(
        (child) => child.metadata?.slotRole === role,
      );
      expect(Array.isArray(region?.slot), role).toBe(true);
    }
  });

  it("CardPreview 는 slot host 다 (G0 FRAME_SLOT_HOST_TYPES 에 없음 — Phase 1 GREEN)", () => {
    expect(isSlotHostElement({ id: "p", type: "CardPreview" } as never)).toBe(
      true,
    );
  });
});

// ── (b) mode C 에 primitive ──────────────────────────────────────────────────
function cardInstanceWithFill(extra: Record<string, unknown> = {}): RefNode {
  return {
    id: "card-inst",
    type: "ref",
    ref: CARD_ORIGIN_ID,
    props: {},
    descendants: {
      Content: {
        children: [
          { id: "t", type: "Text", props: { children: "A" } } as CanonicalNode,
        ],
      },
      ...extra,
    },
  } as unknown as RefNode;
}

describe("ADR-240 진단 (b) — mode C 로 넣은 primitive 를 두 leg 가 그린다 (F2)", () => {
  it("기준선: Card Content 영역 mode C 의 Text 가 Preview resolved 트리에 실린다", () => {
    const doc = withBodyChildren(seedDocument(), [cardInstanceWithFill()]);
    const inst = findResolved(
      resolveCanonicalDocument(doc) as ResolvedNode[],
      "card-inst",
    )!;
    const content = (inst.children ?? []).find(
      (child) => child.type === "CardContent",
    ) as ResolvedNode;
    expect((content.children ?? []).map((c) => [c.type, textOf(c)])).toEqual([
      ["Text", "A"],
    ]);
  });

  it("기준선: 같은 Text 가 Canvas scene 에 synthetic 노드로 실린다", () => {
    const doc = withBodyChildren(seedDocument(), [cardInstanceWithFill()]);
    const node = sceneNode(doc, "card-inst/Content/t");
    expect([node?.type, textOf(node)]).toEqual(["Text", "A"]);
    expect(sceneChildTypes(doc, "card-inst/Content")).toEqual(["Text"]);
  });
});

/**
 * G0 추가 진단 (g) — Slot 채우기 UI (`ComponentSlotFillSection.getStableSegment`) 는 경로를 `customId ?? id` 로
 * 만든다. Card 영역은 name 을 가져 (패널 노드 `componentName: "Content"`) UI 키 = `component-card__content` (id) 인데,
 * Canvas 는 name segment (`getCanonicalRefPathSegment`) 만 받고 Preview 는 id · segment 둘 다 받는다.
 */
describe("ADR-240 진단 (g) — Slot 채우기 UI 의 id 경로 키를 Canvas 가 못 읽는다 (F14)", () => {
  const byIdKey = () =>
    withBodyChildren(seedDocument(), [
      {
        ...cardInstanceWithFill(),
        descendants: {
          "component-card__content": {
            children: [
              {
                id: "t",
                type: "Text",
                props: { children: "A" },
              } as CanonicalNode,
            ],
          },
        },
      } as unknown as CanonicalNode,
    ]);

  it("기준선: Preview 는 id 경로 키의 mode C 를 그린다", () => {
    const inst = findResolved(
      resolveCanonicalDocument(byIdKey()) as ResolvedNode[],
      "card-inst",
    )!;
    const content = (inst.children ?? []).find(
      (child) => child.type === "CardContent",
    ) as ResolvedNode;
    expect((content.children ?? []).map((c) => c.type)).toEqual(["Text"]);
  });

  // Phase 1 은 UI 가 segment 키를 쓰게 닫는다 (`regionSlotFill.getSlotFillPath`) — Canvas 는 여전히 id 키를 안 읽는다.
  //   기존 id 키 채움 (234 이후 name 을 가진 host) 은 LOW deferred: UI 가 다음 채우기 · 비우기에서 segment 키로 옮긴다.
  it.fails("Canvas 도 id 경로 키의 mode C 를 그린다 (LOW deferred)", () => {
    expect(sceneChildTypes(byIdKey(), "card-inst/Content")).toEqual(["Text"]);
  });
});

// ── (c) Dialog 내용 영역 ─────────────────────────────────────────────────────
describe("ADR-240 진단 (c) — Dialog instance 에 내용을 더할 자리가 없다 (F6)", () => {
  function dialogContent(doc: CompositionDocument) {
    const origin = find(doc.children, "component-dialog")!;
    return (origin.children ?? []).find((child) => child.type === "Dialog")!;
  }

  // F6 정정 (G0): trigger 와 Close 는 plain Button 이 아니라 Button origin ref (`originChildRefs`) — Close 는 `props.slot:"close"`.
  // G0 모양 (Heading · Description · DialogFooter > ref Close) → Phase 1 이관 뒤: Description 이 Content 영역 안 ·
  //   DialogFooter = [Actions 영역, ref Close].
  it("기준선 F6 (Phase 1 뒤): seed Dialog origin = DialogTrigger > [ref Button, Dialog > Heading · Content(Description) · DialogFooter > Actions · ref Button(close)]", () => {
    const doc = seedDocument();
    const origin = find(doc.children, "component-dialog")!;
    expect(origin.type).toBe("DialogTrigger");
    const content = dialogContent(doc);
    expect((content.children ?? []).map((c) => c.type)).toEqual([
      "Heading",
      "frame",
      "DialogFooter",
    ]);
    expect((content.children![1]!.children ?? []).map((c) => c.type)).toEqual([
      "Description",
    ]);
    const footer = content.children![2]!;
    expect(
      (footer.children ?? []).map((c) => [
        c.type,
        (c as RefNode).ref,
        c.props?.slot,
      ]),
    ).toEqual([
      ["frame", undefined, undefined],
      ["ref", "component-button", "close"],
    ]);
  });

  it("Dialog 본문에 slot 배열을 가진 content 영역 host 가 있다 (Phase 1 GREEN)", () => {
    const content = dialogContent(seedDocument());
    const host = (content.children ?? []).find(
      (child) => child.metadata?.slotRole === "content",
    );
    expect(Array.isArray(host?.slot)).toBe(true);
  });
});

// ── (d) Popover 자기 자식 순서 ───────────────────────────────────────────────
describe("ADR-240 진단 (d) — Popover instance 자기 자식은 inherited 자식 뒤 (237 축)", () => {
  const popoverInstance = {
    id: "pop-inst",
    type: "ref",
    ref: "component-popover",
    props: {},
    children: [{ id: "own-btn", type: "Button", props: { children: "Go" } }],
  } as unknown as CanonicalNode;

  it("기준선: Preview resolved 자식 = Heading · Description · Button", () => {
    const doc = withBodyChildren(seedDocument(), [popoverInstance]);
    const inst = findResolved(
      resolveCanonicalDocument(doc) as ResolvedNode[],
      "pop-inst",
    )!;
    expect((inst.children ?? []).map((c) => c.type)).toEqual([
      "Heading",
      "Description",
      "Button",
    ]);
  });

  it("기준선: Canvas scene 자식 = Heading · Description · Button", () => {
    const doc = withBodyChildren(seedDocument(), [popoverInstance]);
    expect(sceneChildTypes(doc, "pop-inst")).toEqual([
      "Heading",
      "Description",
      "Button",
    ]);
  });
});

// ── (e) mode C 로 채운 노드 편집 ─────────────────────────────────────────────
/**
 * Properties/Styles 쓰기 (`inspectorActions.buildInstanceDescendantPatches`) 는 synthetic id 에서 instance
 * prefix 를 뗀 경로 (`Content/t`) 에 mode A patch 를 쓴다. 두 해석기는 mode C 배열 안 노드 props 를 읽는다.
 */
describe("ADR-240 진단 (e) — mode C 로 채운 노드의 편집이 화면에 안 실린다 (리뷰 r1 h3)", () => {
  const edited = () =>
    withBodyChildren(seedDocument(), [
      cardInstanceWithFill({ "Content/t": { children: "B" } }),
    ]);

  it.fails("Preview: 편집값 B 가 보인다 (Phase 2)", () => {
    const inst = findResolved(
      resolveCanonicalDocument(edited()) as ResolvedNode[],
      "card-inst",
    )!;
    const content = (inst.children ?? []).find(
      (child) => child.type === "CardContent",
    ) as ResolvedNode;
    expect(textOf(content.children?.[0] as ResolvedNode)).toBe("B");
  });

  it.fails("Canvas: 편집값 B 가 보인다 (Phase 2)", () => {
    expect(textOf(sceneNode(edited(), "card-inst/Content/t"))).toBe("B");
  });

  it("기준선: 두 leg 모두 배열 노드 값 A 를 그린다 (편집 무시 — 두 leg 같은 결과)", () => {
    const doc = edited();
    const inst = findResolved(
      resolveCanonicalDocument(doc) as ResolvedNode[],
      "card-inst",
    )!;
    const content = (inst.children ?? []).find(
      (child) => child.type === "CardContent",
    ) as ResolvedNode;
    expect(textOf(content.children?.[0] as ResolvedNode)).toBe("A");
    expect(textOf(sceneNode(doc, "card-inst/Content/t"))).toBe("A");
  });
});

/**
 * 234 Slot "+" 가 mode C 에 넣는 모양 (origin ref 자식) 도 같은 쓰기 경로 (`updateAndSave` synthetic 분기 —
 * mode C 여부 판정 없음) 를 탄다.
 */
describe('ADR-240 진단 (e2) — mode C 안 ref 자식 (234 Slot "+" 모양) 편집도 안 실린다', () => {
  const edited = () =>
    withBodyChildren(seedDocument(), [
      {
        id: "card-inst",
        type: "ref",
        ref: CARD_ORIGIN_ID,
        props: {},
        descendants: {
          Content: {
            children: [
              {
                id: "b",
                type: "ref",
                ref: "component-button",
                props: { children: "A" },
              } as unknown as CanonicalNode,
            ],
          },
          "Content/b": { children: "B" },
        },
      } as unknown as CanonicalNode,
    ]);

  it.fails("Preview: 편집값 B 가 보인다 (Phase 2)", () => {
    const button = findResolved(
      resolveCanonicalDocument(edited()) as ResolvedNode[],
      "b",
    );
    expect(textOf(button)).toBe("B");
  });

  it.fails("Canvas: 편집값 B 가 보인다 (Phase 2)", () => {
    expect(textOf(sceneNode(edited(), "card-inst/Content/b"))).toBe("B");
  });

  it("기준선: 두 leg 모두 배열 노드 값 A", () => {
    const doc = edited();
    expect(
      textOf(
        findResolved(resolveCanonicalDocument(doc) as ResolvedNode[], "b"),
      ),
    ).toBe("A");
    expect(textOf(sceneNode(doc, "card-inst/Content/b"))).toBe("A");
  });
});

// ── (f) 저장 history 가 이관 전 경로를 되살린다 ───────────────────────────────
/**
 * 이관 전 Dialog instance 스냅샷 (Description patch = 옛 경로) 을 담은 replace event (remove + insert —
 * synthetic 편집이 instance 전체를 교체로 기록) 를, 구조 이관이 끝난 문서 (Content frame · 새 경로) 에
 * Undo 로 적용한다.
 */
describe("ADR-240 진단 (f) — 저장 history 의 Undo 가 이관 전 경로를 되살린다 (리뷰 r1 h2)", () => {
  const DESC = "desc";
  const CONTENT_FRAME = "content-region";
  const OLD_PATH = `${LEGACY_DIALOG_CONTENT_ID}/${DESC}`;
  const NEW_PATH = `${LEGACY_DIALOG_CONTENT_ID}/${CONTENT_FRAME}/${DESC}`;

  function originAfterMigration(): CanonicalNode {
    return {
      id: "component-dialog",
      type: "DialogTrigger",
      reusable: true,
      props: {},
      children: [
        { id: "component-dialog--trigger", type: "Button", props: {} },
        {
          id: LEGACY_DIALOG_CONTENT_ID,
          type: "Dialog",
          props: {},
          children: [
            { id: "title", type: "Heading", props: { children: "T" } },
            {
              id: CONTENT_FRAME,
              type: "frame",
              props: {},
              metadata: { slotRole: "content" },
              children: [
                {
                  id: DESC,
                  type: "Description",
                  props: { children: "origin" },
                },
              ],
            },
          ],
        },
      ],
    } as CanonicalNode;
  }

  function instance(path: string, text: string): CanonicalNode {
    return {
      id: "dlg-inst",
      type: "ref",
      ref: "component-dialog",
      props: {},
      descendants: { [path]: { children: text } },
    } as unknown as CanonicalNode;
  }

  function doc(inst: CanonicalNode): CompositionDocument {
    return {
      version: "composition-1.0",
      children: [
        originAfterMigration(),
        {
          id: "page-1",
          type: "frame",
          metadata: { type: "legacy-page", pageId: "page-1" },
          children: [
            { id: "body-1", type: "Body", props: {}, children: [inst] },
          ],
        } as CanonicalNode,
      ],
    } as CompositionDocument;
  }

  function descriptionText(d: CompositionDocument): unknown {
    const inst = findResolved(
      resolveCanonicalDocument(d) as ResolvedNode[],
      "dlg-inst",
    )!;
    const dialog = (inst.children ?? []).find(
      (c) => c.type === "Dialog",
    ) as ResolvedNode;
    const frame = (dialog.children ?? []).find(
      (c) => c.type === "frame",
    ) as ResolvedNode;
    return textOf(frame.children?.[0] as ResolvedNode);
  }

  it("기준선: 새 경로 patch 는 이관 뒤 origin 에서 적용된다 (B)", () => {
    expect(descriptionText(doc(instance(NEW_PATH, "B")))).toBe("B");
  });

  it("이관 뒤 문서에서 이관 전 스냅샷 (A, 옛 경로) 로 Undo → 편집값 A 가 보인다 (Phase 1 history 전치 GREEN)", () => {
    const migrated = doc(instance(NEW_PATH, "B"));
    const undone = applyCanonicalHistoryEventsToDocument(
      migrated,
      [
        {
          type: "remove",
          node: instance(OLD_PATH, "A"),
          parentId: "body-1",
          index: 0,
        },
        {
          type: "insert",
          node: instance(NEW_PATH, "B"),
          parentId: "body-1",
          index: 0,
        },
      ],
      "undo",
    );
    expect(descriptionText(undone)).toBe("A");
  });
});
