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
import { rowParts } from "../../../../../../packages/shared/src/catalog/runtime/cascaderPanel.components";
import { openAdr280Preview } from "./support/adr280Harness";

/** A row's name — its label part (a branch row also holds its item count, 사용자 결정 2026-11-29). */
const rowName = (row: Element | null | undefined) =>
  row?.querySelector('[slot="label"]')?.textContent ?? row?.textContent;

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
  /** The field's picked keys — its form inputs (a field declared with `name: "picked"`). */
  const picked = () =>
    [...document.querySelectorAll<HTMLInputElement>('input[name="picked"]')]
      .map((input) => input.value)
      .filter(Boolean);
  return {
    ...h,
    target,
    user,
    field,
    trigger,
    dialog,
    settle,
    openIt,
    record,
    picked,
  };
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
    expect(rows().map((row) => rowName(row))).toEqual([
      "Electronics",
      "Clothing",
      "Books",
    ]);
    for (const row of rows()) {
      expect(row.classList.contains("react-aria-CascaderItem")).toBe(true);
      expect(row.getAttribute("data-catalog-id")).toMatch(/__item-\d$/);
    }
    const books = rows().find((row) => rowName(row) === "Books")!;
    expect(books.style.backgroundColor).toBe(PAINT);
    // (A row's expand button holds its record's chevron Icon — a leaf's keeps its room undrawn, S2
    //  TreeView's: RAC marks a branch row `data-has-child-items`, the rule hides the rest's button.)
    const chevron = (row: HTMLElement) =>
      row.querySelector<HTMLElement>('button[slot="chevron"]');
    expect(rows().map((row) => !!chevron(row))).toEqual([true, true, true]);
    expect(
      rows().map((row) => row.hasAttribute("data-has-child-items")),
    ).toEqual([true, true, false]);
    expect(
      chevron(rows()[0]!)!
        .querySelector(".react-aria-Icon")!
        .getAttribute("data-catalog-id"),
    ).toBeTruthy();
    await h.user.click(chevron(rows()[0]!)!);
    await h.settle();
    expect(rows().map((row) => rowName(row))).toEqual([
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
    expect(rows.map((row) => [rowName(row), row.style.display])).toEqual([
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
      [...grid().querySelectorAll<HTMLElement>('[role="row"]')].map((row) =>
        rowName(row),
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
    // (사용자 결정 2026-11-29 — the top level: no trail (the Breadcrumbs is not drawn), and 「Back」
    //  disabled — the Cascader rule takes a disabled 「Back」 out, the search box fills the head row.)
    expect(h.dialog()!.querySelector(".react-aria-Breadcrumbs")).toBeNull();
    expect(back().disabled).toBe(true);
    expect(back().parentElement).toBe(
      h.dialog()!.querySelector(".react-aria-SearchField")!.parentElement,
    );
    // (The search field has focus on open; Tab goes into the level's list, Enter goes in.)
    await h.user.keyboard("{Tab}");
    expect(rowName(document.activeElement)).toBe("Electronics");
    await h.user.keyboard("{Enter}");
    await h.settle();
    expect(rows()).toEqual(["Computers", "Phones"]);
    // (The trail names the levels entered — no crumb of the top level.)
    expect(crumbs()).toEqual([["Electronics", "crumb-1"]]);
    expect(back().disabled).toBe(false);
    await h.user.click(back());
    await h.settle();
    expect(rows()).toEqual(["Electronics", "Clothing", "Books"]);
    // (After a move the list holds focus — its first row.)
    expect(rowName(document.activeElement)).toBe("Electronics");
    await h.user.keyboard("{Enter}");
    await h.settle();
    expect(rows()).toEqual(["Computers", "Phones"]);
    await h.user.keyboard("{Enter}");
    await h.settle();
    expect(rows()).toEqual(["Laptops", "Desktops"]);
    expect(crumbs()).toEqual([
      ["Electronics", "crumb-1"],
      ["Computers", "crumb-2"],
    ]);
    // (A trail crumb goes to its level.)
    await h.user.click(
      h
        .dialog()!
        .querySelector<HTMLElement>(".react-aria-Breadcrumb [role='link']")!,
    );
    await h.settle();
    expect(rows()).toEqual(["Computers", "Phones"]);
    h.view.unmount();
  });

  it("drill: 시작 값의 단계에서 위로 가면 경로 항목의 행이 제 부품으로 그려진다 (Canvas 의 막 연 화면 상태가 새지 않는다)", async () => {
    // (The just-opened screen stands at Computers' level — Electronics · Computers have no row
    //  there (the Canvas's `pass`): going up, they are rows with their label and chevron.)
    const h = await place("drill", "laptops");
    await h.openIt();
    const grid = () => document.querySelector<HTMLElement>('[role="grid"]')!;
    const rows = () =>
      [...grid().querySelectorAll<HTMLElement>('[role="row"]')].map((row) => [
        rowName(row),
        !!row.querySelector('.react-aria-Icon[slot="descriptor"]'),
      ]);
    expect(rows()).toEqual([
      ["Laptops", false],
      ["Desktops", false],
    ]);
    const back = () =>
      h.dialog()!.querySelector<HTMLButtonElement>('button[slot="back"]')!;
    await h.user.click(back());
    await h.settle();
    expect(rows()).toEqual([
      ["Computers", true],
      ["Phones", true],
    ]);
    await h.user.click(back());
    await h.settle();
    expect(rows()).toEqual([
      ["Electronics", true],
      ["Clothing", true],
      ["Books", false],
    ]);
    h.view.unmount();
  });

  it("drill · 가지 선택: 단계의 「전체」 줄 = 가지의 record (check · 라벨 = 단계 이름 · chevron 없음) — 위로 가면 그 record 는 제 이름의 가지 행", async () => {
    const h = await place("drill", "laptops");
    h.declare(h.target, {
      mode: "drill",
      value: "laptops",
      allowsBranchSelection: true,
    });
    await h.openIt();
    const grid = () => document.querySelector<HTMLElement>('[role="grid"]')!;
    const rows = () => [
      ...grid().querySelectorAll<HTMLElement>('[role="row"]'),
    ];
    const own = rows()[0]!;
    expect(rows().map((row) => rowName(row))).toEqual([
      "All of Computers",
      "Laptops",
      "Desktops",
    ]);
    expect(own.getAttribute("data-catalog-id")).toMatch(/__item-1-1$/);
    expect(
      own.querySelector('.react-aria-Icon[slot="selection"]'),
    ).toBeTruthy();
    expect(own.querySelector('.react-aria-Icon[slot="descriptor"]')).toBeNull();
    await h.user.click(
      h.dialog()!.querySelector<HTMLButtonElement>('button[slot="back"]')!,
    );
    await h.settle();
    expect(rows().map((row) => rowName(row))).toEqual([
      "All of Electronics",
      "Computers",
      "Phones",
    ]);
    expect(
      rows()[1]!.querySelector('.react-aria-Icon[slot="descriptor"]'),
    ).toBeTruthy();
    h.view.unmount();
  });

  it("수리 검증 #5 — 항목 라벨의 부분 서식 (text run) 은 Preview 행에 그대로 (「전체」 줄 context 밖)", async () => {
    const h = await place("tree");
    const books = [...h.workspace.root.domInputs.values()].find(
      (item) =>
        h.workspace.root.typeOf(item) === "CascaderItem" &&
        item.props.label === "Books",
    )!;
    const label = books.children
      .map((id) => h.workspace.root.domInputs.get(id)!)
      .find((child) => child.props.slot === "label")!;
    h.workspace.execute(
      setFields({
        targets: [h.workspace.itemOfRecord(label.id)!.target],
        props: {
          children: {
            kind: "set",
            value: {
              kind: "text",
              runs: [
                { text: "Bo", marks: { fontWeight: 700 } },
                { text: "oks" },
              ],
            },
          },
        },
      } as never),
    );
    h.flush();
    await h.openIt();
    const row = [
      ...document.querySelectorAll<HTMLElement>(
        '[role="treegrid"] [role="row"]',
      ),
    ].find((each) => rowName(each) === "Books")!;
    const bold = [
      ...row.querySelectorAll<HTMLElement>('[slot="label"] *'),
    ].find((span) => span.textContent === "Bo");
    expect(bold?.style.fontWeight).toBe("700");
    h.view.unmount();
  });

  it("drill: 네 단계가 넘는 경로 — 첫 자리 + 접힌 메뉴 (나머지 조상) + 끝 둘 · 메뉴 항목이 그 단계로", async () => {
    const h = await place("drill");
    // (A chain of new items — Alpha > Beta > Gamma > Delta > Epsilon > the leaf 「Leaf」 — under the
    //  list box: five levels entered, one more than the trail's positions.)
    const list = [...h.workspace.root.domInputs.values()].find(
      (item) => h.workspace.root.typeOf(item) === "CascaderList",
    )!;
    let host = h.workspace.itemOfRecord(list.id)!.target;
    for (const [key, label] of [
      ["alpha", "Alpha"],
      ["beta", "Beta"],
      ["gamma", "Gamma"],
      ["delta", "Delta"],
      ["epsilon", "Epsilon"],
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
      ].map((row) => rowName(row));
    // (The just-opened level is the picked item's: Epsilon's.)
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
    // (Five crumbs — Alpha › Beta › Gamma › Delta › Epsilon: positions 1 · 3 · 4 hold the first
    //  and the last two; the folder holds the rest.)
    expect(shown()).toEqual([
      ["Alpha", "crumb-1"],
      "…",
      ["Delta", "crumb-3"],
      ["Epsilon", "crumb-4"],
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
    expect(menu.map((item) => item.textContent)).toEqual(["Beta", "Gamma"]);
    await h.user.click(menu[0]!);
    await h.settle();
    expect(rows()).toEqual(["Gamma"]);
    h.view.unmount();
  });
  // (판독 1 수리 — 2026-11-28.)
  it("drill: 검색 결과를 키보드로 고른다 (↓ Enter) — 목록이 검색의 가상 focus 를 가져가지 않는다", async () => {
    const h = await place("drill");
    // (The flat results — `searchScope: "global"`; the default narrows the level, below.)
    h.declare(h.target, { searchScope: "global" } as never);
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
      ].map((row) => rowName(row));
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
    [0, "Extra Electronics"],
    [1, "Electronics Extra"],
  ])(
    "drill: 경로 조각에 넣은 Text 는 자기 글자 그대로 — 경로 이름은 조각의 원본 라벨에만 (index %i)",
    async (index, expected) => {
      // (A level under the top — the top level draws no trail, 사용자 결정 2026-11-29.)
      const h = await place("drill", "laptops");
      const crumb = [...h.workspace.root.domInputs.values()].find(
        (record) =>
          h.workspace.root.typeOf(record) === "Breadcrumb" &&
          h.workspace.root.domInputs
            .get(record.parentId)
            ?.id.endsWith("__trail"),
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
    },
  );

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
  // ── 사용자 결정 2026-11-29 「가벼운 쪽」 — the reference's drill: level search · item count ──
  const gridRows = () =>
    [
      ...document.querySelectorAll<HTMLElement>('[role="grid"] [role="row"]'),
    ].map((row) => rowName(row));
  const searchBox = () =>
    document.querySelector<HTMLInputElement>(".react-aria-SearchField input")!;

  it("기본 방식 = drill — mode 를 쓰지 않은 Cascader 가 한 단계씩 연다", async () => {
    const h = await openAdr280Preview(["Cascader"]);
    const [target] = h.ids as [NodeId];
    const user = userEvent.setup();
    await user.click(h.element(target)!.querySelector("button")!);
    await vi.waitFor(() =>
      expect(document.querySelector('section[role="dialog"]')).toBeTruthy(),
    );
    expect(gridRows()).toEqual(["Electronics", "Clothing", "Books"]);
    h.view.unmount();
  });

  it("drill · 검색 기본 = 현재 단계 — 그 단계의 행만 거르고 (가지는 들어갈 수 있다) · 경로 줄이 남고 · 들어가면 검색어가 비워진다", async () => {
    const h = await place("drill");
    await h.openIt();
    await h.user.keyboard("cl");
    await h.settle();
    // (The first level's rows only — 「Clothing」; a deeper item (no 「cl」 leaf here) is not listed.)
    expect(gridRows()).toEqual(["Clothing"]);
    expect(document.querySelector("[data-cascader-results]")).toBeNull();
    await h.user.click(
      document.querySelector<HTMLElement>('[role="grid"] [role="row"]')!,
    );
    await h.settle();
    expect(gridRows()).toEqual(["Men", "Women"]);
    expect(searchBox().value).toBe("");
    await h.user.click(searchBox());
    await h.user.keyboard("wo");
    await h.settle();
    expect(gridRows()).toEqual(["Women"]);
    // (The level's trail and 「Back」 stay over a level search.)
    const trail = h
      .dialog()!
      .querySelector<HTMLElement>(".react-aria-Breadcrumbs")!;
    expect(trail.textContent).toBe("Clothing");
    // (Nothing on this level holds the query — a deeper or another level's item is not searched.)
    await h.user.clear(searchBox());
    await h.user.keyboard("laptop");
    await h.settle();
    // (RAC draws the empty state as the list's one row.)
    expect(gridRows()).toEqual(["No results"]);
    expect(document.querySelector('[role="grid"]')!.textContent).toBe(
      "No results",
    );
    h.view.unmount();
  });

  it("drill · searchScope deep — 지금 단계 아래의 고를 수 있는 항목만 경로와 함께", async () => {
    const h = await place("drill", "laptops");
    h.declare(h.target, { searchScope: "deep" } as never);
    await h.openIt();
    expect(gridRows()).toEqual(["Laptops", "Desktops"]);
    await h.user.keyboard("s");
    await h.settle();
    // (Under 「Computers」: Laptops · Desktops — not Smartphones · Accessories · Books.)
    expect(
      [
        ...document.querySelectorAll<HTMLElement>(
          '[data-cascader-results] [role^="menuitem"]',
        ),
      ].map((row) => rowName(row)),
    ).toEqual(["Laptops", "Desktops"]);
    h.view.unmount();
  });

  // (reui 정렬 판독 1 수리 — 2026-11-29.)
  const valueText = (h: Awaited<ReturnType<typeof place>>) =>
    h.field().querySelector(".react-aria-SelectValue")!.textContent;
  const clickRow = async (
    h: Awaited<ReturnType<typeof place>>,
    name: string,
  ) => {
    await h.user.click(
      [
        ...document.querySelectorAll<HTMLElement>('[role="grid"] [role="row"]'),
      ].find((row) => rowName(row) === name)!,
    );
    await h.settle();
  };

  it("판독 1 #2 — 다중 선택: 한 단계에서 고르거나 풀어도 다른 단계에서 고른 값이 남는다", async () => {
    const h = await place("drill");
    h.declare(h.target, {
      name: "picked",
      selectionMode: "multiple",
      value: ["laptops", "books"],
    } as never);
    await h.openIt();
    const before = valueText(h);
    expect(gridRows()).toEqual(["Laptops", "Desktops"]);
    await h.user.keyboard("desk");
    await h.settle();
    expect(gridRows()).toEqual(["Desktops"]);
    await clickRow(h, "Desktops");
    expect(h.picked()).toEqual(["laptops", "books", "desktops"]);
    // (Taking one off: the other levels' picks stay too.)
    await clickRow(h, "Desktops");
    expect(h.picked()).toEqual(["laptops", "books"]);
    expect(valueText(h)).toBe(before);
    h.view.unmount();
  });

  it("판독 1 #3 — 고른 행이 있는 단계에서도 가지 행을 누르면 그 단계로 들어간다 (가지 선택을 켜도 고르지 않는다)", async () => {
    for (const allowsBranchSelection of [false, true]) {
      const h = await place("drill");
      h.declare(h.target, {
        name: "picked",
        selectionMode: "multiple",
        value: ["books"],
        allowsBranchSelection,
      } as never);
      await h.openIt();
      await h.user.keyboard("cl");
      await h.settle();
      expect(gridRows()).toEqual(["Clothing"]);
      await clickRow(h, "Clothing");
      expect(gridRows()).toEqual([
        ...(allowsBranchSelection ? ["All of Clothing"] : []),
        "Men",
        "Women",
      ]);
      expect(searchBox().value).toBe("");
      expect(h.picked()).toEqual(["books"]);
      h.view.unmount();
    }
  });

  // (판독 1 #4 — ↓ in the search box is not RAC `GridList`'s: Tab goes to the level's list. 수리
  //  검증 #1 — there Enter picks, also with a row of the level picked already.)
  const tabToList = async (h: Awaited<ReturnType<typeof place>>) => {
    for (
      let i = 0;
      i < 6 &&
      !document.querySelector('[role="grid"]')!.contains(document.activeElement);
      i++
    )
      await h.user.keyboard("{Tab}");
    await h.settle();
  };

  it("판독 1 #4 · 수리 검증 #1 — 단계 검색의 키보드: Tab 이 목록으로 · Enter 가 고른다 (그 단계에 고른 행이 있어도)", async () => {
    const empty = await place("drill");
    await empty.openIt();
    await empty.user.keyboard("book");
    await empty.settle();
    await tabToList(empty);
    expect(rowName(document.activeElement)).toBe("Books");
    await empty.user.keyboard("{Enter}");
    await empty.settle();
    expect(empty.dialog()).toBeNull();
    expect(valueText(empty)).toBe("Books");
    empty.view.unmount();
    const held = await place("drill", "laptops");
    held.declare(held.target, { name: "picked", value: "laptops" } as never);
    await held.openIt();
    await held.user.keyboard("desk");
    await held.settle();
    await tabToList(held);
    expect(rowName(document.activeElement)).toBe("Desktops");
    await held.user.keyboard("{Enter}");
    await held.settle();
    expect(held.dialog()).toBeNull();
    expect(held.picked()).toEqual(["desktops"]);
    held.view.unmount();
    // (Several values: Enter adds the row to the other picks.)
    const many = await place("drill");
    many.declare(many.target, {
      name: "picked",
      selectionMode: "multiple",
      value: ["laptops", "books"],
    } as never);
    await many.openIt();
    await many.user.keyboard("desk");
    await many.settle();
    await tabToList(many);
    await many.user.keyboard("{Enter}");
    await many.settle();
    expect(many.picked()).toEqual(["laptops", "books", "desktops"]);
    many.view.unmount();
  });

  it("판독 1 #5 — 「뒤로」 의 숨김 표시는 단계가 정한다 (작성한 isDisabled 와 무관)", async () => {
    const backNode = (h: Awaited<ReturnType<typeof place>>) =>
      h.workspace.itemOfRecord(
        [...h.workspace.root.domInputs.values()].find((record) =>
          record.id.endsWith("__back"),
        )!.id,
      )!.target;
    const back = (h: Awaited<ReturnType<typeof place>>) =>
      h.dialog()!.querySelector<HTMLButtonElement>('button[slot="back"]')!;
    const top = await place("drill");
    top.workspace.execute(
      setFields({
        targets: [backNode(top)],
        props: { isDisabled: { kind: "set", value: false } },
      } as never),
    );
    top.flush();
    await top.openIt();
    expect(back(top).hasAttribute("data-cascader-top")).toBe(true);
    top.view.unmount();
    const deep = await place("drill", "laptops");
    deep.workspace.execute(
      setFields({
        targets: [backNode(deep)],
        props: { isDisabled: { kind: "set", value: true } },
      } as never),
    );
    deep.flush();
    await deep.openIt();
    expect(back(deep).hasAttribute("data-cascader-top")).toBe(false);
    deep.view.unmount();
  });

  it("판독 1 #6 — 맨 위에서 열고 내려간 경로 줄도 폭 변화를 본다 (ResizeObserver)", async () => {
    const observed: Element[] = [];
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe(element: Element) {
          observed.push(element);
        }
        unobserve() {}
        disconnect() {}
      },
    );
    const h = await place("drill");
    await h.openIt();
    expect(h.dialog()!.querySelector(".react-aria-Breadcrumbs")).toBeNull();
    await clickRow(h, "Electronics");
    const trail = h.dialog()!.querySelector(".react-aria-Breadcrumbs")!;
    expect(trail).toBeTruthy();
    expect(observed).toContain(trail);
    h.view.unmount();
    vi.unstubAllGlobals();
  });

  it("판독 1 #7 — 단계 검색은 「전체」 줄도 이름으로 거른다", async () => {
    const h = await place("drill", "laptops");
    h.declare(h.target, { allowsBranchSelection: true } as never);
    await h.openIt();
    await h.user.keyboard("Computers");
    await h.settle();
    expect(gridRows()).toEqual(["All of Computers"]);
    await h.user.clear(searchBox());
    await h.user.keyboard("lap");
    await h.settle();
    expect(gridRows()).toEqual(["Laptops"]);
    h.view.unmount();
  });

  it("판독 1 #8 — 항목이 아직 없는 가지 (단계별 로드) 는 chevron 만, 자식 수 부품은 그리지 않는다", () => {
    const [check, label, count, chevron] = ["check", "label", "count", "chev"];
    const row = {
      props: {},
      parts: [check, label, count, chevron],
      chevron: [chevron],
      branchOnly: [chevron, count],
      frame: (() => () => null) as never,
    };
    expect(rowParts(row, true, true)).toEqual([check, label, count, chevron]);
    expect(rowParts(row, true, false)).toEqual([check, label, chevron]);
    expect(rowParts(row, false)).toEqual([check, label]);
  });

  it("가지 행의 자식 수 — drill · tree 의 가지 행에만 (잎 · 「전체」 줄에는 없음), 「뒤로」 는 검색 칸과 한 줄", async () => {
    const h = await place("drill", "laptops");
    h.declare(h.target, { allowsBranchSelection: true } as never);
    await h.openIt();
    const counts = (role: string) =>
      [
        ...document.querySelectorAll<HTMLElement>(
          `[role="${role}"] [role="row"]`,
        ),
      ].map((row) => [
        rowName(row),
        row.querySelector('[slot="count"]')?.textContent ?? null,
      ]);
    // (The level's own row and its leaves: no count.)
    expect(counts("grid")).toEqual([
      ["All of Computers", null],
      ["Laptops", null],
      ["Desktops", null],
    ]);
    const back = h
      .dialog()!
      .querySelector<HTMLButtonElement>('button[slot="back"]')!;
    expect(back.parentElement).toBe(
      h.dialog()!.querySelector(".react-aria-SearchField")!.parentElement,
    );
    expect(
      back.nextElementSibling?.classList.contains("react-aria-SearchField"),
    ).toBe(true);
    await h.user.click(back);
    await h.settle();
    expect(counts("grid")).toEqual([
      ["All of Electronics", null],
      ["Computers", "2"],
      ["Phones", "2"],
    ]);
    h.view.unmount();
    const tree = await place("tree", "laptops");
    await tree.openIt();
    expect(counts("treegrid")).toEqual([
      ["Electronics", "2"],
      ["Computers", "2"],
      ["Laptops", null],
      ["Desktops", null],
      ["Phones", "2"],
      ["Clothing", "2"],
      ["Books", null],
    ]);
    tree.view.unmount();
  });
});
