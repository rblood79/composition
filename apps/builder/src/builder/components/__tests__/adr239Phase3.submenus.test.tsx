import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  getCatalogCutoverTypes,
  type CanonicalNode,
  type CompositionDocument,
  type ResolvedNode,
} from "@composition/shared";

import { resolveCanonicalDocument } from "../../../resolvers/canonical";
import { CanonicalNodeRenderer } from "../../../preview/components/CanonicalNodeRenderer";
import type { RenderContext } from "../../../preview/types/index";
import { ensureReusableCompositeOrigins } from "../reusableCompositeOrigins";
import { ensureMenuTemplateOrigins } from "../menu/menuTemplateOrigins";
import { MENU_ITEM_DEFAULT_ORIGIN_ID } from "../menu/menuTemplateOrigins";
import { indexNodes } from "../staticCollectionMigration";
import { planTabItemInsert } from "../collectionItemInsert";
import { resolveSlotInsertAction } from "../slotHostPolicy";

/**
 * ADR-239 Phase 3 — Menu 하위 메뉴 (breakdown §4 Phase 3 · G3): MenuItem instance 의 자식 MenuItem = 하위 메뉴 (Preview
 * `SubmenuTrigger`, 정적 · 구조 경로 공통) · `children` 행 이관 · 바인딩 Menu 무변경 · MenuItem slot host.
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

/** Menu 를 그리고 트리거 → 하위 메뉴 트리거를 눌러 연 두 층 메뉴의 항목 글자 · 하위 메뉴 표식. */
async function openMenus(doc: CompositionDocument, id: string) {
  const resolved = findResolved(
    resolveCanonicalDocument(doc) as ResolvedNode[],
    id,
  )!;
  const { container, baseElement } = render(
    <CanonicalNodeRenderer
      node={resolved}
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
  await act(async () => {
    fireEvent.click(container.querySelector("button")!);
  });
  const menus = () => [...baseElement.querySelectorAll('[role="menu"]')];
  const rows = (menu: Element) =>
    [...menu.querySelectorAll('[role="menuitem"]')]
      .filter((row) => row.closest('[role="menu"]') === menu)
      .map((row) => ({
        text: row.textContent?.trim(),
        submenu: row.getAttribute("aria-haspopup") === "menu",
      }));
  const top = rows(menus()[0]!);
  // owner style 은 트리거 버튼 (Canvas 가 그리는 Menu 상자) — 목록 (popover 안) 에 실리면 목록이 트리거와 떨어져 그려진다.
  const triggerButton = container.querySelector("button") as HTMLElement;
  const placement = {
    trigger: [triggerButton.style.left, triggerButton.style.width],
    list: menus()[0]!.getAttribute("style"),
    // 메뉴 popover 한 겹 틀 규칙 (catalog Menu externalStyles) 의 대상 표식.
    popoverSize:
      menus()[0]!.closest(".react-aria-Popover")?.getAttribute("data-size") ??
      null,
  };
  const trigger = [...menus()[0]!.querySelectorAll('[role="menuitem"]')].find(
    (row) => row.getAttribute("aria-haspopup") === "menu",
  );
  // 하위 메뉴 표식 glyph — 항목 글자 크기 (1em) · 선 아이콘 (fill 없음). 종전: 크기 없는 `<svg>` 가 채움 검정으로 81px.
  const glyph = trigger?.querySelector("svg");
  const chevron = glyph
    ? { width: glyph.getAttribute("width"), fill: glyph.getAttribute("fill") }
    : null;
  let sub: ReturnType<typeof rows> = [];
  if (trigger) {
    await act(async () => {
      (trigger as HTMLElement).focus();
      fireEvent.keyDown(trigger, { key: "ArrowRight" });
      fireEvent.click(trigger);
    });
    const nested = menus()[1];
    sub = nested ? rows(nested) : [];
  }
  return { top, sub, chevron, placement };
}

const SUBMENU_ROWS = [
  { id: "open", label: "Open" },
  {
    id: "share",
    label: "Share",
    children: [
      { id: "mail", label: "Mail" },
      { id: "sms", label: "SMS" },
    ],
  },
];

describe("ADR-239 Phase 3 — 하위 메뉴 이관 · 두 경로", () => {
  it("이관: `children` 행 → 자식 MenuItem instance (`props.id` = 행 id) · items 0 · 멱등", () => {
    const doc = seededDoc([
      {
        id: "m",
        type: "Menu",
        props: { items: SUBMENU_ROWS },
      } as CanonicalNode,
    ]);
    const menu = indexNodes(doc).get("m")!;
    expect(menu.props?.items).toBeUndefined();
    const shape = (nodes: readonly CanonicalNode[] = []): unknown[] =>
      nodes.map((n) => [
        (n.props as Record<string, unknown>).id,
        (n as { descendants?: Record<string, { children?: string }> })
          .descendants?.Label?.children,
        shape((n.children ?? []).filter((c) => c.type === "ref")),
      ]);
    expect(shape(menu.children)).toEqual([
      ["open", "Open", []],
      [
        "share",
        "Share",
        [
          ["mail", "Mail", []],
          ["sms", "SMS", []],
        ],
      ],
    ]);
    expect(JSON.stringify(ensureReusableCompositeOrigins(doc))).toBe(
      JSON.stringify(doc),
    );
  });

  it("id 없는 하위 행 key = `<부모 행 id>-<index>` (items 경로 `Menu.tsx` fallback 과 같다)", () => {
    const doc = seededDoc([
      {
        id: "m2",
        type: "Menu",
        props: {
          items: [{ id: "p", label: "P", children: [{ label: "X" }] }],
        },
      } as CanonicalNode,
    ]);
    const parent = indexNodes(doc).get("m2")!.children![0]!;
    expect((parent.children![0]!.props as Record<string, unknown>).id).toBe(
      "p-0",
    );
  });

  it("Preview 정적 경로 = 이관 전 items 경로와 같은 메뉴 (최상위 · 하위 메뉴 표식) · 하위 메뉴 = 행 데이터", async () => {
    // 이관 전 (items 경로) — jsdom 에서 동적 collection 의 하위 메뉴는 열리지 않아 최상위만 대조한다.
    const before = await openMenus(
      page([
        {
          id: "m",
          type: "Menu",
          props: { items: SUBMENU_ROWS },
        } as CanonicalNode,
      ]),
      "m",
    );
    cleanup();
    const after = await openMenus(
      seededDoc([
        {
          id: "m",
          type: "Menu",
          props: { items: SUBMENU_ROWS },
        } as CanonicalNode,
      ]),
      "m",
    );
    expect(before.top).toEqual([
      { text: "Open", submenu: false },
      { text: "Share", submenu: true },
    ]);
    expect(after.top).toEqual(before.top);
    expect(after.chevron).toEqual({ width: "1em", fill: "none" });
    expect(after.sub).toEqual([
      { text: "Mail", submenu: false },
      { text: "SMS", submenu: false },
    ]);
  });

  it("owner style (위치 · 폭) 은 트리거 버튼에 — 목록 (popover 안 Menu) 에는 없다", async () => {
    const { placement } = await openMenus(
      page([
        {
          id: "mp",
          type: "Menu",
          props: {
            label: "Share",
            items: SUBMENU_ROWS,
            style: { position: "absolute", left: "320px", width: "160px" },
          },
        } as CanonicalNode,
      ]),
      "mp",
    );
    expect(placement.trigger).toEqual(["320px", "160px"]);
    expect(placement.list ?? "").not.toContain("320px");
    expect(placement.popoverSize).toBe("md");
  });

  it("Preview 구조 경로 (section 이 섞인 items) 도 하위 메뉴를 그린다 (F7 — 종전: 버림)", async () => {
    const { top, sub } = await openMenus(
      page([
        {
          id: "ms",
          type: "Menu",
          props: {
            items: [
              {
                id: "sec",
                type: "section",
                header: "File",
                items: SUBMENU_ROWS,
              },
            ],
          },
        } as CanonicalNode,
      ]),
      "ms",
    );
    expect(top).toEqual([
      { text: "Open", submenu: false },
      { text: "Share", submenu: true },
    ]);
    expect(sub.map((r) => r.text)).toEqual(["Mail", "SMS"]);
  });

  it("바인딩 Menu (`dataBinding`) 는 `items` 그대로", () => {
    const doc = seededDoc([
      {
        id: "mb",
        type: "Menu",
        props: { items: SUBMENU_ROWS },
        dataBinding: { type: "collection", source: "static", config: {} },
      } as unknown as CanonicalNode,
    ]);
    expect(indexNodes(doc).get("mb")!.props?.items).toEqual(SUBMENU_ROWS);
  });

  it('MenuItem instance 가 Slot "+" host — 자식 MenuItem (하위 메뉴)', () => {
    const doc = seededDoc([
      {
        id: "m3",
        type: "Menu",
        props: { items: [{ id: "a", label: "A" }] },
      } as CanonicalNode,
    ]);
    const byId = indexNodes(doc);
    const item = byId.get("m3")!.children![0]!;
    expect(
      resolveSlotInsertAction(
        { type: "MenuItem" } as never,
        byId.get(MENU_ITEM_DEFAULT_ORIGIN_ID) as never,
      ).kind,
    ).toBe("list-item");
    const plan = planTabItemInsert({
      document: doc,
      hostId: item.id,
      candidateId: MENU_ITEM_DEFAULT_ORIGIN_ID,
      newKey: "k-sub",
    });
    expect(plan).toMatchObject({
      kind: "plain",
      tabListId: item.id,
      tab: { ref: MENU_ITEM_DEFAULT_ORIGIN_ID, props: { id: "k-sub" } },
      selection: null,
    });
  });
});
