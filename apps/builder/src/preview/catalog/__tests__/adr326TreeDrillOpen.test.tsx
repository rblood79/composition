import { act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { NodeId } from "../../../../../../packages/shared/src/catalog/document/types";
import { CASCADER_ITEM_ORIGIN_ID } from "../../../../../../packages/shared/src/catalog/document/cascaderOrigins";
import {
  insertCollectionItem,
  setFields,
} from "../../../../../../packages/shared/src/catalog/commands";
import { insertNodes } from "../../../../../../packages/shared/src/catalog/commands";
import { setSiteSettings } from "../../../../../../packages/shared/src/catalog/commands/project";
import { openAdr280Preview } from "./support/adr280Harness";

/**
 * ADR-326 Phase 3 (G3 — breakdown §4.3 · §4.4) — a `tree` · `drill` Cascader's open content drawn
 * from its nodes in a running Preview: the list box node is RAC `Tree` · `GridList`, each row its
 * item record (catalog id · `react-aria-CascaderItem` · the written style), a `drill` field's trail
 * is its Breadcrumbs node's four crumb positions with the level's path and its 「Back」 node goes one
 * level up. The expected values are written out from the origin's sample items (Electronics >
 * Computers > Laptops · Desktops, Phones …, Clothing, Books — Books is `__item-3`).
 */
afterEach(() => {
  vi.restoreAllMocks();
});
// (The open content is a lazy chunk — its first import outlasts a few frames.)
beforeAll(async () => {
  await import("../../../../../../packages/shared/src/catalog/runtime/cascaderMenu.components");
});

const PAINT = "rgb(255, 228, 196)";

/** Which of the trail node's four crumb positions an element draws (`crumb-1` … — its child order). */
function position(crumb: HTMLElement): string {
  const trail = [...session().root!.domInputs.values()].find((record) =>
    record.id.endsWith("__trail"),
  )!;
  return `crumb-${trail.children.indexOf(crumb.getAttribute("data-catalog-id")!) + 1}`;
}
let session: () => Awaited<ReturnType<typeof openAdr280Preview>>["session"];

async function place(mode: "tree" | "drill", value?: string) {
  const h = await openAdr280Preview(["Cascader"]);
  session = () => h.session;
  const [target] = h.ids as [NodeId];
  h.declare(target, { mode, ...(value ? { value } : {}) });
  const user = userEvent.setup();
  const field = () => h.element(target)!;
  const trigger = () => field().querySelector("button")!;
  const dialog = () =>
    document.querySelector<HTMLElement>('section[role="dialog"]');
  const settle = () => act(async () => new Promise((r) => setTimeout(r, 50)));
  const openIt = async () => {
    await user.click(trigger());
    await vi.waitFor(() => expect(dialog()).toBeTruthy());
    await settle();
  };
  const record = (key: string) =>
    [...h.workspace.root.domInputs.values()].find(
      (item) =>
        h.workspace.root.typeOf(item) === "CascaderItem" &&
        item.props.id === key,
    )!;
  return { ...h, target, user, field, trigger, dialog, settle, openIt, record };
}

describe("ADR-326 G3 — tree · drill 의 열린 내용 = 원본 노드 (Preview)", () => {
  it("tree: 목록 = CascaderList record 의 RAC Tree · 행 = 항목 record · 가지의 펼침 버튼 = record 의 chevron", async () => {
    const h = await place("tree");
    h.workspace.execute(
      setFields({
        targets: [h.workspace.itemOfRecord(h.record("books").id)!.target],
        visual: { backgroundColor: { kind: "set", value: PAINT } },
      } as never),
    );
    h.flush();
    await h.openIt();
    const tree = document.querySelector<HTMLElement>('[role="treegrid"]')!;
    expect(tree.className).toBe("react-aria-CascaderList");
    expect(tree.getAttribute("data-catalog-id")).toMatch(/__list$/);
    // (Only one RAC dialog — the field's; the Popover node is not one too.)
    expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(1);
    const rows = () => [...tree.querySelectorAll<HTMLElement>('[role="row"]')];
    expect(rows().map((row) => row.textContent)).toEqual([
      "Electronics",
      "Clothing",
      "Books",
    ]);
    for (const row of rows()) {
      expect(row.classList.contains("react-aria-CascaderItem")).toBe(true);
      expect(row.getAttribute("data-catalog-id")).toMatch(/__item-\d$/);
    }
    const books = rows().find((row) => row.textContent === "Books")!;
    expect(books.style.backgroundColor).toBe(PAINT);
    // (A branch's expand button holds its record's chevron Icon; a leaf has none.)
    const chevron = (row: HTMLElement) =>
      row.querySelector<HTMLElement>('button[slot="chevron"]');
    expect(rows().map((row) => !!chevron(row))).toEqual([true, true, false]);
    expect(
      chevron(rows()[0]!)!
        .querySelector(".react-aria-Icon")!
        .getAttribute("data-catalog-id"),
    ).toBeTruthy();
    await h.user.click(chevron(rows()[0]!)!);
    await h.settle();
    expect(rows().map((row) => row.textContent)).toEqual([
      "Electronics",
      "Computers",
      "Phones",
      "Clothing",
      "Books",
    ]);
    expect(rows()[1]!.getAttribute("data-catalog-id")).toMatch(/__item-1-1$/);
    h.view.unmount();
  });

  it("tree: 실행 중 숨김 (Hide 동작의 style) 이 그 행에 간다", async () => {
    const h = await place("tree");
    await act(async () =>
      h.runtime.setRuntimeProps!(h.record("books").id, {
        style: { display: "none" },
      }),
    );
    await h.openIt();
    const rows = [
      ...document.querySelectorAll<HTMLElement>(
        '[role="treegrid"] [role="row"]',
      ),
    ];
    expect(rows.map((row) => [row.textContent, row.style.display])).toEqual([
      ["Electronics", ""],
      ["Clothing", ""],
      ["Books", "none"],
    ]);
    h.view.unmount();
  });

  it("drill: 목록 = RAC GridList · 경로 줄 = Breadcrumbs 노드의 자리 · 「뒤로」 노드 = 한 단계 위", async () => {
    const h = await place("drill");
    await h.openIt();
    const grid = () => document.querySelector<HTMLElement>('[role="grid"]')!;
    const rows = () =>
      [...grid().querySelectorAll<HTMLElement>('[role="row"]')].map(
        (row) => row.textContent,
      );
    const crumbs = () =>
      [
        ...h
          .dialog()!
          .querySelectorAll<HTMLElement>(
            ".react-aria-Breadcrumbs > .react-aria-Breadcrumb",
          ),
      ].map((crumb) => [crumb.textContent, position(crumb)]);
    const back = () =>
      h.dialog()!.querySelector<HTMLButtonElement>('button[slot="back"]')!;
    expect(grid().className).toBe("react-aria-CascaderList");
    expect(
      grid().querySelector('[role="row"]')!.getAttribute("data-catalog-id"),
    ).toMatch(/__item-1$/);
    expect(rows()).toEqual(["Electronics", "Clothing", "Books"]);
    // (The trail's first position holds the field's label; the others are not drawn.)
    expect(crumbs()).toEqual([["Category", "crumb-1"]]);
    expect(back().disabled).toBe(true);
    // (The search field has focus on open; Tab goes into the level's list, Enter goes in.)
    await h.user.keyboard("{Tab}");
    expect(document.activeElement?.textContent).toBe("Electronics");
    await h.user.keyboard("{Enter}");
    await h.settle();
    expect(rows()).toEqual(["Computers", "Phones"]);
    expect(crumbs()).toEqual([
      ["Category", "crumb-1"],
      ["Electronics", "crumb-2"],
    ]);
    expect(back().disabled).toBe(false);
    await h.user.click(back());
    await h.settle();
    expect(rows()).toEqual(["Electronics", "Clothing", "Books"]);
    // (After a move the list holds focus — its first row.)
    expect(document.activeElement?.textContent).toBe("Electronics");
    await h.user.keyboard("{Enter}");
    await h.settle();
    expect(rows()).toEqual(["Computers", "Phones"]);
    // (A trail crumb goes to its level.)
    await h.user.click(
      h
        .dialog()!
        .querySelector<HTMLElement>(".react-aria-Breadcrumb [role='link']")!,
    );
    await h.settle();
    expect(rows()).toEqual(["Electronics", "Clothing", "Books"]);
    h.view.unmount();
  });

  it("drill: 네 단계가 넘는 경로 — 첫 자리 + 접힌 메뉴 (나머지 조상) + 끝 둘 · 메뉴 항목이 그 단계로", async () => {
    const h = await place("drill");
    // (A chain of new items — Alpha > Beta > Gamma > Delta > the leaf 「Leaf」 — under the list box.)
    const list = [...h.workspace.root.domInputs.values()].find(
      (item) => h.workspace.root.typeOf(item) === "CascaderList",
    )!;
    let host = h.workspace.itemOfRecord(list.id)!.target;
    for (const [key, label] of [
      ["alpha", "Alpha"],
      ["beta", "Beta"],
      ["gamma", "Gamma"],
      ["delta", "Delta"],
      ["leaf", "Leaf"],
    ] as const) {
      const id = `project:node:${key}` as NodeId;
      h.workspace.execute(
        insertCollectionItem({
          host,
          key,
          rootId: id,
          entries: [
            {
              kind: "node",
              id,
              definitionId: CASCADER_ITEM_ORIGIN_ID,
              children: [],
              props: {
                id: { kind: "set", value: key },
                label: { kind: "set", value: label },
              },
              visual: {},
              sizing: {},
              descendantOverrides: [],
            },
          ],
          newId: h.workspace.newId,
        } as never),
      );
      h.flush();
      host = { kind: "node", id } as never;
    }
    h.declare(h.target, { value: "leaf" });
    await h.openIt();
    const rows = () =>
      [
        ...document.querySelectorAll<HTMLElement>('[role="grid"] [role="row"]'),
      ].map((row) => row.textContent);
    // (The just-opened level is the picked item's: Delta's.)
    expect(rows()).toEqual(["Leaf"]);
    const shown = () =>
      [
        ...h
          .dialog()!
          .querySelectorAll<HTMLElement>(
            ".react-aria-Breadcrumbs > .react-aria-Breadcrumb",
          ),
      ].map((crumb) =>
        crumb.classList.contains("breadcrumb-menu")
          ? "…"
          : [crumb.textContent, position(crumb)],
      );
    // (Five crumbs — Category › Alpha › Beta › Gamma › Delta: positions 1 · 3 · 4 hold the first
    //  and the last two; the folder holds the rest.)
    expect(shown()).toEqual([
      ["Category", "crumb-1"],
      "…",
      ["Gamma", "crumb-3"],
      ["Delta", "crumb-4"],
    ]);
    await h.user.click(
      h.dialog()!.querySelector<HTMLElement>(".breadcrumb-menu button")!,
    );
    await h.settle();
    const menu = [
      ...document.querySelectorAll<HTMLElement>(
        '[role="menu"][aria-label="More items"] [role="menuitem"]',
      ),
    ];
    expect(menu.map((item) => item.textContent)).toEqual(["Alpha", "Beta"]);
    await h.user.click(menu[0]!);
    await h.settle();
    expect(rows()).toEqual(["Beta"]);
    h.view.unmount();
  });
  // (판독 1 수리 — 2026-11-28.)
  it("drill: 검색 결과를 키보드로 고른다 (↓ Enter) — 목록이 검색의 가상 focus 를 가져가지 않는다", async () => {
    const h = await place("drill");
    await h.openIt();
    await h.user.keyboard("Books");
    await h.settle();
    await h.user.keyboard("{ArrowDown}{Enter}");
    await h.settle();
    expect(h.dialog()).toBeNull();
    expect(
      h.field().querySelector(".react-aria-SelectValue")!.textContent,
    ).toBe("Books");
    h.view.unmount();
  });

  it("tree: 검색을 지워도 사용자가 펼친 가지가 그대로다", async () => {
    const h = await place("tree");
    await h.openIt();
    const rows = () =>
      [
        ...document.querySelectorAll<HTMLElement>(
          '[role="treegrid"] [role="row"]',
        ),
      ].map((row) => row.textContent);
    await h.user.click(
      document.querySelector<HTMLElement>(
        '[role="treegrid"] [role="row"] button[slot="chevron"]',
      )!,
    );
    await h.settle();
    expect(rows()).toEqual([
      "Electronics",
      "Computers",
      "Phones",
      "Clothing",
      "Books",
    ]);
    const search = document.querySelector<HTMLInputElement>(
      ".react-aria-SearchField input",
    )!;
    await h.user.click(search);
    await h.user.keyboard("book");
    await h.settle();
    await h.user.clear(search);
    await h.settle();
    expect(rows()).toEqual([
      "Electronics",
      "Computers",
      "Phones",
      "Clothing",
      "Books",
    ]);
    h.view.unmount();
  });

  // (Codex 수리 검증 — 원본 라벨 앞 (index 0) 에 넣어도: 조각이 제 부품의 사본을 가진 뒤에도.)
  it.each([
    [0, "Extra Category"],
    [1, "Category Extra"],
  ])("drill: 경로 조각에 넣은 Text 는 자기 글자 그대로 — 경로 이름은 조각의 원본 라벨에만 (index %i)", async (index, expected) => {
    const h = await place("drill");
    const crumb = [...h.workspace.root.domInputs.values()].find(
      (record) =>
        h.workspace.root.typeOf(record) === "Breadcrumb" &&
        h.workspace.root.domInputs.get(record.parentId)?.id.endsWith("__trail"),
    )!;
    const added = "project:node:crumb-extra" as NodeId;
    h.workspace.execute(
      insertNodes({
        parent: h.workspace.itemOfRecord(crumb.id)!.target,
        index,
        entries: [
          {
            kind: "node",
            id: added,
            definitionId: "lib:definition:text",
            children: [],
            props: {
              children: {
                kind: "set",
                value: index === 0 ? "Extra " : " Extra",
              },
            },
            visual: {},
            sizing: {},
            descendantOverrides: [],
          },
        ],
        rootIds: [added],
        newId: h.workspace.newId,
      } as never),
    );
    h.flush();
    await h.openIt();
    expect(
      h
        .dialog()!
        .querySelector(".react-aria-Breadcrumbs > .react-aria-Breadcrumb")!
        .textContent,
    ).toBe(expected);
    h.view.unmount();
  });

  it("drill: 「뒤로」 의 이름은 사이트 언어로 (ko — 뒤로)", async () => {
    const h = await place("drill");
    h.workspace.execute(setSiteSettings({ patch: { lang: "ko" } }));
    h.flush();
    await h.openIt();
    expect(
      h
        .dialog()!
        .querySelector('button[slot="back"]')!
        .getAttribute("aria-label"),
    ).toBe("뒤로");
    h.view.unmount();
  });
});
